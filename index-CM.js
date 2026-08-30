const FIXED_UUID = 'ouiw0lw7h3gx9fzmx';
const SUB_ID = 'yuanzhou029';
const EXTERNAL_SUB_BASE_URL = 'https://sub.kkii.eu.org';
const FRONTEND_HTML_URL = 'https://tcs.yz029.dpdns.org';
const PROXY_IPS = ['jp.toi.cc.cd'];
const CONNECTION_TIMEOUT_MS = 5000;

import { connect } from 'cloudflare:sockets';

function connectWithTimeout(hostname, port) {
    return Promise.race([
        connect({ hostname, port }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), CONNECTION_TIMEOUT_MS))
    ]);
}

async function handleAppDownloadRequest(request) {
    const url = new URL(request.url);
    const targetUrlString = url.pathname.substring(1).replace(':/', '://');
    try {
        const targetUrl = new URL(targetUrlString);
        const allowedDomains = ['github.com', 'objects.githubusercontent.com', 'api.github.com'];
        if (!allowedDomains.some(domain => targetUrl.hostname.endsWith(domain))) {
            return new Response('不支持的加速域名', { status: 400 });
        }
        const newRequest = new Request(targetUrl.toString(), {
            method: request.method,
            headers: { 'Host': targetUrl.hostname, 'User-Agent': request.headers.get('User-Agent'), 'Accept': request.headers.get('Accept'), 'Referer': 'https://github.com/' },
            body: request.body, redirect: 'follow'
        });
        const backendResponse = await fetch(newRequest);
        const responseHeaders = new Headers(backendResponse.headers);
        responseHeaders.set('Access-Control-Allow-Origin', '*');
        responseHeaders.set('Cache-Control', 'public, max-age=86400');
        return new Response(backendResponse.body, { status: backendResponse.status, statusText: backendResponse.statusText, headers: responseHeaders });
    } catch (e) {
        return new Response('无效的目标URL', { status: 400 });
    }
}

