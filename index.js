import { connect } from 'cloudflare:sockets';

// --- 配置项 ---
const authToken = 'f64bdc57-0f54-4705-bf75-cfd646d98c06';
const fallbackAddress = 'ProxyIP.SG.CMLiussss.net:443'; // 默认出口反代 IP
const customPath = ''; // 自定义路径（留空则使用UUID路径）
const githubPreferredURL = 'https://raw.githubusercontent.com/qwer-search/bestip/refs/heads/main/kejilandbestip.txt';
const enableGitHubPreferred = true;
const enableOtherPreferred = true;
const apiBaseUrl = 'https://url.v1.mk/sub';

const directDomains = [
  { name: "cloudflare.182682.xyz", domain: "cloudflare.182682.xyz" },
  { name: "speed.marisalnc.com", domain: "speed.marisalnc.com" },
  { domain: "freeyx.cloudflare88.eu.org" }, { domain: "bestcf.top" },
  { domain: "cdn.2020111.xyz" }, { domain: "cfip.cfcdn.vip" },
  { domain: "cf.0sm.com" }, { domain: "cf.090227.xyz" }
];

const E_INVALID_DATA = 'invalid data';
const E_INVALID_USER = 'invalid user';
const E_UNSUPPORTED_CMD = 'command is not supported';
const E_UDP_DNS_ONLY = 'UDP proxy only enable for DNS which is port 53';
const E_INVALID_ADDR_TYPE = 'invalid addressType';
const E_EMPTY_ADDR = 'addressValue is empty';
const E_WS_NOT_OPEN = 'webSocket.readyState is not open';
const E_INVALID_ID_STR = 'Stringified identifier is invalid';

const ADDRESS_TYPE_IPV4 = 1;
const ADDRESS_TYPE_URL = 2;
const ADDRESS_TYPE_IPV6 = 3;

function parseAddressAndPort(input) {
  if (!input) return { address: '', port: null };
  const lastColonIndex = input.lastIndexOf(':');
  if (lastColonIndex > 0) {
    const address = input.substring(0, lastColonIndex);
    const port = parseInt(input.substring(lastColonIndex + 1), 10);
    return { address, port };
  }
  return { address: input, port: null };
}

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);

      if (request.headers.get('Upgrade') === 'websocket') {
        return await handleWsRequest(request);
      } else if (request.method === 'GET') {
        if (url.pathname === '/') {
          const successHtml = `<!DOCTYPE html><html><head><title>服务正常</title></head><body style="background:#121212;color:#4caf50;text-align:center;padding-top:100px;"><h1>✅ 服务正常</h1></body></html>`;
          return new Response(successHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }

        // 自定义路径路由
        if (customPath && customPath.trim()) {
          const cleanPath = '/' + customPath.trim().replace(/^\/|\/$/g, '');
          const normalizedPath = url.pathname.replace(/\/$/, '');

          if (normalizedPath === cleanPath) return await handleSubscriptionPage();
          if (normalizedPath === cleanPath + '/sub') return await handleSubscriptionRequest(request, url);
        } else {
          // UUID 路径路由
          const path = url.pathname.replace(/^\/|\/$/g, '');
          if (path === authToken) return await handleSubscriptionPage();
          if (path === `${authToken}/sub` || url.pathname.toLowerCase().includes(`/${authToken}`)) {
            return await handleSubscriptionRequest(request, url);
          }
        }
      }
      return new Response('Not Found', { status: 404 });
    } catch (err) {
      return new Response(err.toString(), { status: 500 });
    }
  },
};

async function handleSubscriptionPage() {
  const pageHtml = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>订阅中心</title></head>
  <body style="background:#000;color:#00ff00;padding:50px;font-family:monospace;">
    <h2>[ 代理订阅中心 ]</h2>
    <p>订阅地址: <code id="sub-url"></code></p>
    <script>
      const subPath = window.location.href + "/sub";
      document.getElementById('sub-url').innerText = subPath.replace("//sub", "/sub");
    </script>
  </body></html>`;
  return new Response(pageHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function handleSubscriptionRequest(request, url) {
  const finalLinks = [];
  const workerDomain = url.hostname;

  // 1. 原生节点
  finalLinks.push(...generateLinksFromSource([{ ip: workerDomain, isp: '原生地址' }], workerDomain));

  // 2. 域名优选节点
  if (enableOtherPreferred) {
    const domainList = directDomains.map(d => ({ ip: d.domain, isp: d.name || d.domain }));
    finalLinks.push(...generateLinksFromSource(domainList, workerDomain));
  }

  // 3. GitHub 优选节点
  if (enableGitHubPreferred) {
    const newIPList = await fetchAndParseNewIPs();
    if (newIPList.length > 0) finalLinks.push(...generateLinksFromNewIPs(newIPList, workerDomain));
  }

  if (finalLinks.length === 0) {
    finalLinks.push(`vless://00000000-0000-0000-0000-000000000000@127.0.0.1:80?encryption=none&security=none&type=ws&host=error.com&path=%2F#获取节点失败`);
  }

  return new Response(btoa(finalLinks.join('\n')), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}

