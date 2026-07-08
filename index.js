/* javascript-obfuscator:disable */
import { connect } from 'cloudflare:sockets';
/* javascript-obfuscator:enable */
// --- 后续代码保持不变 ---
const authToken = 'f64bdc57-0f54-4705-bf75-cfd646d98c06';
// ...

import { connect } from 'cloudflare:sockets';
const auth = 'f64bdc57-0f54-4705-bf75-cfd646d98c06', fallback = 'ProxyIP.SG.CMLiussss.net:443', customPath = '',
  gitURL = 'https://raw.githubusercontent.com/qwer-search/bestip/refs/heads/main/kejilandbestip.txt',
  enGit = true, enOth = true, direct = [
    { name: "cloudflare.182682.xyz", domain: "cloudflare.182682.xyz" },
    { name: "speed.marisalnc.com", domain: "speed.marisalnc.com" },
    { domain: "freeyx.cloudflare88.eu.org" }, { domain: "bestcf.top" },
    { domain: "cdn.2020111.xyz" }, { domain: "cfip.cfcdn.vip" },
    { domain: "cf.0sm.com" }, { domain: "cf.090227.xyz" }
  ];
const E_DAT = 'invalid data', E_USR = 'invalid user', E_CMD = 'command is not supported',
  E_UDP = 'UDP proxy only enable for DNS which is port 53', E_TYP = 'invalid addressType',
  E_EMP = 'addressValue is empty', E_OPN = 'webSocket.readyState is not open',
  E_STR = 'Stringified identifier is invalid';
