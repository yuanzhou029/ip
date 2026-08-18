import { connect } from 'cloudflare:sockets';

// ================= 配置区 =================
const UUID_STR = '07d4afa4-ea6f-46c6-b8bb-e3269b36d1f0';
const UUID_RAW = UUID_STR.replace(/-/g, '');
// 预计算 UUID 字节数组，用于极速校验 (Snippets 性能核心)
const EXPECTED_UUID_BYTES = new Uint8Array(
    UUID_RAW.match(/.{2}/g).map(byte => parseInt(byte, 16))
);

const DEFAULT_PROXY_IP = 'jp.toi.cc.cd'; 
// 确保是数组，方便遍历
const BEST_DOMAINS = ['cm.d.b.9.f.0.7.4.0.1.0.0.2.ip6.arpa:443'];
// ==========================================

export default {
    async fetch(req) {
        try {
            const u = new URL(req.url);
            
            // 1. WebSocket 升级处理
            if (req.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
                return await handle_ws(req);
            } 
            
            // 2. GET 请求处理
            if (req.method === 'GET') {
                // 根路径
                if (u.pathname === '/') {
                    return new Response("<h1 style='color:green;'>Success!</h1>", { 
                        status: 200, 
                        headers: { 'Content-Type': 'text/html; charset=utf-8' } 
                    });
                } 
                // 订阅链接路径 (兼容带横杠和不带横杠)
                else if (u.pathname.toLowerCase().includes(`/${UUID_RAW}`) || u.pathname.toLowerCase().includes(`/${UUID_STR}`)) {
                    return await handle_sub(req);
                }
            }

            return new Response('error', { status: 404 });
        } catch (err) {
            return new Response(`Runtime Error: ${err.message}`, { status: 500 });
        }
    }
};

/**
 * 生成订阅链接 (handle_sub)
 */
async function handle_sub(req) {
    const url = new URL(req.url);
    const workerDomain = url.hostname;
    let links = [];
    const wsPath = encodeURIComponent('/?ed=2048');
    const proto = "ws"; 

    BEST_DOMAINS.forEach((item, index) => {
        const name = "snippet_" + (index + 1);
        const wsParams = new URLSearchParams({
            encryption: 'none',
            security: 'tls',
            sni: workerDomain,
            fp: 'chrome',
            type: 'ws',
            host: workerDomain,
            path: wsPath
        });
        links.push(`${proto}://${UUID_STR}@${item}?${wsParams.toString()}#${encodeURIComponent(name)}`);
    });

    const content = btoa(links.join('\n'));
    return new Response(content, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
    });
}

/**
 * WebSocket 核心代理逻辑 (handle_ws)
 */
async function handle_ws(req) {
    const [client, ws] = new WebSocketPair();
    ws.accept();

    const u = new URL(req.url);

    // 修复 URL 编码问题  
    if (u.pathname.includes('%3F')) {
        const decoded = decodeURIComponent(u.pathname);
        const queryIndex = decoded.indexOf('?');
        if (queryIndex !== -1) {
            u.search = decoded.substring(queryIndex);
            u.pathname = decoded.substring(0, queryIndex);
        }
    }

    const mode = u.searchParams.get('mode') || 'proxy';
    const s5Param = u.searchParams.get('s5');
    const proxyParam = u.searchParams.get('proxyip');
    const path = s5Param ? s5Param : u.pathname.slice(1);

    // 解析 SOCKS5 信息
    let socks5 = null;
    if (path.includes('@')) {
        const [cred, server] = path.split('@');
        const [user, pass] = cred.split(':');
        const [host, port = '443'] = server.split(':');
        socks5 = {
            user,
            pass,
            host,
            port: parseInt(port)
        };
    }
    const PROXY_IP = proxyParam ? String(proxyParam) : DEFAULT_PROXY_IP;

    // 优先级顺序
    const getOrder = () => {
        if (mode === 'proxy') return ['direct', 'proxy'];
        if (mode !== 'auto') return [mode];
        const order = [];
        const searchStr = u.search.slice(1);
        for (const pair of searchStr.split('&')) {
            const key = pair.split('=')[0];
            if (key === 'direct') order.push('direct');
            else if (key === 's5') order.push('s5');
            else if (key === 'proxyip') order.push('proxy');
        }
        return order.length ? order : ['direct'];
    };

    let remote = null,
        udpWriter = null,
        isDNS = false;

    // SOCKS5 连接辅助函数
    const socks5Connect = async (targetHost, targetPort) => {
        const sock = connect({
            hostname: socks5.host,
            port: socks5.port
        });
        await sock.opened;
        const w = sock.writable.getWriter();
        const r = sock.readable.getReader();
        await w.write(new Uint8Array([5, 2, 0, 2]));
        const auth = await r.read();
        if (auth.value && auth.value[1] === 2 && socks5.user) {
            const user = new TextEncoder().encode(socks5.user);
            const pass = new TextEncoder().encode(socks5.pass);
            await w.write(new Uint8Array([1, user.length, ...user, pass.length, ...pass]));
            await r.read();
        }
        const domain = new TextEncoder().encode(targetHost);
        await w.write(new Uint8Array([5, 1, 0, 3, domain.length, ...domain, targetPort >> 8, targetPort & 0xff]));
        await r.read();
        w.releaseLock();
        r.releaseLock();
        return sock;
    };

    new ReadableStream({
        start(ctrl) {
            ws.addEventListener('message', e => {
                try { ctrl.enqueue(e.data); } catch(err) {}
            });
            ws.addEventListener('close', () => {
                remote?.close();
                ctrl.close();
            });
            ws.addEventListener('error', () => {
                remote?.close();
                ctrl.error();
            });

            const early = req.headers.get('sec-websocket-protocol');
            if (early) {
                try {
                    ctrl.enqueue(Uint8Array.from(atob(early.replace(/-/g, '+').replace(/_/g, '/')),
                        c => c.charCodeAt(0)).buffer);
                } catch { }
            }
        }
    }).pipeTo(new WritableStream({
        async write(data) {
            if (isDNS) { 
                udpWriter?.write(data); 
                return; 
            }
            
            if (remote) {
                const w = remote.writable.getWriter();
                await w.write(data);
                w.releaseLock();
                return;
            }

            if (data.byteLength < 19) return;

            // UUID 校验
            for (let i = 0; i < 16; i++) {
                if (data[i + 1] !== EXPECTED_UUID_BYTES[i]) return;
            }

            const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
            const optLen = view.getUint8(17);
            const cmd = view.getUint8(18 + optLen);
            if (cmd !== 1 && cmd !== 2) return;

            let pos = 19 + optLen;
            const port = view.getUint16(pos);
            const type = view.getUint8(pos + 2);
            pos += 3;

            let addr = '';
            if (type === 1) {
                addr = `${view.getUint8(pos)}.${view.getUint8(pos + 1)}.${view.getUint8(pos + 2)}.${view.getUint8(pos + 3)}`;
                pos += 4;
            } else if (type === 2) {
                const len = view.getUint8(pos++);
                addr = new TextDecoder().decode(data.slice(pos, pos + len));
                pos += len;
            } else if (type === 3) {
                const ipv6 = [];
                for (let i = 0; i < 8; i++, pos += 2) ipv6.push(view.getUint16(pos).toString(16));
                addr = ipv6.join(':');
            } else return;

            const header = new Uint8Array([data[0], 0]);
            const payload = data.slice(pos);

            // --- UDP DNS 处理 ---
            if (cmd === 2 && port === 53) {
            
...(truncated)...