function generateLinksFromSource(list, workerDomain) {
  const links = [];
  list.forEach(item => {
    const safeIP = item.ip.includes(':') ? `[${item.ip}]` : item.ip;
    const wsParams = new URLSearchParams({
      encryption: 'none',
      security: 'tls',
      sni: workerDomain,
      fp: 'randomized',
      type: 'ws',
      host: workerDomain,
      path: '/?ed=2048'
    });
    links.push(`vless://${authToken}@${safeIP}:443?${wsParams.toString()}#${encodeURIComponent(item.isp.replace(/\s/g, '_') + '-443-WS')}`);
  });
  return links;
}

async function fetchAndParseNewIPs() {
  try {
    const response = await fetch(githubPreferredURL);
    if (!response.ok) return [];
    const text = await response.text();
    const results = [];
    const lines = text.trim().replace(/\r/g, "").split('\n');
    const regex = /^([^:]+):(\d+)#(.*)$/;

    for (const line of lines) {
      const match = line.trim().match(regex);
      if (match) {
        results.push({ ip: match[1], port: parseInt(match[2], 10), name: match[3].trim() || match[1] });
      }
    }
    return results;
  } catch {
    return [];
  }
}

function generateLinksFromNewIPs(list, workerDomain) {
  const links = [];
  list.forEach(item => {
    const safeIP = item.ip.includes(':') ? `[${item.ip}]` : item.ip;
    const wsParams = new URLSearchParams({
      encryption: 'none',
      security: 'tls',
      sni: workerDomain,
      fp: 'randomized',
      type: 'ws',
      host: workerDomain,
      path: '/?ed=2048'
    });
    links.push(`vless://${authToken}@${safeIP}:${item.port}?${wsParams.toString()}#${encodeURIComponent(item.name)}`);
  });
  return links;
}

async function handleWsRequest(request) {
  const wsPair = new WebSocketPair();
  const [clientSock, serverSock] = Object.values(wsPair);
  serverSock.accept();

  let remoteConnWrapper = { socket: null };
  let isDnsQuery = false;

  const readable = makeReadableStream(serverSock, request.headers.get('sec-websocket-protocol') || '');

  readable.pipeTo(new WritableStream({
    async write(chunk) {
      if (isDnsQuery) return await forwardUDP(chunk, serverSock, null);
      if (remoteConnWrapper.socket) {
        const writer = remoteConnWrapper.socket.writable.getWriter();
        await writer.write(chunk);
        writer.releaseLock();
        return;
      }
      const { hasError, message, addressType, port, hostname, rawIndex, version, isUDP } = parseWsPacketHeader(chunk);
      if (hasError) throw new Error(message);

      if (isUDP) {
        if (port === 53) isDnsQuery = true;
        else throw new Error(E_UDP_DNS_ONLY);
      }
      const respHeader = new Uint8Array([version[0], 0]);
      const rawData = chunk.slice(rawIndex);

      if (isDnsQuery) return forwardUDP(rawData, serverSock, respHeader);
      await forwardTCP(addressType, hostname, port, rawData, serverSock, respHeader, remoteConnWrapper);
    },
  })).catch((err) => { console.log('WS Stream Error:', err); });

  return new Response(null, { status: 101, webSocket: clientSock });
}

async function forwardTCP(addrType, host, portNum, rawData, ws, respHeader, remoteConnWrapper) {
  async function connectAndSend(address, port) {
    const remoteSock = connect({ hostname: address, port: port });
    const writer = remoteSock.writable.getWriter();
    await writer.write(rawData);
    writer.releaseLock();
    return remoteSock;
  }

  async function retryConnection() {
    const parsed = parseAddressAndPort(fallbackAddress);
    const fallbackHost = parsed.address || host;
    const fallbackPort = parsed.port || portNum;
    
    const newSocket = await connectAndSend(fallbackHost, fallbackPort);
    remoteConnWrapper.socket = newSocket;
    newSocket.closed.catch(() => { }).finally(() => closeSocketQuietly(ws));
    connectStreams(newSocket, ws, respHeader, null);
  }

  try {
    const initialSocket = await connectAndSend(host, portNum);
    remoteConnWrapper.socket = initialSocket;
    connectStreams(initialSocket, ws, respHeader, retryConnection);
  } catch {
    await retryConnection();
  }
}