export default {
    async fetch(request) {
        try {
            const url = new URL(request.url);
            const upgradeHeader = request.headers.get('Upgrade');
            
            if (upgradeHeader?.toLowerCase() !== 'websocket') {
                if (request.method === 'POST') {
                    return handleXhttp(request);
                }

                const pathname = url.pathname.toLowerCase();
                const userAgent = (request.headers.get('user-agent') || '').toLowerCase();
                const isClient = /v2ray|clash|sing-box|shadowrocket/i.test(userAgent);

                if (pathname === '/') {
                    if (isClient) {
                        const xrayUrl = `${EXTERNAL_SUB_BASE_URL}/x/${SUB_ID}`;
                        return fetch(xrayUrl, { headers: { 'User-Agent': userAgent } });
                    }
                    
                    const frontendResponse = await fetch(FRONTEND_HTML_URL);
                    if (!frontendResponse.ok) {
                        return new Response('无法获取前端页面', { status: 502 });
                    }
                    let html = await frontendResponse.text();
                    
                    const configScript = `
                    <script>
                        document.addEventListener('DOMContentLoaded', () => {
                            const subButtons = document.querySelectorAll('.card:first-of-type .btn, .button-grid .btn[data-sub-type]');
                            const appButtons = document.querySelectorAll('.app-download-section .btn');
                            const appModal = document.getElementById('appModal');
                            const baseUrl = window.location.origin;

                            subButtons.forEach(button => {
                                button.addEventListener('click', event => {
                                    const subType = event.target.getAttribute('data-sub-type');
                                    if (!subType) return;
                                    const subUrlToCopy = baseUrl + '/' + subType;
                                    navigator.clipboard.writeText(subUrlToCopy).then(() => { alert('已复制: ' + subUrlToCopy) });
                                });
                            });

                            const downloadData = {
                                android: [
                                    { name: 'Clash Meta', repo: 'MetaCubeX/ClashMetaForAndroid', keywords: ['apk', 'universal'] },
                                    { name: 'Karing', repo: 'KaringX/karing', keywords: ['apk', 'universal-release'] },
                                    { name: 'Sing-Box', repo: 'SagerNet/sing-box', keywords: ['android', 'universal'] },
                                    { name: 'V2rayNG', repo: '2dust/v2rayNG', keywords: ['apk', 'arm64-v8a'] }
                                ],
                                ios: [
                                    { name: 'Shadowrocket', fixedUrl: 'https://apps.apple.com/us/app/shadowrocket/id932747118' },
                                    { name: 'Sing-Box', fixedUrl: 'https://apps.apple.com/us/app/sing-box-vt/id6673731168' }
                                ],
                                windows: [
                                    { name: 'V2rayN', fixedUrl: 'https://github.com/2dust/v2rayN/releases/download/7.12.4/v2rayN-windows-64-SelfContained.zip' },
                                    { name: 'ClashN', repo: '2dust/clashN', keywords: ['clashN.zip'] }
                                ],
                                mac: [
                                    { name: 'ClashX', fixedUrl: 'https://github.com/yichengchen/clashX/releases/download/1.118.1/ClashX.dmg' }
                                ]
                            };

                            function getAcceleratedUrl(url) {
                                if (url.includes('github.com')) { return baseUrl + '/' + url.replace('://', ':/'); }
                                return url;
                            }

                            async function getLatestReleaseAsset(repo, keywords) {
                                try {
                                    const response = await fetch(getAcceleratedUrl(\`https://api.github.com/repos/\${repo}/releases/latest\`));
                                    if (!response.ok) return null;
                                    const data = await response.json();
                                    for (const keyword of keywords) {
                                        const asset = data.assets.find(a => a.name.toLowerCase().includes(keyword.toLowerCase()));
                                        if (asset) return asset.browser_download_url;
                                    }
                                    return data.assets[0] ? data.assets[0].browser_download_url : null;
                                } catch (e) { return null; }
                            }

                            async function openAppModal(platform) {
                                const platformName = { android: '安卓', ios: '苹果', windows: 'Windows', mac: 'Mac' }[platform];
                                appModal.querySelector('#appModalTitle').textContent = \`\${platformName}客户端下载\`;
                                const modalBody = appModal.querySelector('#appModalBody');
                                modalBody.innerHTML = '<p>正在获取最新版本...</p>';
                                appModal.style.display = 'flex';
                                const apps = downloadData[platform];
                                let content = '';
                                for (const app of apps) {
                                    let linksHtml = '';
                                    if (app.fixedUrl) {
                                        linksHtml = \`<a href="\${getAcceleratedUrl(app.fixedUrl)}" target="_blank" rel="noopener noreferrer">\${app.fixedUrl.split('/').pop()}</a>\`;
                                    } else if (app.repo) {
                                        const url = await getLatestReleaseAsset(app.repo, app.keywords);
                                        linksHtml = url ? \`<a href="\${getAcceleratedUrl(url)}" target="_blank" rel="noopener noreferrer">\${url.split('/').pop()}</a>\` : '<span>获取失败</span>';
                                    }
                                    content += \`<div class="app-list-item"><span class="app-name">\${app.name}</span><div class="app-links">\${linksHtml}</div></div>\`;
                                }
                                modalBody.innerHTML = content;
                            }

                            appButtons.forEach(button => {
                                button.addEventListener('click', () => openAppModal(button.dataset.platform));
                            });

                            if(appModal) {
                                appModal.querySelector('.modal-close-btn').addEventListener('click', () => { appModal.style.display = 'none'; });
                                appModal.addEventListener('click', e => { if (e.target === appModal) appModal.style.display = 'none'; });
                            }
                        });
                    </script>
                    `;

                    html = html.replace('</body>', `${configScript}</body>`);
                    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
                }

                const subMap = {
                    '/xray': `${EXTERNAL_SUB_BASE_URL}/x/${SUB_ID}`,
                    '/clash': `${EXTERNAL_SUB_BASE_URL}/c/${SUB_ID}`,
                    '/singbox': `${EXTERNAL_SUB_BASE_URL}/b/${SUB_ID}`,
                    '/surge': `${EXTERNAL_SUB_BASE_URL}/s/${SUB_ID}`
                };

                if (subMap[pathname]) {
                    return fetch(subMap[pathname], { headers: { 'User-Agent': userAgent || 'Cloudflare-Worker-Proxy' } });
                }
                
                if (pathname.startsWith('/https:/') || pathname.startsWith('/http:/')) {
                    return handleAppDownloadRequest(request);
                }

                return new Response(JSON.stringify(request.cf, null, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=UTF-8' } });
            }

            let socks5Address = '';
            let parsedSocks5Address = {};
            let enableSocks = null;
            let enableGlobalSocks = url.searchParams.has('globalproxy');
            let ProxyIP = '';
            let ProxyPort = 443;
            
            const urlPathLower = url.pathname.toLowerCase();
            
            if (urlPathLower.includes('/socks5=') || urlPathLower.includes('/s5=') || urlPathLower.includes('/gs5=')) {
                socks5Address = url.pathname.split('5=')[1];
                enableGlobalSocks = urlPathLower.includes('/gs5=');
            } else if (urlPathLower.includes('/socks://') || urlPathLower.includes('/socks5://') || urlPathLower.includes('/http://')) {
                socks5Address = url.pathname.split('://')[1].split('#')[0];
                if (socks5Address.includes('@')) {
                    const lastAtIndex = socks5Address.lastIndexOf('@');
                    let userPassword = socks5Address.substring(0, lastAtIndex).replaceAll('%3D', '=');
                    const base64Regex = /^(?:[A-Z0-9+/]{4})*(?:[A-Z0-9+/]{2}==|[A-Z0-9+/]{3}=)?$/i;
                    if (base64Regex.test(userPassword) && !userPassword.includes(':')) userPassword = atob(userPassword);
                    socks5Address = `${userPassword}@${socks5Address.substring(lastAtIndex + 1)}`;
                }
                enableGlobalSocks = true;
            }

            if (socks5Address) {
                try {
                    parsedSocks5Address = socks5AddressParser(socks5Address);
                    enableSocks = urlPathLower.includes('http://') ? 'http' : 'socks5';
                } catch (err) {
                    enableSocks = null;
                }
            } else {
                enableSocks = null;
            }

            if (url.searchParams.has('proxyip') || url.searchParams.has('ip')) {
                ProxyIP = url.searchParams.get('proxyip') || url.searchParams.get('ip');
                enableSocks = null;
            } else if (urlPathLower.includes('/proxyip=')) {
                ProxyIP = url.pathname.split(/proxyip=/i)[1];
                enableSocks = null;
            } else if (urlPathLower.includes('/proxyip.')) {
                ProxyIP = `proxyip.${url.pathname.split(/proxyip\./i)[1]}`;
                enableSocks = null;
            } else if (urlPathLower.includes('/pyip=')) {
                ProxyIP = url.pathname.split(/pyip=/i)[1];
                enableSocks = null;
            } else if (urlPathLower.includes('/ip=')) {
                ProxyIP = url.pathname.split(/ip=/i)[1];
                enableSocks = null;
            }

            return await handleSPESSWebSocket(request, {
                parsedSocks5Address,
                enableSocks,
                enableGlobalSocks,
                ProxyIP,
                ProxyPort
            });
            
        } catch (err) {
            return new Response(err.stack || err.toString(), { status: 500 });
        }
    },
};

async function handleSPESSWebSocket(request, config) {
    const { parsedSocks5Address, enableSocks, enableGlobalSocks, ProxyIP, ProxyPort } = config;
    const [clientWS, serverWS] = Object.values(new WebSocketPair());
    serverWS.accept();
    let remoteSocket = null;
    
    const wsReadable = createWebSocketReadableStream(serverWS, request.headers.get('sec-websocket-protocol') || '');
    wsReadable.pipeTo(new WritableStream({
        async write(chunk) {
            if (remoteSocket) {
                const writer = remoteSocket.writable.getWriter();
                await writer.write(chunk);
                writer.releaseLock();
                return;
            }

            const result = parseVLESSHeader(chunk);
            if (result.hasError) throw new Error(result.message);

            const { addressRemote, portRemote, rawDataIndex, vlessVersion, isUDP, addressType } = result;
            const rawClientData = chunk.slice(rawDataIndex);
            const vlessRespHeader = new Uint8Array([vlessVersion[0], 0]);

            if (isUDP) {
                if (portRemote === 53) return handleUDPOutBound(serverWS, vlessRespHeader, rawClientData);
                throw new Error('UDP proxy only supports DNS (port 53)');
            }

            async function connectAndPipe(address, port, isRetry) {
                const tcpSocket = await connectWithTimeout(address, port);
                remoteSocket = tcpSocket;
                const writer = tcpSocket.writable.getWriter();
                await writer.write(rawClientData);
                writer.releaseLock();
                pipeRemoteToWebSocket(tcpSocket, serverWS, vlessRespHeader, !isRetry ? connectAndRetry : null);
            }

            async function connectAndRetry() {
                try {
                    let proxyConfig = getProxyConfiguration(ProxyIP, ProxyPort);
                    await connectAndPipe(proxyConfig.ip, proxyConfig.port, true);
                } catch (err) {
                    serverWS.close(1011, `Retry connection failed: ${err.message}`);
                }
            }

            try {
                if (enableGlobalSocks) {
                    const tcpSocket = enableSocks === 'socks5'
                        ? await socks5Connect(addressType, addressRemote, portRemote, parsedSocks5Address)
                        : await httpConnect(addressType, addressRemote, portRemote, parsedSocks5Address);
                    remoteSocket = tcpSocket;
                    const writer = tcpSocket.writable.getWriter();
                    await writer.write(rawClientData);
                    writer.releaseLock();
                    pipeRemoteToWebSocket(tcpSocket, serverWS, vlessRespHeader, null);
                } else {
                    await connectAndPipe(addressRemote, portRemote, false);
                }
            } catch (err) {
                if (!enableSocks) {
                    connectAndRetry();
                } else {
                    serverWS.close(1011, `Connection failed: ${err.message}`);
                }
            }
        },
        close: () => remoteSocket?.close(),
    })).catch(() => remoteSocket?.close());

    return new Response(null, { status: 101, webSocket: clientWS });
}

async function handleXhttp(request) {
    const vlessHeader = parseVLESSHeader(await request.arrayBuffer());
    if (vlessHeader.hasError) return new Response(vlessHeader.message, { status: 400 });

    const { addressRemote, portRemote, rawDataIndex, vlessVersion } = vlessHeader;
    const rawClientData = (await request.arrayBuffer()).slice(rawDataIndex);
    const vlessRespHeader = new Uint8Array([vlessVersion[0], 0]);

    try {
        let remoteSocket;
        try {
            remoteSocket = await connectWithTimeout(addressRemote, portRemote);
        } catch (err) {
            let proxyConfig = getProxyConfiguration('', 443);
            remoteSocket = await connectWithTimeout(proxyConfig.ip, proxyConfig.port);
        }

        const { readable, writable } = new TransformStream();

        remoteSocket.readable.pipeTo(new WritableStream({
            async write(chunk) {
                const writer = writable.getWriter();
                const combined = new Uint8Array(vlessRespHeader.length + chunk.length);
                combined.set(vlessRespHeader);
                combined.set(chunk, vlessRespHeader.length);
                await writer.write(combined);
                writer.releaseLock();
            },
            close: () => writable.getWriter().close(),
        }));

        const writer = remoteSocket.writable.getWriter();
        await writer.write(rawClientData);
        writer.releaseLock();

        return new Response(readable, { headers: { 'Content-Type': 'application/octet-stream' } });
    } catch (err) {
        return new Response(`XHTTP connection failed: ${err.message}`, { status: 502 });
    }
}

function createWebSocketReadableStream(ws, earlyDataHeader) {
    return new ReadableStream({
        start(controller) {
            ws.addEventListener('message', event => controller.enqueue(event.data));
            ws.addEventListener('close', () => controller.close());
            ws.addEventListener('error', err => controller.error(err));
            if (earlyDataHeader) {
                try {
                    const decoded = atob(earlyDataHeader.replace(/-/g, '+').replace(/_/g, '/'));
                    controller.enqueue(Uint8Array.from(decoded, c => c.charCodeAt(0)));
                } catch (e) {}
            }
        }
    });
}

function parseVLESSHeader(buffer) {
    buffer = new Uint8Array(buffer);
    if (buffer.byteLength < 24) return { hasError: true, message: 'invalid header length' };
    const view = new DataView(buffer.buffer);
    const version = new Uint8Array(buffer.slice(0, 1));
    const uuid = formatUUID(new Uint8Array(buffer.slice(1, 17)));
    if (FIXED_UUID && uuid.toLowerCase() !== FIXED_UUID.toLowerCase()) return { hasError: true, message: 'invalid user' };
    const optLen = view.getUint8(17);
    const command = view.getUint8(18 + optLen);
    let isUDP = command === 2;
    if (command !== 1 && !isUDP) return { hasError: true, message: 'unsupported command' };
    let offset = 19 + optLen;
    const port = view.getUint16(offset);
    offset += 2;
    const addressType = view.getUint8(offset++);
    let address = '';
    switch (addressType) {
        case 1:
            address = Array.from(new Uint8Array(buffer.slice(offset, offset + 4))).join('.');
            offset += 4;
            break;
        case 2:
            const domainLength = view.getUint8(offset++);
            address = new TextDecoder().decode(buffer.slice(offset, offset + domainLength));
            offset += domainLength;
            break;
        case 3:
            const ipv6 = [];
            for (let i = 0; i < 8; i++) {
                ipv6.push(view.getUint16(offset).toString(16).padStart(4, '0'));
                offset += 2;
            }
            address = ipv6.join(':').replace(/(^|:)0+(\w)/g, '$1$2');
            break;
        default: return { hasError: true, message: 'invalid address type' };
    }
    return { hasError: false, addressRemote: address, portRemote: port, rawDataIndex: offset, vlessVersion: version, isUDP, addressType };
}

function pipeRemoteToWebSocket(remoteSocket, ws, vlessHeader, retry) {
    let hasIncomingData = false;
    let headerSent = false;
    remoteSocket.readable.pipeTo(new WritableStream({
        write(chunk) {
            hasIncomingData = true;
            if (ws.readyState === 1) {
                if (!headerSent) {
                    const combined = new Uint8Array(vlessHeader.byteLength + chunk.byteLength);
                    combined.set(new Uint8Array(vlessHeader), 0);
                    combined.set(new Uint8Array(chunk), vlessHeader.byteLength);
                    ws.send(combined.buffer);
                    headerSent = true;
                } else {
                    ws.send(chunk);
                }
            }
        },
        close() {
            if (!hasIncomingData && retry) retry();
            else if (ws.readyState === 1) ws.close(1000, 'normal closure');
        },
        abort: () => ws.close(1001, 'remote aborted'),
    })).catch(() => ws.close(1011, 'pipe error'));
}

function formatUUID(bytes) {
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function socks5AddressParser(address) {
    const lastAtIndex = address.lastIndexOf("@");
    let [latter, former] = lastAtIndex === -1 ? [address, undefined] : [address.substring(lastAtIndex + 1), address.substring(0, lastAtIndex)];
    let username, password, hostname, port;
    if (former) [username, password] = former.split(":");
    const latters = latter.split(":");
    if (latters.length > 2 && latter.includes("]:")) {
        port = Number(latter.split("]:")[1].replace(/[^\d]/g, ''));
        hostname = latter.split("]:")[0] + "]";
    } else if (latters.length === 2) {
        port = Number(latters.pop().replace(/[^\d]/g, ''));
        hostname = latters.join(":");
    } else {
        port = 80;
        hostname = latter;
    }
    if (isNaN(port)) throw new Error('invalid SOCKS port');
    const regex = /^\[.*\]$/;
    if (hostname.includes(":") && !regex.test(hostname)) throw new Error('invalid IPv6 address format');
    return { username, password, hostname, port };
}

async function socks5Connect(addressType, addressRemote, portRemote, socks5Address) {
    const { username, password, hostname, port } = socks5Address;
    const socket = await connectWithTimeout(hostname, port);
    const writer = socket.writable.getWriter();
    const reader = socket.readable.getReader();
    const encoder = new TextEncoder();
    await writer.write(new Uint8Array([5, 2, 0, 2]));
    let res = (await reader.read()).value;
    if (res[0] !== 5 || res[1] === 255) throw new Error("SOCKS5 connection failed");
    if (res[1] === 2) {
        if (!username || !password) throw new Error("SOCKS5 auth required");
        const authRequest = new Uint8Array([1, username.length, ...encoder.encode(username), password.length, ...encoder.encode(password)]);
        await writer.write(authRequest);
        res = (await reader.read()).value;
        if (res[1] !== 0) throw new Error("SOCKS5 auth failed");
    }
    let DSTADDR;
    switch (addressType) {
        case 1: DSTADDR = new Uint8Array([1, ...addressRemote.split('.').map(Number)]); break;
        case 2: DSTADDR = new Uint8Array([3, addressRemote.length, ...encoder.encode(addressRemote)]); break;
        case 3: DSTADDR = new Uint8Array([4, ...addressRemote.split(':').flatMap(x => [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2), 16)])]); break;
    }
    
    await writer.write(new Uint8Array([5, 1, 0, ...DSTADDR, portRemote >> 8, portRemote & 0xff]));
    res = (await reader.read()).value;
    if (res[1] !== 0) throw new Error("SOCKS5 final connection failed");
    writer.releaseLock();
    reader.releaseLock();
    return socket;
}

async function httpConnect(addressType, addressRemote, portRemote, socks5Address) {
    const { username, password, hostname, port } = socks5Address;
    const sock = await connectWithTimeout(hostname, port);
    let connectRequest = `CONNECT ${addressRemote}:${portRemote} HTTP/1.1\r\nHost: ${addressRemote}:${portRemote}\r\n`;
    if (username && password) {
        connectRequest += `Proxy-Authorization: Basic ${btoa(`${username}:${password}`)}\r\n`;
    }
    connectRequest += `User-Agent: Mozilla/5.0\r\n\r\n`;
    await sock.writable.getWriter().write(new TextEncoder().encode(connectRequest));
    const reader = sock.readable.getReader();
    const { value } = await reader.read();
    if (!new TextDecoder().decode(value).startsWith('HTTP/1.1 200')) throw new Error('HTTP proxy connection failed');
    reader.releaseLock();
    return sock;
}

async function handleUDPOutBound(webSocket, vlessResponseHeader, rawClientData) {
    let isVlessHeaderSent = false;
    const transformStream = new TransformStream({
        transform(chunk, controller) {
            const udpPacketLength = new DataView(chunk.slice(0, 2).buffer).getUint16(0);
            controller.enqueue(chunk.slice(2, 2 + udpPacketLength));
        },
    });
    
    const writer = transformStream.writable.getWriter();
    writer.write(rawClientData);

    transformStream.readable.pipeTo(new WritableStream({
        async write(chunk) {
            const resp = await fetch('https://1.1.1.1/dns-query', {
                method: 'POST', headers: { 'content-type': 'application/dns-message' }, body: chunk,
            });
            const dnsQueryResult = await resp.arrayBuffer();
            const udpSize = dnsQueryResult.byteLength;
            const udpSizeBuffer = new Uint8Array([(udpSize >> 8) & 0xff, udpSize & 0xff]);
            if (webSocket.readyState === 1) {
                const packetToSend = isVlessHeaderSent
                    ? new Blob([udpSizeBuffer, dnsQueryResult])
                    : new Blob([vlessResponseHeader, udpSizeBuffer, dnsQueryResult]);
                webSocket.send(await packetToSend.arrayBuffer());
                isVlessHeaderSent = true;
            }
        }
    }));
}

function getProxyConfiguration(ProxyIP, ProxyPort) {
    if (!ProxyIP || ProxyIP === '') ProxyIP = PROXY_IPS[0] || '';
    if (ProxyIP.includes(']:')) {
        ProxyPort = ProxyIP.split(']:')[1] || ProxyPort;
        ProxyIP = ProxyIP.split(']:')[0] + "]";
    } else if (ProxyIP.includes(':')) {
        const parts = ProxyIP.split(':');
        ProxyIP = parts[0];
        ProxyPort = parseInt(parts[1]) || ProxyPort;
    }
    return { ip: ProxyIP, port: ProxyPort };
}