function parseAddr(i) {
  if (!i) return { address: '', port: null };
  const idx = i.lastIndexOf(':');
  return idx > 0 ? { address: i.substring(0, idx), port: parseInt(i.substring(idx + 1), 10) } : { address: i, port: null };
}
export default {
  async fetch(req) {
    try {
      const url = new URL(req.url);
      if (req.headers.get('Upgrade') === 'websocket') return await handleWS(req);
      if (req.method === 'GET') {
        if (url.pathname === '/') {
          return new Response(`<!DOCTYPE html><html><head><title>服务正常</title></head><body style="background:#121212;color:#4caf50;text-align:center;padding-top:100px;"><h1>✅ 服务正常</h1></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        if (customPath && customPath.trim()) {
          const cp = '/' + customPath.trim().replace(/^\/|\/$/g, ''), np = url.pathname.replace(/\/$/, '');
          if (np === cp) return await handleSubPage();
          if (np === cp + '/sub') return await handleSubReq(req, url);
        } else {
          const p = url.pathname.replace(/^\/|\/$/g, '');
          if (p === auth) return await handleSubPage();
          if (p === `${auth}/sub` || url.pathname.toLowerCase().includes(`/${auth}`)) return await handleSubReq(req, url);
        }
      }
      return new Response('Not Found', { status: 404 });
    } catch (e) {
      return new Response(e.toString(), { status: 500 });
    }
  }
};
async function handleSubPage() {
  return new Response(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>订阅中心</title></head><body style="background:#000;color:#00ff00;padding:50px;font-family:monospace;"><h2>[ 代理订阅中心 ]</h2><p>订阅地址: <code id="sub-url"></code></p><script>const s=window.location.href+"/sub";document.getElementById('sub-url').innerText=s.replace("//sub","/sub");</script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
async function handleSubReq(req, url) {
  const links = [], host = url.hostname;
  links.push(...genLinks([{ ip: host, isp: '原生地址' }], host));
  if (enOth) links.push(...genLinks(direct.map(d => ({ ip: d.domain, isp: d.name || d.domain })), host));
  if (enGit) {
    const ips = await fetchIPs();
    if (ips.length > 0) links.push(...genLinks2(ips, host));
  }
  if (!links.length) links.push(`vless://00000000-0000-0000-0000-000000000000@127.0.0.1:80?encryption=none&security=none&type=ws&host=error.com&path=%2F#获取节点失败`);
  return new Response(btoa(links.join('\n')), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } });
}
function genLinks(list, host) {
  return list.map(item => {
    const sip = item.ip.includes(':') ? `[${item.ip}]` : item.ip;
    const p = new URLSearchParams({ encryption: 'none', security: 'tls', sni: host, fp: 'randomized', type: 'ws', host, path: '/?ed=2048' });
    return `vless://${auth}@${sip}:443?${p.toString()}#${encodeURIComponent(item.isp.replace(/\s/g, '_') + '-443-WS')}`;
  });
}
async function fetchIPs() {
  try {
    const r = await fetch(gitURL);
    if (!r.ok) return [];
    const text = await r.text(), res = [], lines = text.trim().replace(/\r/g, "").split('\n'), reg = /^([^:]+):(\d+)#(.*)$/;
    for (const l of lines) {
      const m = l.trim().match(reg);
      if (m) res.push({ ip: m[1], port: parseInt(m[2], 10), name: m[3].trim() || m[1] });
    }
    return res;
  } catch { return []; }
}
function genLinks2(list, host) {
  return list.map(item => {
    const sip = item.ip.includes(':') ? `[${item.ip}]` : item.ip;
    const p = new URLSearchParams({ encryption: 'none', security: 'tls', sni: host, fp: 'randomized', type: 'ws', host, path: '/?ed=2048' });
    return `vless://${auth}@${sip}:${item.port}?${p.toString()}#${encodeURIComponent(item.name)}`;
  });
}
async function handleWS(req) {
  const pair = new WebSocketPair(), [c, s] = Object.values(pair);
  s.accept();
  let conn = { socket: null }, isDns = false;
  const stream = makeStream(s, req.headers.get('sec-websocket-protocol') || '');
  stream.pipeTo(new WritableStream({
    async write(chunk) {
      if (isDns) return await forwardUDP(chunk, s, null);
      if (conn.socket) {
        const w = conn.socket.writable.getWriter();
        await w.write(chunk);
        w.releaseLock();
        return;
      }
      const p = parseHeader(chunk);
      if (p.hasError) throw new Error(p.message);
      if (p.isUDP) {
        if (p.port === 53) isDns = true;
        else throw new Error(E_UDP);
      }
      const hdr = new Uint8Array([p.version[0], 0]), data = chunk.slice(p.rawIndex);
      if (isDns) return forwardUDP(data, s, hdr);
      await forwardTCP(p.addressType, p.hostname, p.port, data, s, hdr, conn);
    }
  })).catch(err => console.log('WS Stream Error:', err));
  return new Response(null, { status: 101, webSocket: c });
}
async function forwardTCP(type, host, port, data, ws, hdr, conn) {
  async function cns(a, p) {
    const sock = connect({ hostname: a, port: p });
    const w = sock.writable.getWriter();
    await w.write(data);
    w.releaseLock();
    return sock;
  }
  async function retry() {
    const p = parseAddr(fallback);
    const s = await cns(p.address || host, p.port || port);
    conn.socket = s;
    s.closed.catch(() => {}).finally(() => closeQuietly(ws));
    connectStreams(s, ws, hdr, null);
  }
  try {
    const s = await cns(host, port);
    conn.socket = s;
    connectStreams(s, ws, hdr, retry);
  } catch { await retry(); }
}
function parseHeader(chunk) {
  if (chunk.byteLength < 24) return { hasError: true, message: E_DAT };
  const ver = new Uint8Array(chunk.slice(0, 1));
  if (formatId(new Uint8Array(chunk.slice(1, 17))) !== auth) return { hasError: true, message: E_USR };
  const opt = new Uint8Array(chunk.slice(17, 18))[0], cmd = new Uint8Array(chunk.slice(18 + opt, 19 + opt))[0];
  if (cmd !== 1 && cmd !== 2) return { hasError: true, message: E_CMD };
  const pIdx = 19 + opt, port = new DataView(chunk.slice(pIdx, pIdx + 2)).getUint16(0);
  let aIdx = pIdx + 2, aLen = 0, vIdx = aIdx + 1, host = '';
  const aType = new Uint8Array(chunk.slice(aIdx, vIdx))[0];
  if (aType === 1) {
    aLen = 4;
    host = new Uint8Array(chunk.slice(vIdx, vIdx + aLen)).join('.');
  } else if (aType === 2) {
    aLen = new Uint8Array(chunk.slice(vIdx, vIdx + 1))[0];
    vIdx += 1;
    host = new TextDecoder().decode(chunk.slice(vIdx, vIdx + aLen));
  } else if (aType === 3) {
    aLen = 16;
    const ipv6 = [], view = new DataView(chunk.slice(vIdx, vIdx + aLen));
    for (let i = 0; i < 8; i++) ipv6.push(view.getUint16(i * 2).toString(16));
    host = ipv6.join(':');
  } else return { hasError: true, message: `${E_TYP}: ${aType}` };
  if (!host) return { hasError: true, message: `${E_EMP}: ${aType}` };
  return { hasError: false, addressType: aType, port, hostname: host, isUDP: cmd === 2, rawIndex: vIdx + aLen, version: ver };
}
function makeStream(s, header) {
  let cancel = false;
  return new ReadableStream({
    start(ctrl) {
      s.addEventListener('message', ev => { if (!cancel) ctrl.enqueue(ev.data); });
      s.addEventListener('close', () => { if (!cancel) { closeQuietly(s); ctrl.close(); } });
      s.addEventListener('error', err => ctrl.error(err));
      const { earlyData, error } = b64ToArr(header);
      if (error) ctrl.error(error);
      else if (earlyData) ctrl.enqueue(earlyData);
    },
    cancel() { cancel = true; closeQuietly(s); }
  });
}
async function connectStreams(remote, ws, hdr, retry) {
  let head = hdr, hasData = false;
  await remote.readable.pipeTo(new WritableStream({
    async write(chunk, ctrl) {
      hasData = true;
      if (ws.readyState !== 1) ctrl.error(E_OPN);
      if (head) {
        ws.send(await new Blob([head, chunk]).arrayBuffer());
        head = null;
      } else ws.send(chunk);
    }
  })).catch(() => closeQuietly(ws));
  if (!hasData && retry) retry();
}
async function forwardUDP(chunk, ws, hdr) {
  try {
    const tcp = connect({ hostname: '8.8.4.4', port: 53 });
    let vhdr = hdr;
    const w = tcp.writable.getWriter();
    await w.write(chunk);
    w.releaseLock();
    await tcp.readable.pipeTo(new WritableStream({
      async write(data) {
        if (ws.readyState === 1) {
          if (vhdr) {
            ws.send(await new Blob([vhdr, data]).arrayBuffer());
            vhdr = null;
          } else ws.send(data);
        }
      }
    }));
  } catch (e) { console.error(`UDP err: ${e.message}`); }
}
function b64ToArr(str) {
  if (!str) return { error: null };
  try {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    return { earlyData: Uint8Array.from(atob(str), c => c.charCodeAt(0)).buffer, error: null };
  } catch (e) { return { error: e }; }
}
function isValidFormat(uuid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}
function closeQuietly(s) {
  try { if (s.readyState === 1 || s.readyState === 2) s.close(); } catch {}
}
const hex = Array.from({ length: 256 }, (v, i) => (i + 256).toString(16).slice(1));
function formatId(arr, offset = 0) {
  const id = (
    hex[arr[offset]] + hex[arr[offset + 1]] + hex[arr[offset + 2]] + hex[arr[offset + 3]] + "-" +
    hex[arr[offset + 4]] + hex[arr[offset + 5]] + "-" +
    hex[arr[offset + 6]] + hex[arr[offset + 7]] + "-" +
    hex[arr[offset + 8]] + hex[arr[offset + 9]] + "-" +
    hex[arr[offset + 10]] + hex[arr[offset + 11]] + hex[arr[offset + 12]] + hex[arr[offset + 13]] +
    hex[arr[offset + 14]] + hex[arr[offset + 15]]
  ).toLowerCase();
  if (!isValidFormat(id)) throw new TypeError(E_STR);
  return id;
}