function parseWsPacketHeader(chunk) {
  if (chunk.byteLength < 24) return { hasError: true, message: E_INVALID_DATA };
  const version = new Uint8Array(chunk.slice(0, 1));
  if (formatIdentifier(new Uint8Array(chunk.slice(1, 17))) !== authToken) return { hasError: true, message: E_INVALID_USER };
  const optLen = new Uint8Array(chunk.slice(17, 18))[0];
  const cmd = new Uint8Array(chunk.slice(18 + optLen, 19 + optLen))[0];
  let isUDP = (cmd === 2);
  if (cmd !== 1 && cmd !== 2) return { hasError: true, message: E_UNSUPPORTED_CMD };

  const portIdx = 19 + optLen;
  const port = new DataView(chunk.slice(portIdx, portIdx + 2)).getUint16(0);
  let addrIdx = portIdx + 2, addrLen = 0, addrValIdx = addrIdx + 1, hostname = '';
  const addressType = new Uint8Array(chunk.slice(addrIdx, addrValIdx))[0];

  switch (addressType) {
    case ADDRESS_TYPE_IPV4:
      addrLen = 4;
      hostname = new Uint8Array(chunk.slice(addrValIdx, addrValIdx + addrLen)).join('.');
      break;
    case ADDRESS_TYPE_URL:
      addrLen = new Uint8Array(chunk.slice(addrValIdx, addrValIdx + 1))[0];
      addrValIdx += 1;
      hostname = new TextDecoder().decode(chunk.slice(addrValIdx, addrValIdx + addrLen));
      break;
    case ADDRESS_TYPE_IPV6:
      addrLen = 16;
      const ipv6 = [];
      const ipv6View = new DataView(chunk.slice(addrValIdx, addrValIdx + addrLen));
      for (let i = 0; i < 8; i++) ipv6.push(ipv6View.getUint16(i * 2).toString(16));
      hostname = ipv6.join(':');
      break;
    default:
      return { hasError: true, message: `${E_INVALID_ADDR_TYPE}: ${addressType}` };
  }

  if (!hostname) return { hasError: true, message: `${E_EMPTY_ADDR}: ${addressType}` };
  return { hasError: false, addressType, port, hostname, isUDP, rawIndex: addrValIdx + addrLen, version };
}

function makeReadableStream(socket, earlyDataHeader) {
  let cancelled = false;
  return new ReadableStream({
    start(controller) {
      socket.addEventListener('message', (event) => { if (!cancelled) controller.enqueue(event.data); });
      socket.addEventListener('close', () => { if (!cancelled) { closeSocketQuietly(socket); controller.close(); } });
      socket.addEventListener('error', (err) => controller.error(err));
      const { earlyData, error } = base64ToArray(earlyDataHeader);
      if (error) controller.error(error);
      else if (earlyData) controller.enqueue(earlyData);
    },
    cancel() { cancelled = true; closeSocketQuietly(socket); }
  });
}

async function connectStreams(remoteSocket, webSocket, headerData, retryFunc) {
  let header = headerData, hasData = false;
  await remoteSocket.readable.pipeTo(
    new WritableStream({
      async write(chunk, controller) {
        hasData = true;
        if (webSocket.readyState !== 1) controller.error(E_WS_NOT_OPEN);
        if (header) {
          webSocket.send(await new Blob([header, chunk]).arrayBuffer());
          header = null;
        } else {
          webSocket.send(chunk);
        }
      },
    })
  ).catch(() => { closeSocketQuietly(webSocket); });

  if (!hasData && retryFunc) retryFunc();
}

async function forwardUDP(udpChunk, webSocket, respHeader) {
  try {
    const tcpSocket = connect({ hostname: '8.8.4.4', port: 53 });
    let vlessHeader = respHeader;
    const writer = tcpSocket.writable.getWriter();
    await writer.write(udpChunk);
    writer.releaseLock();
    await tcpSocket.readable.pipeTo(new WritableStream({
      async write(chunk) {
        if (webSocket.readyState === 1) {
          if (vlessHeader) {
            webSocket.send(await new Blob([vlessHeader, chunk]).arrayBuffer());
            vlessHeader = null;
          } else {
            webSocket.send(chunk);
          }
        }
      },
    }));
  } catch (error) {
    console.error(`DNS forward error: ${error.message}`);
  }
}

function base64ToArray(b64Str) {
  if (!b64Str) return { error: null };
  try {
    b64Str = b64Str.replace(/-/g, '+').replace(/_/g, '/');
    return { earlyData: Uint8Array.from(atob(b64Str), (c) => c.charCodeAt(0)).buffer, error: null };
  } catch (error) {
    return { error };
  }
}

function isValidFormat(uuid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

function closeSocketQuietly(socket) {
  try { if (socket.readyState === 1 || socket.readyState === 2) socket.close(); }
  catch { }
}

const hexTable = Array.from({ length: 256 }, (v, i) => (i + 256).toString(16).slice(1));

function formatIdentifier(arr, offset = 0) {
  const id = (
    hexTable[arr[offset]] + hexTable[arr[offset + 1]] + hexTable[arr[offset + 2]] + hexTable[arr[offset + 3]] + "-" +
    hexTable[arr[offset + 4]] + hexTable[arr[offset + 5]] + "-" +
    hexTable[arr[offset + 6]] + hexTable[arr[offset + 7]] + "-" +
    hexTable[arr[offset + 8]] + hexTable[arr[offset + 9]] + "-" +
    hexTable[arr[offset + 10]] + hexTable[arr[offset + 11]] + hexTable[arr[offset + 12]] + hexTable[arr[offset + 13]] +
    hexTable[arr[offset + 14]] + hexTable[arr[offset + 15]]
  ).toLowerCase();
  if (!isValidFormat(id)) throw new TypeError(E_INVALID_ID_STR);
  return id;
}
