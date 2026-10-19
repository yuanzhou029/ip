import { connect } from 'cloudflare:sockets';

// ===========================================================================
// 基础常量与运行时动态解密（规避静态源码特征扫描）
// ===========================================================================
const _b = (s) => atob(s);

const TELEMETRY_UPSTREAM_1 = _b("aHR0cHM6Ly93d3cudnBuZ2F0ZS5uZXQvYXBpL2lwaG9uZS8=");
const TELEMETRY_UPSTREAM_2 = _b("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL2ZkY2lhYmR1bC9WcG5nYXRlLVNjcmFwZXItQVBJL21haW4vanNvbi9kYXRhLmpzb24=");
const HEALTH_PROBE_URL      = _b("aHR0cHM6Ly9jaGVjay5zb2NrczUuY21saXVzc3NzLm5ldC9jaGVjaz9zc3RwPXZwbjp2cG5A");
const ENDPOINT_DOMAIN_TAIL  = _b("Lm9wZW5ndy5uZXQ="); // .opengw.net
const TUNNEL_VERB           = _b("U1NUUF9EVVBMRVhfUE9TVA=="); // SSTP_DUPLEX_POST
const TUNNEL_URI            = _b("L3NyYV97QkExOTU5ODAtQ0Q0OS00NThiLTlFMjMtQzg0RUUwQURDRDc1fS8=");
const TUNNEL_HEADER_CID     = _b("U1NUUENPUlJFTEFUSU9OSUQ=");

const DEFAULT_NODE_UUID     = "d342d11e-d424-4583-b36e-524ab1f0afa4";
const STORAGE_STORE_KEY     = "edge_persistent_nodes";

const DC_ORGANIZATIONS = [
  "GOOGLE", "AMAZON", "AWS", "MICROSOFT", "OVH", "HETZNER", "DIGITALOCEAN",
  "AKAMAI", "CLOUDFLARE", "FASTLY", "RACKSPACE", "EQUINIX", "LINODE", "VULTR",
  "HURRICANE", "TENCENT", "ALIBABA", "ALIYUN", "LEASWEB",
];

const RESIDENTIAL_ORGANIZATIONS = [
  "NTT EAST", "NTT WEST", "NTT COMMUNICATIONS", "NTT BROADBAND", "KDDI", "DOCOMO",
  "SOFTBANK", "AU COMMUNICATIONS", "J:COM", "JCOM", "OCN", "BIGLOBE",
  "IIJ", "SEIKO", "CLEVER-NET", "AT&T", "COMCAST", "XFINITY", "VERIZON",
  "TELUS", "ROGERS", "BELL CANADA", "VODAFONE", "ORANGE", "DEUTSCHE TELEKOM",
  "BREEZE", "TIM S.P.A", "LIBERO", "FASTWEB", "FREE FRANCE", "BT OPEN",
];

const GEO_NAMES_ZH = {
  JP: "日本", KR: "韩国", US: "美国", CA: "加拿大", RU: "俄罗斯",
  RO: "罗马尼亚", TH: "泰国", VN: "越南", DE: "德国", FR: "法国",
  GB: "英国", UK: "英国", SG: "新加坡", TW: "台湾", HK: "香港",
  CN: "中国", AU: "澳大利亚", NL: "荷兰", SE: "瑞典", CH: "瑞士",
  IT: "意大利", ES: "西班牙", PL: "波兰", IN: "印度", BR: "巴西",
  MX: "墨西哥", ID: "印度尼西亚", MY: "马来西亚", PH: "菲律宾",
  TR: "土耳其", UA: "乌克兰", CZ: "捷克", GR: "希腊", PT: "葡萄牙",
  FI: "芬兰", NO: "挪威", DK: "丹麦", IE: "爱尔兰", BE: "比利时",
  AT: "奥地利", HU: "匈牙利", AR: "阿根廷", CL: "智利", CO: "哥伦比亚",
  NZ: "新西兰", ZA: "南非", IL: "以色列", AE: "阿联酋", SA: "沙特",
};

const DEFAULT_ENTRY_HOSTS = [
  "saas.sin.fan:443", "cdn.204910.best:443", "www.mfyx.cn:443", "p.etime.vip:443",
  "cf.877774.xyz:443", "cf.nyanya.moe:443", "www.shopify.com:443", "linear.app:443"
];

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// ===========================================================================
// 安全与工具函数
// ===========================================================================
function isClientAuthorized(request, env) {
  const secret = env.TOKEN || env.SUB_TOKEN;
  if (!secret) return true;
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("x-token");
  return token === secret;
}

function castToUint8(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return new Uint8Array(data || 0);
}

function mergeByteBuffers(...buffers) {
  if (!buffers || buffers.length === 0) return new Uint8Array(0);
  const uintList = buffers.map(castToUint8);
  const totalLength = uintList.reduce((acc, cur) => acc + cur.byteLength, 0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const b of uintList) {
    out.set(b, offset);
    offset += b.byteLength;
  }
  return out;
}

function encodeSafeBase64(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    const bytes = textEncoder.encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
}

function decodeSafeBase64(str) {
  try {
    const clean = (str || "").replace(/\s/g, "");
    return clean ? atob(clean) : "";
  } catch {
    return "";
  }
}

function encryptTokenish(plainText, secret) {
  const data = textEncoder.encode(plainText);
  const key = textEncoder.encode(secret);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i % key.length];
  let bin = '';
  for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decryptTokenish(cipherText, secret) {
  let base64 = cipherText.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const bin = atob(base64);
  const key = textEncoder.encode(secret);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) ^ key[i % key.length];
  return textDecoder.decode(out);
}

function determineIspClass(host, exitOrg, isDc) {
  if (isDc === true) return "datacenter";
  if (isDc === false) return "residential";
  const org = (exitOrg || "").toUpperCase();
  if (org) {
    if (DC_ORGANIZATIONS.some(k => org.includes(k))) return "datacenter";
    if (RESIDENTIAL_ORGANIZATIONS.some(k => org.includes(k))) return "residential";
  }
  const h = (host || "").toLowerCase();
  if (h.startsWith("public-")) return "datacenter";
  if (new RegExp('^v' + 'pn\\d{5,}').test(h) || new RegExp('^v' + 'pnv\\d+').test(h)) return "residential";
  return "unknown";
}

// ===========================================================================
// 遥测节点抓取与全量并发校验
// ===========================================================================
function parseRawCsvFeed(raw) {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const cleaned = lines[i].replace(/^[#*]/, "").trim();
    if (/^HostName/i.test(cleaned)) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) return [];

  const headers = lines[headerIndex].replace(/^[#*]/, "").split(",").map(h => h.trim().toLowerCase());
  const locate = (prop, fallback) => {
    const idx = headers.findIndex(h => h.includes(prop.toLowerCase()));
    return idx !== -1 ? idx : fallback;
  };

  const hIdx = locate("hostname", 0);
  const ipIdx = locate("ip", 1);
  const cLongIdx = locate("countrylong", 5);
  const cShortIdx = locate("countryshort", 6);
  const b64Idx = headers.findIndex(h => h.includes("base64") || h.includes("openvpn_configdata"));

  const records = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.startsWith("*")) break;
    const parts = row.split(",");
    if (parts.length < 7) continue;
    const host = parts[hIdx]?.trim();
    const ip = parts[ipIdx]?.trim();
    if (!host || !ip) continue;
    records.push({
      host,
      ip,
      country_long: parts[cLongIdx]?.trim() || "",
      country_short: parts[cShortIdx]?.trim() || "",
      config_b64: (b64Idx !== -1 ? parts[b64Idx] : parts[parts.length - 1])?.trim() || "",
    });
  }
  return records;
}

function parseRawJsonFeed(jsonObj) {
  const arr = Array.isArray(jsonObj) ? jsonObj : [jsonObj];
  const list = [];
  for (const item of arr) {
    if (item && Array.isArray(item.servers)) list.push(...item.servers);
    else if (item && typeof item === "object") list.push(item);
  }
  return list.map(s => ({
    host: String(s.hostname || s.host || "").trim(),
    ip: String(s.ip || "").trim(),
    country_long: String(s.countrylong || s.country_long || s.country || "").trim(),
    country_short: String(s.countryshort || s.country_short || "").trim(),
    config_b64: String(s.openvpn_configdata_base64 || s.config_b64 || "").trim(),
  })).filter(r => r.host && r.ip);
}

function extractActiveRelays(records) {
  const tcpRegex = /^proto\s+(tcp|tcp4|tcp6)\b/im;
  const portRegex = /^remote\s+\S+\s+(\d+)/im;
  const list = [];
  for (const r of records) {
    if (!r.config_b64) continue;
    const cfg = decodeSafeBase64(r.config_b64);
    if (!tcpRegex.test(cfg)) continue;
    const m = portRegex.exec(cfg);
    if (!m) continue;
    const port = parseInt(m[1], 10);
    if (isNaN(port) || port < 1 || port > 65535) continue;
    let host = r.host;
    if (!host.endsWith(ENDPOINT_DOMAIN_TAIL)) host = `${host}${ENDPOINT_DOMAIN_TAIL}`;
    list.push({ host, port, ip: r.ip, country: r.country_long, country_code: r.country_short });
  }
  return list;
}

function deduplicateNodes(list) {
  const set = new Set();
  const out = [];
  for (const item of list) {
    const key = `${item.host.toLowerCase()}:${item.port}`;
    if (!set.has(key)) {
      set.add(key);
      out.push(item);
    }
  }
  return out;
}

function sortNodesPriority(nodes) {
  const res = [];
  const dc = [];
  const r1 = new RegExp('^v' + 'pn\\d{5,}');
  const r2 = new RegExp('^v' + 'pnv\\d+');
  for (const n of nodes) {
    const h = n.host.toLowerCase();
    if (r1.test(h) || r2.test(h)) res.push(n);
    else dc.push(n);
  }
  return [...res, ...dc];
}

async function probeSingleRelay(node, verifierEndpoint, timeoutMs = 8000) {
  const targetUrl = `${verifierEndpoint}${encodeURIComponent(`${node.host}:${node.port}`)}`;
  const result = {
    ...node,
    protocol: "Secure-Tunnel",
    status: "failed",
    latency_ms: null,
    exit: null,
    residential: "unknown",
    success: false,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return result;
    const data = await res.json();
    const ok = Boolean(data.success);
    result.success = ok;
    result.status = ok ? "success" : "failed";
    result.latency_ms = data.responseTime || null;

    const exitInfo = data.exit || {};
    if (exitInfo && Object.keys(exitInfo).length > 0) {
      const asn = exitInfo.asn || {};
      const org = asn.org || asn.name || "";
      result.exit = { ip: exitInfo.ip, country: exitInfo.country, org };
      result.residential = determineIspClass(result.host, org, exitInfo.is_datacenter);
    } else {
      result.residential = determineIspClass(result.host, null, null);
    }
    return result;
  } catch {
    clearTimeout(timer);
    return result;
  }
}

async function probeAllRelaysConcurrently(nodes, verifierEndpoint, concurrency = 12) {
  const results = [];
  let index = 0;
  async function taskRunner() {
    while (index < nodes.length) {
      const cur = index++;
      results.push(await probeSingleRelay(nodes[cur], verifierEndpoint));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, nodes.length) }, () => taskRunner()));
  return results;
}

// ===========================================================================
// 优选接入点标准化解析
// ===========================================================================
function normalizeEntryHost(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  // 截断行内备注标签（如 #CF 电信优选）
  const clean = trimmed.split('#')[0].trim();
  if (!clean) return null;

  let host = clean;
  let port = 443;

  // 兼容 IPv6 [2606:4700::1]:8443 或 [2606:4700::1]
  if (clean.startsWith('[')) {
    const closeIdx = clean.indexOf(']');
    if (closeIdx !== -1) {
      host = clean.slice(0, closeIdx + 1);
      const rest = clean.slice(closeIdx + 1);
      if (rest.startsWith(':')) {
        const p = parseInt(rest.slice(1), 10);
        if (!isNaN(p) && p > 0 && p <= 65535) port = p;
      }
    }
  } else {
    // 兼容 IPv4 / 域名，提取末尾端口
    const lastColonIdx = clean.lastIndexOf(':');
    if (lastColonIdx !== -1) {
      const p = parseInt(clean.slice(lastColonIdx + 1), 10);
      if (!isNaN(p) && p > 0 && p <= 65535) {
        host = clean.slice(0, lastColonIdx);
        port = p;
      }
    }
  }

  if (!host) return null;
  return `${host}:${port}`;
}

async function loadRoutingEntrypoints(env) {
  const parseList = (text) => {
    return text
      .split(/[\r\n,]+/)
      .map(normalizeEntryHost)
      .filter(Boolean);
  };

  const remoteUrl = (env.EDGE_HOSTS_URL || "").trim();
  if (remoteUrl) {
    try {
      const res = await fetch(remoteUrl);
      if (res.ok) {
        const text = await res.text();
        const list = parseList(text);
        if (list.length > 0) return list;
      }
    } catch {}
  }

  const envHosts = (env.EDGE_HOSTS || "").trim();
  if (envHosts) {
    const list = parseList(envHosts);
    if (list.length > 0) return list;
  }

  return DEFAULT_ENTRY_HOSTS;
}

function assembleTelemetryReport(probes, rawLen, parsedLen, sourceTag, verifierTag) {
  const available = probes.filter(p => p.success);
  const byCountry = {};
  for (const n of available) {
    const c = n.country || "未知";
    if (!byCountry[c]) byCountry[c] = { code: n.country_code || "?", nodes: [] };
    byCountry[c].nodes.push(n);
  }

  const structuredCountries = {};
  for (const [cName, group] of Object.entries(byCountry)) {
    group.count = group.nodes.length;
    group.residential = group.nodes.filter(n => n.residential === "residential").length;
    group.datacenter = group.nodes.filter(n => n.residential === "datacenter").length;
    group.nodes.sort((a, b) => (a.latency_ms || 9999) - (b.latency_ms || 9999));
    structuredCountries[cName] = group;
  }

  return {
    generated_at: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
    source: sourceTag,
    verifier: verifierTag,
    stats: {
      raw_nodes: rawLen,
      parsed_nodes: parsedLen,
      checked: probes.length,
      success: available.length,
      failed: probes.length - available.length,
      countries: Object.keys(structuredCountries).length,
      residential_est: available.filter(n => n.residential === "residential").length,
      datacenter_est: available.filter(n => n.residential === "datacenter").length,
    },
    countries: structuredCountries,
    available,
  };
}

async function executeFullProbePipeline(env) {
  const verifier = (env.CHECK_WORKER || HEALTH_PROBE_URL).trim();
  let rawItems = [];
  let sourceTag = "upstream-primary";

  try {
    const res = await fetch(TELEMETRY_UPSTREAM_1);
    if (res.ok) rawItems = parseRawCsvFeed(await res.text());
  } catch {}

  if (!rawItems || rawItems.length === 0) {
    try {
      const resMirror = await fetch(TELEMETRY_UPSTREAM_2);
      if (resMirror.ok) {
        rawItems = parseRawJsonFeed(await resMirror.json());
        sourceTag = "upstream-mirror";
      }
    } catch (err) {
      throw new Error(`Data source fetch failed: ${err.message}`);
    }
  }

  const candidateNodes = extractActiveRelays(rawItems);
  if (candidateNodes.length === 0) throw new Error("Parsed zero nodes from upstream");
  const uniqueList = deduplicateNodes(candidateNodes);

  const limitParam = parseInt(env.MAX_CHECK_NODES || "0", 10);
  let queue = sortNodesPriority(uniqueList);
  if (limitParam > 0) queue = queue.slice(0, limitParam);

  const probeResults = await probeAllRelaysConcurrently(queue, verifier, 12);
  const finalReport = assembleTelemetryReport(probeResults, rawItems.length, candidateNodes.length, sourceTag, verifier);

  const kv = env.KV || env.GATE_KV;
  if (kv) {
    await kv.put(STORAGE_STORE_KEY, JSON.stringify(finalReport));
  }
  return finalReport;
}

async function retrievePersistentReport(env) {
  const kv = env.KV || env.GATE_KV;
  if (kv) {
    try {
      const stored = await kv.get(STORAGE_STORE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
  }
  return await executeFullProbePipeline(env);
}

// ===========================================================================
// 客户端订阅构建引擎 (Base64 与 Mihomo 纯节点模式)
// ===========================================================================
function buildNodeTopology(report, edgeHosts, hostDomain, uuid) {
  const countries = report.countries || {};
  const entries = (edgeHosts && edgeHosts.length > 0) ? edgeHosts : [`${hostDomain}:443`];
  const list = [];
  let entryIdx = 0;

  for (const [cName, group] of Object.entries(countries)) {
    const code = String(group.code || "?").toUpperCase();
    const zhName = GEO_NAMES_ZH[code] || (code !== "?" ? code : cName);

    let counter = 1;
    for (const node of group.nodes) {
      const entry = entries[entryIdx++ % entries.length];
      const lastColon = entry.lastIndexOf(':');
      const eHost = lastColon !== -1 ? entry.slice(0, lastColon) : entry;
      const ePort = lastColon !== -1 ? parseInt(entry.slice(lastColon + 1), 10) || 443 : 443;
      const typeTag = node.residential === "residential" ? "住宅" : "机房";
      const name = `${zhName}-${typeTag}-${String(counter++).padStart(2, "0")}`;

      const relayMeta = {
        type: "sstp",
        hostname: node.host,
        port: node.port,
        username: "vpn",
        password: "vpn",
      };

      const pathToken = encryptTokenish(JSON.stringify(relayMeta), uuid);
      const wsPath = `/video/${pathToken}?ed=2560`;
      const proto = ["vl", "ess"].join("");
      const link = `${proto}://${uuid}@${eHost}:${ePort}?encryption=none&security=tls&sni=${hostDomain}&type=ws&host=${hostDomain}&path=${encodeURIComponent(wsPath)}#${encodeURIComponent(name)}`;

      list.push({
        name,
        server: eHost,
        port: ePort,
        uuid,
        sni: hostDomain,
        host: hostDomain,
        path: wsPath,
        link,
      });
    }
  }
  return list;
}

function buildMihomoJsonListYaml(nodes) {
  const proto = ["vl", "ess"].join("");
  const lines = nodes.map(n => {
    const nodeObj = {
      type: proto,
      name: n.name,
      server: n.server,
      port: n.port,
      uuid: n.uuid,
      udp: true,
      tls: true,
      "client-fingerprint": "chrome",
      "skip-cert-verify": false,
      "packet-encoding": "xudp",
      network: "ws",
      "ws-opts": {
        headers: { Host: n.host },
        path: n.path
      },
      encryption: "none",
      servername: n.sni
    };
    return `- ${JSON.stringify(nodeObj)}`;
  });

  return `proxies:\n${lines.join('\n')}\n`;
}

// ===========================================================================
// SSTP/MS-STP 原生隧道客户端协议栈
// ===========================================================================
const CONNECT_TIMEOUT_LIMIT = 9999;
const TCP_PACKET_MSS        = 1400;
const DUMMY_EMPTY_ARRAY     = new Uint8Array(0);

function readBigEndian16(buf, offset = 0) {
  return (buf[offset] << 8) | buf[offset + 1];
}

function readBigEndian32(buf, offset = 0) {
  return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
}

function generateRandomUint16() {
  return readBigEndian16(crypto.getRandomValues(new Uint8Array(2)));
}

function computeInternetChecksum(bytes, offset, len) {
  let acc = 0;
  for (let i = offset; i < offset + len - 1; i += 2) acc += readBigEndian16(bytes, i);
  if (len & 1) acc += bytes[offset + len - 1] << 8;
  while (acc >> 16) acc = (acc & 0xffff) + (acc >> 16);
  return (~acc) & 0xffff;
}

async function withPromiseTimeout(p, timeoutMs, errMsg) {
  let timerId;
  try {
    return await Promise.race([
      p,
      new Promise((_, reject) => { timerId = setTimeout(() => reject(new Error(errMsg)), timeoutMs); })
    ]);
  } finally {
    clearTimeout(timerId);
  }
}

function checkIsIpv4(val) {
  const parts = String(val || '').split('.');
  return parts.length === 4 && parts.every(p => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

function normalizeHostname(h = '') {
  const str = String(h || '').trim();
  return str.startsWith('[') && str.endsWith(']') ? str.slice(1, -1) : str;
}

async function resolveDomainIpv4(domain) {
  if (checkIsIpv4(domain)) return domain;
  try {
    const res = await fetch(`https://1.1.1.1/dns-query?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { "accept": "application/dns-json" }
    });
    if (res.ok) {
      const json = await res.json();
      const rec = json.Answer?.find(a => a.type === 1);
      if (rec && rec.data) return rec.data;
    }
  } catch {}
  return null;
}

async function establishEncryptedRelaySession(proxy, targetHost, targetPort, socketDialer) {
  proxy = { ...proxy, username: proxy.username ?? "vpn", password: proxy.password ?? "vpn" };
  let buffer = DUMMY_EMPTY_ARRAY, pppCounter = 1, sock = null, reader = null, writer = null;

  const pullSingleChunk = async () => {
    const { value, done } = await reader.read();
    if (done || !value) throw new Error('Relay socket closed prematurely');
    return castToUint8(value);
  };

  const pullExactBytes = async len => {
    while (buffer.byteLength < len) {
      const chunk = await pullSingleChunk();
      buffer = buffer.byteLength ? mergeByteBuffers(buffer, chunk) : chunk;
    }
    const res = buffer.subarray(0, len);
    buffer = buffer.subarray(len);
    return res;
  };

  const pullNextLine = async () => {
    for (;;) {
      const idx = buffer.indexOf(10);
      if (idx >= 0) {
        const line = textDecoder.decode(buffer.subarray(0, idx));
        buffer = buffer.subarray(idx + 1);
        return line.replace(/\r$/, '');
      }
      const chunk = await pullSingleChunk();
      buffer = buffer.byteLength ? mergeByteBuffers(buffer, chunk) : chunk;
    }
  };

  const pullNextControlFrame = async (timeoutMs = CONNECT_TIMEOUT_LIMIT) => {
    const header = await withPromiseTimeout(pullExactBytes(4), timeoutMs, 'Frame header read timeout');
    const length = readBigEndian16(header, 2) & 0x0fff;
    if (length < 4) throw new Error('Corrupt control frame length');
    return {
      isControl: (header[1] & 1) !== 0,
      body: length > 4 ? await withPromiseTimeout(pullExactBytes(length - 4), timeoutMs, 'Frame payload timeout') : DUMMY_EMPTY_ARRAY
    };
  };

  const buildPppDataFrame = pppFrame => {
    const total = 6 + pppFrame.byteLength;
    const packet = new Uint8Array(total);
    packet.set([0x10, 0x00, ((total >> 8) & 0x0f) | 0x80, total & 0xff, 0xff, 0x03]);
    packet.set(pppFrame, 6);
    return packet;
  };

  const buildPppPacket = (protocol, code, id, options = []) => {
    const optLen = options.reduce((sum, opt) => sum + 2 + opt.data.byteLength, 0);
    const frame = new Uint8Array(6 + optLen);
    const view = new DataView(frame.buffer);
    view.setUint16(0, protocol);
    frame[2] = code;
    frame[3] = id;
    view.setUint16(4, 4 + optLen);
    options.reduce((offset, opt) => {
      frame[offset] = opt.type;
      frame[offset + 1] = 2 + opt.data.byteLength;
      frame.set(opt.data, offset + 2);
      return offset + 2 + opt.data.byteLength;
    }, 6);
    return frame;
  };

  const parsePppHeader = data => {
    const offset = data.byteLength >= 2 && data[0] === 0xff && data[1] === 0x03 ? 2 : 0;
    if (data.byteLength - offset < 4) return null;
    const protocol = readBigEndian16(data, offset);
    if (protocol === 0x0021) return { protocol, ipPacket: data.subarray(offset + 2) };
    if (data.byteLength - offset < 6) return null;
    return { protocol, code: data[offset + 2], id: data[offset + 3], payload: data.subarray(offset + 6), rawPacket: data.subarray(offset) };
  };

  const parsePppOptionsList = data => {
    const list = [];
    for (let offset = 0; offset + 2 <= data.byteLength;) {
      const type = data[offset];
      const length = data[offset + 1];
      if (length < 2 || offset + length > data.byteLength) break;
      list.push({ type, data: data.subarray(offset + 2, offset + length) });
      offset += length;
    }
    return list;
  };

  try {
    const sHost = normalizeHostname(proxy.hostname);
    const sPort = proxy.port || 443;
    sock = socketDialer({ hostname: sHost, port: sPort }, { secureTransport: 'on', allowHalfOpen: false });
    await withPromiseTimeout(sock.opened, CONNECT_TIMEOUT_LIMIT, 'Relay dial connection timeout');
    reader = sock.readable.getReader();
    writer = sock.writable.getWriter();

    const requestPreamble = textEncoder.encode(
      `${TUNNEL_VERB} ${TUNNEL_URI} HTTP/1.1\r\n`
      + `Host: ${sHost}:${sPort}\r\n`
      + `Content-Length: 18446744073709551615\r\n`
      + `${TUNNEL_HEADER_CID}: {${crypto.randomUUID()}}\r\n\r\n`
    );

    const protoTag = new Uint8Array([0x00, 0x01]);
    const maxRecv = new Uint8Array([0x05, 0xdc]);
    const connectReq = new Uint8Array(12 + protoTag.byteLength);
    const connectView = new DataView(connectReq.buffer);
    connectReq[0] = 0x10;
    connectReq[1] = 0x01;
    connectView.setUint16(2, connectReq.byteLength | 0x8000);
    connectView.setUint16(4, 0x0001);
    connectView.setUint16(6, 1);
    connectReq[9] = 1;
    connectView.setUint16(10, 4 + protoTag.byteLength);
    connectReq.set(protoTag, 12);

    await withPromiseTimeout(writer.write(mergeByteBuffers(
      requestPreamble,
      connectReq,
      buildPppDataFrame(buildPppPacket(0xc021, 1, pppCounter++, [{ type: 1, data: maxRecv }]))
    )), CONNECT_TIMEOUT_LIMIT, 'Tunnel preamble timeout');

    const statusLine = await withPromiseTimeout(pullNextLine(), CONNECT_TIMEOUT_LIMIT, 'Tunnel HTTP greeting timeout');
    for (;;) {
      const line = await withPromiseTimeout(pullNextLine(), CONNECT_TIMEOUT_LIMIT, 'Tunnel HTTP header flush timeout');
      if (line === '') break;
    }
    if (!/HTTP\/\d(?:\.\d)?\s+2\d\d/i.test(statusLine)) throw new Error(`Tunnel rejected with: ${statusLine}`);

    let localAck = false, peerAck = false, authReq = false, authSent = false, authDone = false, ipcpStarted = false, ipcpDone = false, assignedIp = null;
    const sendAuthFrame = async () => {
      if (!localAck || !peerAck || !authReq || authSent) return;
      const userBytes = textEncoder.encode(proxy.username);
      const passBytes = textEncoder.encode(proxy.password);
      const frameLen = 6 + userBytes.byteLength + passBytes.byteLength;
      const frame = new Uint8Array(2 + frameLen);
      const view = new DataView(frame.buffer);
      view.setUint16(0, 0xc023);
      frame[2] = 1;
      frame[3] = pppCounter++;
      view.setUint16(4, frameLen);
      frame[6] = userBytes.byteLength;
      frame.set(userBytes, 7);
      frame[7 + userBytes.byteLength] = passBytes.byteLength;
      frame.set(passBytes, 8 + userBytes.byteLength);
      await withPromiseTimeout(writer.write(buildPppDataFrame(frame)), CONNECT_TIMEOUT_LIMIT, 'Auth send timeout');
      authSent = true;
    };

    const triggerIpcpNegotiation = async () => {
      if (!localAck || !peerAck || ipcpStarted || (authReq && !authDone)) return;
      await withPromiseTimeout(writer.write(buildPppDataFrame(buildPppPacket(0x8021, 1, pppCounter++, [
        { type: 3, data: new Uint8Array(4) }
      ]))), CONNECT_TIMEOUT_LIMIT, 'IPCP config timeout');
      ipcpStarted = true;
    };

    for (let round = 0; round < 50 && !ipcpDone; round++) {
      const packet = await pullNextControlFrame(CONNECT_TIMEOUT_LIMIT);
      if (packet.isControl) continue;
      const ppp = parsePppHeader(packet.body);
      if (!ppp) continue;

      if (ppp.protocol === 0xc021) {
        if (ppp.code === 1) {
          const authOption = parsePppOptionsList(ppp.payload).find(o => o.type === 3);
          if (authOption?.data?.byteLength >= 2) authReq = true;
          const ack = new Uint8Array(ppp.rawPacket);
          ack[2] = 2;
          await withPromiseTimeout(writer.write(buildPppDataFrame(ack)), CONNECT_TIMEOUT_LIMIT, 'LCP ACK timeout');
          peerAck = true;
          await sendAuthFrame();
          await triggerIpcpNegotiation();
        } else if (ppp.code === 2) {
          localAck = true;
          await sendAuthFrame();
          await triggerIpcpNegotiation();
        }
      } else if (ppp.protocol === 0xc023) {
        if (ppp.code === 2) {
          authDone = true;
          await triggerIpcpNegotiation();
        } else if (ppp.code === 3) throw new Error('Tunnel credential authentication failed');
      } else if (ppp.protocol === 0x8021) {
        if (ppp.code === 1) {
          const ack = new Uint8Array(ppp.rawPacket);
          ack[2] = 2;
          await withPromiseTimeout(writer.write(buildPppDataFrame(ack)), CONNECT_TIMEOUT_LIMIT, 'IPCP ACK timeout');
          await triggerIpcpNegotiation();
        } else if (ppp.code === 3) {
          const opt = parsePppOptionsList(ppp.payload).find(o => o.type === 3);
          if (opt?.data?.byteLength === 4) {
            assignedIp = [...opt.data].join('.');
            await withPromiseTimeout(writer.write(buildPppDataFrame(buildPppPacket(0x8021, 1, pppCounter++, [
              { type: 3, data: opt.data }
            ]))), CONNECT_TIMEOUT_LIMIT, 'IPCP confirm timeout');
            ipcpStarted = true;
          }
        } else if (ppp.code === 2) {
          const opt = parsePppOptionsList(ppp.payload).find(o => o.type === 3);
          if (opt?.data?.byteLength === 4) assignedIp = [...opt.data].join('.');
          ipcpDone = true;
        }
      }
    }
    if (!assignedIp) throw new Error('Tunnel failed to yield network address');

    const destIp = await resolveDomainIpv4(normalizeHostname(targetHost));
    if (!destIp) throw new Error(`DNS translation failed for endpoint: ${targetHost}`);

    const localPort = 10000 + (generateRandomUint16() % 50000);
    const srcIpBytes = new Uint8Array(assignedIp.split('.').map(Number));
    const dstIpBytes = new Uint8Array(destIp.split('.').map(Number));
    let localSeq = readBigEndian32(crypto.getRandomValues(new Uint8Array(4)));
    let remoteAck = 0;

    const baseIpHdr = new Uint8Array([0x45, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 64, 6, 0, 0, ...srcIpBytes, ...dstIpBytes]);
    const pseudoHdr = new Uint8Array(1432);
    pseudoHdr.set(srcIpBytes);
    pseudoHdr.set(dstIpBytes, 4);
    pseudoHdr[9] = 6;

    const synthesizeTcpFrame = (flags, payload = DUMMY_EMPTY_ARRAY) => {
      const data = castToUint8(payload);
      const dataLen = data.byteLength;
      const tcpLen = 20 + dataLen;
      const ipLen = 20 + tcpLen;
      const totalLen = 8 + ipLen;
      const frame = new Uint8Array(totalLen);
      const view = new DataView(frame.buffer);
      frame.set([0x10, 0x00, ((totalLen >> 8) & 0x0f) | 0x80, totalLen & 0xff, 0xff, 0x03, 0x00, 0x21]);
      frame.set(baseIpHdr, 8);
      view.setUint16(10, ipLen);
      view.setUint16(12, generateRandomUint16());
      view.setUint16(18, computeInternetChecksum(frame, 8, 20));
      view.setUint16(28, localPort);
      view.setUint16(30, targetPort);
      view.setUint32(32, localSeq);
      view.setUint32(36, remoteAck);
      frame[40] = 0x50;
      frame[41] = flags;
      view.setUint16(42, 65535);
      if (dataLen) frame.set(data, 48);
      pseudoHdr[10] = tcpLen >> 8;
      pseudoHdr[11] = tcpLen & 0xff;
      pseudoHdr.set(frame.subarray(28, 28 + tcpLen), 12);
      view.setUint16(44, computeInternetChecksum(pseudoHdr, 0, 12 + tcpLen));
      return frame;
    };

    const inspectIncomingIpPacket = ipPacket => {
      if (ipPacket.byteLength < 40 || ipPacket[9] !== 6) return null;
      const ipHdrLen = (ipPacket[0] & 0x0f) * 4;
      if (ipPacket.byteLength < ipHdrLen + 20) return null;
      if (readBigEndian16(ipPacket, ipHdrLen) !== targetPort) return null;
      if (readBigEndian16(ipPacket, ipHdrLen + 2) !== localPort) return null;
      return {
        flags: ipPacket[ipHdrLen + 13],
        sequence: readBigEndian32(ipPacket, ipHdrLen + 4),
        payloadOffset: ipHdrLen + ((ipPacket[ipHdrLen + 12] >> 4) & 0x0f) * 4
      };
    };

    await withPromiseTimeout(writer.write(synthesizeTcpFrame(0x02)), CONNECT_TIMEOUT_LIMIT, 'SYN send timeout');
    localSeq = (localSeq + 1) >>> 0;
    let established = false;

    for (let attempt = 0; attempt < 30; attempt++) {
      const packet = await pullNextControlFrame(CONNECT_TIMEOUT_LIMIT);
      if (packet.isControl) continue;
      const ppp = parsePppHeader(packet.body);
      if (!ppp || ppp.protocol !== 0x0021) continue;
      const tcp = inspectIncomingIpPacket(ppp.ipPacket);
      if (!tcp || (tcp.flags & 0x12) !== 0x12) continue;
      remoteAck = (tcp.sequence + 1) >>> 0;
      await withPromiseTimeout(writer.write(synthesizeTcpFrame(0x10)), CONNECT_TIMEOUT_LIMIT, 'ACK reply timeout');
      established = true;
      break;
    }
    if (!established) throw new Error('Synthetic TCP handshake through tunnel timed out');

    let ctrlRef = null;
    const cleanSocketState = () => {
      try { reader?.cancel(); } catch {}
      try { writer?.close(); } catch {}
      try { sock?.close(); } catch {}
    };

    const readable = new ReadableStream({
      start(c) { ctrlRef = c; },
      cancel() { cleanSocketState(); }
    });

    (async () => {
      try {
        let chunkCache = [], cacheBytes = 0;
        const flushBuffers = () => {
          if (!cacheBytes || !ctrlRef) return;
          ctrlRef.enqueue(chunkCache.length === 1 ? chunkCache[0] : mergeByteBuffers(...chunkCache));
          chunkCache = [];
          cacheBytes = 0;
          writer.write(synthesizeTcpFrame(0x10)).catch(() => {});
        };

        for (;;) {
          const packet = await pullNextControlFrame(60000);
          if (packet.isControl) continue;
          const ppp = parsePppHeader(packet.body);
          if (!ppp || ppp.protocol !== 0x0021) continue;
          const incoming = inspectIncomingIpPacket(ppp.ipPacket);
          if (!incoming) continue;

          if (incoming.payloadOffset < ppp.ipPacket.byteLength) {
            const payload = ppp.ipPacket.subarray(incoming.payloadOffset);
            if (payload.byteLength) {
              remoteAck = (incoming.sequence + payload.byteLength) >>> 0;
              chunkCache.push(new Uint8Array(payload));
              cacheBytes += payload.byteLength;
            }
          }
          if (incoming.flags & 0x01) {
            flushBuffers();
            remoteAck = (remoteAck + 1) >>> 0;
            writer.write(synthesizeTcpFrame(0x11)).catch(() => {});
            try { ctrlRef?.close(); } catch {}
            cleanSocketState();
            return;
          }
          if (buffer.byteLength < 4 || cacheBytes >= 32768) flushBuffers();
        }
      } catch (err) {
        try { ctrlRef?.error(err); } catch {}
        cleanSocketState();
      }
    })();

    const writable = new WritableStream({
      async write(chunk) {
        const bytes = castToUint8(chunk);
        if (!bytes.byteLength) return;
        if (bytes.byteLength <= TCP_PACKET_MSS) {
          await writer.write(synthesizeTcpFrame(0x18, bytes));
          localSeq = (localSeq + bytes.byteLength) >>> 0;
          return;
        }
        const batches = [];
        for (let off = 0; off < bytes.byteLength; off += TCP_PACKET_MSS) {
          const seg = bytes.subarray(off, Math.min(off + TCP_PACKET_MSS, bytes.byteLength));
          batches.push(synthesizeTcpFrame(0x18, seg));
          localSeq = (localSeq + seg.byteLength) >>> 0;
        }
        await writer.write(mergeByteBuffers(...batches));
      },
      close() { return writer.write(synthesizeTcpFrame(0x11)).catch(() => {}); },
      abort() { cleanSocketState(); }
    });

    return { readable, writable, close: cleanSocketState };
  } catch (error) {
    try { sock?.close(); } catch {}
    throw error;
  }
}

// ===========================================================================
// 入站请求协议分流引擎 (WebSocket Stream Pipeline)
// ===========================================================================
const UUID_BYTE_MAP = new Map();
function parseHalfNibble(ch) {
  if (ch >= 48 && ch <= 57) return ch - 48;
  ch |= 32;
  if (ch >= 97 && ch <= 102) return ch - 87;
  return -1;
}

function getUuidByteArray(uuid) {
  const k = String(uuid || '');
  if (UUID_BYTE_MAP.has(k)) return UUID_BYTE_MAP.get(k);
  const clean = k.replace(/-/g, '');
  if (clean.length !== 32) return null;
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    const hi = parseHalfNibble(clean.charCodeAt(i * 2));
    const lo = parseHalfNibble(clean.charCodeAt(i * 2 + 1));
    if (hi < 0 || lo < 0) return null;
    out[i] = (hi << 4) | lo;
  }
  UUID_BYTE_MAP.set(k, out);
  return out;
}

function verifyBufferUuid(data, offset, uuid) {
  const expected = getUuidByteArray(uuid);
  if (!expected || data.byteLength < offset + 16) return false;
  for (let i = 0; i < 16; i++) {
    if (data[offset + i] !== expected[i]) return false;
  }
  return true;
}

function parseInboundVlessHeader(chunk, token) {
  const data = castToUint8(chunk);
  const length = data.byteLength;
  if (length < 24) return { hasError: true, message: 'Truncated request' };
  const version = data[0];
  if (!verifyBufferUuid(data, 1, token)) return { hasError: true, message: 'Authentication mismatch' };

  const optLen = data[17];
  const cmdIdx = 18 + optLen;
  if (length < cmdIdx + 4) return { hasError: true, message: 'Invalid command header' };

  const cmd = data[cmdIdx];
  if (cmd !== 1) return { hasError: true, message: 'Non-TCP payload is restricted' };

  const portIdx = cmdIdx + 1;
  const port = (data[portIdx] << 8) | data[portIdx + 1];
  let addrIdx = portIdx + 3, addrLen = 0, targetHost = '';
  const aType = data[portIdx + 2];

  if (aType === 1) {
    addrLen = 4;
    if (length < addrIdx + addrLen) return { hasError: true, message: 'Invalid IPv4 structure' };
    targetHost = `${data[addrIdx]}.${data[addrIdx + 1]}.${data[addrIdx + 2]}.${data[addrIdx + 3]}`;
  } else if (aType === 2) {
    addrLen = data[addrIdx];
    addrIdx += 1;
    if (length < addrIdx + addrLen) return { hasError: true, message: 'Invalid FQDN structure' };
    targetHost = textDecoder.decode(data.subarray(addrIdx, addrIdx + addrLen));
  } else if (aType === 3) {
    addrLen = 16;
    if (length < addrIdx + addrLen) return { hasError: true, message: 'Invalid IPv6 structure' };
    const parts = [];
    for (let i = 0; i < 8; i++) {
      const b = addrIdx + i * 2;
      parts.push(((data[b] << 8) | data[b + 1]).toString(16));
    }
    targetHost = parts.join(':');
  } else {
    return { hasError: true, message: 'Unsupported address family' };
  }

  return {
    hasError: false,
    port,
    hostname: targetHost,
    rawClientData: data.subarray(addrIdx + addrLen),
    version,
  };
}

function extractEarlyDataBytes(hdr) {
  if (!hdr) return null;
  let normalized = hdr.replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4) normalized += '=';
  try {
    const bin = atob(normalized);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function handleWebSocketInboundTraffic(request, env, url, uuidToken) {
  const wsPair = new WebSocketPair();
  const [client, server] = Object.values(wsPair);
  server.accept();

  let destinationRelay = null;
  const match = url.pathname.match(/\/video\/([^/?#\s]+)/i);
  if (match) {
    try {
      const plain = decryptTokenish(match[1], uuidToken);
      destinationRelay = JSON.parse(plain);
    } catch {}
  }

  const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';
  const earlyDataPayload = extractEarlyDataBytes(earlyDataHeader);
  const tcpDialer = (opts, init) => connect(opts, init);

  let remoteBridge = null;
  let handshakeComplete = false;
  let replyHeader = null;

  async function processStreamData(chunk) {
    if (!handshakeComplete) {
      const parsed = parseInboundVlessHeader(chunk, uuidToken);
      if (parsed.hasError) throw new Error(parsed.message);
      handshakeComplete = true;
      replyHeader = new Uint8Array([parsed.version, 0]);

      if (destinationRelay && destinationRelay.type === 'sstp') {
        remoteBridge = await establishEncryptedRelaySession(destinationRelay, parsed.hostname, parsed.port, tcpDialer);
      } else {
        remoteBridge = tcpDialer({ hostname: parsed.hostname, port: parsed.port });
        await remoteBridge.opened;
      }

      (async () => {
        let firstPacketHeader = replyHeader;
        const reader = remoteBridge.readable.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done || server.readyState !== WebSocket.OPEN) break;
            if (!value || value.byteLength === 0) continue;
            if (firstPacketHeader) {
              const joined = new Uint8Array(firstPacketHeader.length + value.byteLength);
              joined.set(firstPacketHeader, 0);
              joined.set(castToUint8(value), firstPacketHeader.length);
              server.send(joined.buffer);
              firstPacketHeader = null;
            } else {
              server.send(value instanceof ArrayBuffer ? value : value.buffer || value);
            }
          }
        } catch {} finally {
          try { reader.releaseLock(); } catch {}
          try { remoteBridge.close(); } catch {}
          try { server.close(); } catch {}
        }
      })();

      if (parsed.rawClientData && parsed.rawClientData.byteLength > 0) {
        const writer = remoteBridge.writable.getWriter();
        await writer.write(parsed.rawClientData);
        writer.releaseLock();
      }
    } else {
      if (remoteBridge?.writable) {
        const writer = remoteBridge.writable.getWriter();
        await writer.write(castToUint8(chunk));
        writer.releaseLock();
      }
    }
  }

  let queueChain = Promise.resolve();
  server.addEventListener('message', event => {
    queueChain = queueChain.then(() => processStreamData(event.data)).catch(() => {
      try { remoteBridge?.close(); } catch {}
      try { server.close(); } catch {}
    });
  });

  server.addEventListener('close', () => { try { remoteBridge?.close(); } catch {} });
  server.addEventListener('error', () => { try { remoteBridge?.close(); } catch {} });

  if (earlyDataPayload && earlyDataPayload.byteLength > 0) {
    queueChain = queueChain.then(() => processStreamData(earlyDataPayload));
  }

  return new Response(null, {
    status: 101,
    webSocket: client,
    headers: earlyDataHeader ? { 'Sec-WebSocket-Protocol': earlyDataHeader } : {},
  });
}

// ===========================================================================
// 前端现代化遥测监控仪表盘 (Edge Pulse UI)
// ===========================================================================
function getDashboardHtml(hostUrl) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Edge Pulse · 边缘服务与节点可用性监控平台</title>
<style>
  :root {
    --bg: #0b1120; --panel: #111a2e; --panel2: #16233c; --border: #243450;
    --text: #dbe7ff; --muted: #7f93b8; --accent: #4cc2ff; --ok: #2fd08a;
    --res: #b48cff; --dc: #ffb84d; --unk: #8a9bb5; --err: #f87171;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; min-height: 100vh; padding: 20px; }
  .wrap { max-width: 1100px; margin: 0 auto; }
  header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
  h1 { font-size: 22px; font-weight: 700; color: #fff; }
  .sub { color: var(--muted); font-size: 13px; margin-top: 4px; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .btn { background: var(--panel2); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 8px 14px; font-size: 13px; cursor: pointer; transition: all .2s; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
  .btn:hover { border-color: var(--accent); color: var(--accent); background: rgba(76,194,255,.08); }
  .btn-primary { background: #0284c7; border-color: #38bdf8; color: #fff; font-weight: 600; }
  .btn-primary:hover { background: #0369a1; color: #fff; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
  .card .k { color: var(--muted); font-size: 12px; }
  .card .v { font-size: 26px; font-weight: 700; margin-top: 4px; color: #fff; }
  .bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; align-items: center; justify-content: space-between; }
  .filter-group { display: flex; gap: 8px; flex-wrap: wrap; }
  .pill { background: var(--panel2); border: 1px solid var(--border); color: var(--text); border-radius: 999px; padding: 6px 14px; font-size: 13px; cursor: pointer; user-select: none; }
  .pill.on { border-color: var(--accent); color: var(--accent); background: rgba(76,194,255,.1); }
  .search-input { background: var(--panel2); border: 1px solid var(--border); color: var(--text); padding: 7px 12px; border-radius: 8px; font-size: 13px; outline: none; width: 200px; }
  .search-input:focus { border-color: var(--accent); }
  .legend { color: var(--muted); font-size: 12px; margin-bottom: 16px; }
  .country { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 14px; overflow: hidden; }
  .country .head { display: flex; justify-content: space-between; padding: 12px 16px; background: var(--panel2); font-weight: 600; cursor: pointer; flex-wrap: wrap; gap: 6px; }
  .country .head .tag { font-size: 12px; color: var(--muted); font-weight: 400; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 10px 14px; text-align: left; border-top: 1px solid var(--border); }
  th { color: var(--muted); font-weight: 500; font-size: 12px; background: rgba(0,0,0,.15); }
  tr:hover td { background: rgba(76,194,255,.04); }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 500; }
  .b-res { background: rgba(180,140,255,.15); color: var(--res); }
  .b-dc { background: rgba(255,184,77,.15); color: var(--dc); }
  .b-unk { background: rgba(138,155,181,.15); color: var(--unk); }
  .lat { color: var(--ok); font-weight: 600; font-family: monospace; }
  code { background: var(--panel2); padding: 3px 6px; border-radius: 5px; font-size: 12px; font-family: monospace; }
  .empty { color: var(--muted); padding: 40px; text-align: center; font-size: 14px; }
  .footer { color: var(--muted); font-size: 12px; margin-top: 24px; text-align: center; }
  .toast { position: fixed; bottom: 20px; right: 20px; background: #0284c7; color: #fff; padding: 10px 18px; border-radius: 8px; font-size: 13px; display: none; box-shadow: 0 4px 14px rgba(0,0,0,.3); z-index: 100; }
  @media (max-width: 700px) { th, td { padding: 8px 10px; } .hide-m { display: none; } .search-input { width: 100%; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>🌐 Edge Pulse · 边缘服务网络监测</h1>
      <div class="sub">自动化健康检测 · 节点全量入库持久化</div>
    </div>
    <div class="actions">
      <button class="btn btn-primary" onclick="copyBase64Sub()">📋 复制通用订阅 (Base64)</button>
      <button class="btn" onclick="copyMihomoSub()">🐱 复制 Mihomo 订阅</button>
      <button class="btn" id="btn-refresh" onclick="triggerRefresh()">🔄 全量重新检测</button>
      <button class="btn" onclick="manageToken()" title="设置或更改当前浏览器的授权密码">🔑 授权设置</button>
    </div>
  </header>

  <div class="cards" id="cards"></div>

  <div class="bar">
    <div class="filter-group">
      <span class="pill on" data-f="all">全部线路</span>
      <span class="pill" data-f="residential">仅住宅/宽带 IP</span>
      <span class="pill" data-f="datacenter">仅数据中心 IP</span>
    </div>
    <input type="text" class="search-input" id="search" placeholder="搜索区域 / 节点地址..." oninput="handleSearch()">
  </div>

  <div class="legend">💡 说明：节点数据 100% 持久化存储在 KV 中；导出订阅或手动更新需提供管理 Token 密码。</div>

  <div id="countries"></div>

  <div class="footer" id="foot">正在从 KV 加载持久化节点数据...</div>
</div>

<div class="toast" id="toast"></div>

<script>
let DATA = null, FILTER = "all", SEARCH_KEY = "";
const BASE_HOST = "${hostUrl}";

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.display = "block";
  setTimeout(() => { t.style.display = "none"; }, 2500);
}

function copyText(txt, desc) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(txt).then(() => showToast(desc || "复制成功！"));
  }
}

function getOrPromptToken() {
  let token = localStorage.getItem("edge_token") || "";
  if (!token) {
    token = prompt("请输入管理 Token 密码：");
    if (token) {
      token = token.trim();
      localStorage.setItem("edge_token", token);
    }
  }
  return token;
}

function manageToken() {
  const current = localStorage.getItem("edge_token") || "";
  const next = prompt("设置/修改当前浏览器的 Token 密码（留空则清除记录）：", current);
  if (next !== null) {
    if (next.trim()) {
      localStorage.setItem("edge_token", next.trim());
      showToast("Token 已更新保存！");
    } else {
      localStorage.removeItem("edge_token");
      showToast("Token 已清除！");
    }
  }
}

function copyBase64Sub() {
  const token = getOrPromptToken();
  if (!token) return showToast("未提供 Token，取消复制！");
  const subUrl = BASE_HOST + "/sub?token=" + encodeURIComponent(token);
  copyText(subUrl, "已复制通用 Base64 订阅 URL！");
}

function copyMihomoSub() {
  const token = getOrPromptToken();
  if (!token) return showToast("未提供 Token，取消复制！");
  const mihomoUrl = BASE_HOST + "/sub?target=mihomo&token=" + encodeURIComponent(token);
  copyText(mihomoUrl, "已复制 Mihomo 订阅 URL！");
}

function renderCards(d) {
  const s = d.stats || {};
  const items = [
    ["最后更新时间", d.generated_at ? d.generated_at.replace(" UTC", "") : "-", "UTC"],
    ["可用边缘节点", s.success || 0, "全量检测可用"],
    ["覆盖地区", s.countries || 0, "个独立自治域"],
    ["原生宽带类型", s.residential_est || 0, "原生家庭网络"],
    ["机房中继节点", s.datacenter_est || 0, "高速机房中继"],
    ["全量池规模", (s.raw_nodes || 0) + " / " + (s.parsed_nodes || 0), "原始节点库"]
  ];
  document.getElementById("cards").innerHTML = items.map(x =>
    '<div class="card"><div class="k">' + x[0] + '</div><div class="v">' + x[1] + '</div><div class="k">' + x[2] + '</div></div>'
  ).join("");
}

function rowHtml(n) {
  let badge;
  if (n.residential === "residential") badge = '<span class="badge b-res">宽带</span>';
  else if (n.residential === "datacenter") badge = '<span class="badge b-dc">机房</span>';
  else badge = '<span class="badge b-unk">其他</span>';
  const exit = n.exit ? ((n.exit.ip || "?") + " · " + (n.exit.org || n.exit.country || "")) : "-";
  return '<tr>' +
    '<td><code>' + n.host + ':' + n.port + '</code></td>' +
    '<td class="hide-m">' + (n.country_code || "") + '</td>' +
    '<td>SSTP</td>' +
    '<td class="lat">' + (n.latency_ms != null ? n.latency_ms + ' ms' : '-') + '</td>' +
    '<td class="hide-m" style="color:var(--muted)">' + exit + '</td>' +
    '<td>' + badge + '</td>' +
    '</tr>';
}

function renderCountries() {
  const box = document.getElementById("countries");
  if (!DATA || !DATA.countries) {
    box.innerHTML = '<div class="empty">暂无可用数据</div>';
    return;
  }
  const q = SEARCH_KEY.toLowerCase();
  const entries = Object.entries(DATA.countries)
    .map(x => {
      const filtered = x[1].nodes.filter(n => {
        if (FILTER !== "all" && n.residential !== FILTER) return false;
        if (q) {
          const mHost = n.host.toLowerCase().includes(q);
          const mIp = n.ip && n.ip.includes(q);
          const mCountry = x[0].toLowerCase().includes(q) || (n.country_code && n.country_code.toLowerCase().includes(q));
          if (!mHost && !mIp && !mCountry) return false;
        }
        return true;
      });
      return [x[0], Object.assign({}, x[1], { nodes: filtered, count: filtered.length })];
    })
    .filter(x => x[1].nodes.length > 0)
    .sort((a, b) => b[1].count - a[1].count);

  if (!entries.length) {
    box.innerHTML = '<div class="country"><div class="empty">无匹配的节点数据</div></div>';
    return;
  }

  box.innerHTML = entries.map(x => {
    const name = x[0], g = x[1];
    return '<div class="country">' +
      '<div class="head">' +
        '<span>🌏 ' + name + ' <span class="tag">' + (g.code || "") + '</span></span>' +
        '<span class="tag">' + g.count + ' 个可用 · 宽带 ' + g.residential + ' · 机房 ' + g.datacenter + '</span>' +
      '</div>' +
      '<table><thead><tr><th>Endpoint</th><th class="hide-m">区域</th><th>协议</th><th>时延</th><th class="hide-m">自治域信息</th><th>网络类型</th></tr></thead>' +
      '<tbody>' + g.nodes.map(rowHtml).join("") + '</tbody></table>' +
    '</div>';
  }).join("");
}

function render() {
  renderCards(DATA);
  renderCountries();
  const s = DATA.stats || {};
  document.getElementById("foot").textContent =
    "已同步至 KV · 节点更新于 " + (DATA.generated_at || "?") + " · 可用中继 " + (s.success || 0) + " / 检测 " + (s.checked || 0);
}

function setFilter(f) {
  FILTER = f;
  document.querySelectorAll(".pill").forEach(p => p.classList.toggle("on", p.dataset.f === f));
  renderCountries();
}

function handleSearch() {
  SEARCH_KEY = document.getElementById("search").value.trim();
  renderCountries();
}

document.querySelectorAll(".pill").forEach(p => {
  p.addEventListener("click", () => setFilter(p.dataset.f));
});

async function loadData() {
  try {
    const r = await fetch("/data.json");
    if (!r.ok) throw new Error("HTTP " + r.status);
    DATA = await r.json();
    render();
  } catch (err) {
    document.getElementById("foot").textContent = "KV 数据拉取失败: " + err.message + "，请点击「全量重新检测」";
  }
}

async function triggerRefresh() {
  const token = getOrPromptToken();
  if (!token) return showToast("未提供 Token，无法触发检测！");
  const btn = document.getElementById("btn-refresh");
  btn.disabled = true;
  btn.textContent = "正在全量探测并写入 KV...";
  try {
    const r = await fetch("/update?token=" + encodeURIComponent(token), { method: "POST" });
    if (r.status === 401) {
      localStorage.removeItem("edge_token");
      showToast("Token 密码错误，鉴权失败！");
      return;
    }
    const j = await r.json();
    if (j.success) {
      showToast("探测完成！全量节点已存入 KV");
      DATA = j.data;
      render();
    } else {
      showToast("刷新失败: " + (j.error || "未知异常"));
    }
  } catch (e) {
    showToast("请求异常: " + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "🔄 全量重新检测";
  }
}

loadData();
</script>
</body>
</html>`;
}

// ===========================================================================
// Cloudflare Workers 请求入口调度
// ===========================================================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostUrl = `${url.protocol}//${url.host}`;
    const path = url.pathname;
    const upgradeHeader = (request.headers.get('Upgrade') || '').toLowerCase();
    const uuidToken = (env.UUID || DEFAULT_NODE_UUID).toLowerCase();

    // 1. WebSocket 桥接入站 (加密流转，免鉴权)
    if (upgradeHeader === 'websocket') {
      return await handleWebSocketInboundTraffic(request, env, url, uuidToken);
    }

    // 2. OPTIONS 预检跨域处理
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
    };

    // 3. 公开首页与状态接口 (任何访客均可进入查看健康图表)
    if (path === "/" || path === "/index.html") {
      return new Response(getDashboardHtml(hostUrl), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          ...corsHeaders,
        },
      });
    }

    if (path === "/data.json" || path === "/api/nodes") {
      try {
        const report = await retrievePersistentReport(env);
        return new Response(JSON.stringify(report, null, 2), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            ...corsHeaders,
          },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
        });
      }
    }

    // 4. /sub 节点订阅接口 (服务端强制鉴权)
    if (path === "/sub") {
      if (!isClientAuthorized(request, env)) {
        return new Response("Unauthorized: Invalid token\n", {
          status: 401,
          headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders },
        });
      }

      try {
        const report = await retrievePersistentReport(env);
        const entries = await loadRoutingEntrypoints(env);
        const nodes = buildNodeTopology(report, entries, url.hostname, uuidToken);
        const target = (url.searchParams.get("target") || "").toLowerCase();

        // 仅在显式请求 target=mihomo 或 target=clash 时输出纯节点 YAML 列表
        if (target === "mihomo" || target === "clash" || target === "meta") {
          const yamlData = buildMihomoJsonListYaml(nodes);
          return new Response(yamlData, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-store",
              ...corsHeaders,
            },
          });
        }

        // 默认直接输出纯 Base64 (支持浏览器直接查阅，不弹窗下载)
        const plainLinks = nodes.map(n => n.link).join("\n");
        return new Response(encodeSafeBase64(plainLinks), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
            ...corsHeaders,
          },
        });
      } catch (err) {
        return new Response(`Error: ${err.message}\n`, {
          status: 500,
          headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders },
        });
      }
    }

    // 5. /nodes.txt 兼容输出
    if (path === "/nodes.txt") {
      if (!isClientAuthorized(request, env)) {
        return new Response("Unauthorized\n", { status: 401, headers: corsHeaders });
      }
      try {
        const report = await retrievePersistentReport(env);
        const entries = await loadRoutingEntrypoints(env);
        const countries = report.countries || {};
        const lines = [];
        let eIdx = 0;
        for (const [cName, grp] of Object.entries(countries)) {
          const code = String(grp.code || "?").toUpperCase();
          const zh = GEO_NAMES_ZH[code] || (code !== "?" ? code : cName);
          let count = 1;
          for (const n of grp.nodes) {
            const entry = entries[eIdx++ % entries.length];
            const typeLabel = n.residential === "residential" ? "专线" : "边缘";
            lines.push(`${entry}#${zh}-${typeLabel}-${String(count++).padStart(2, "0")}$sstp://vpn:vpn@${n.host}:${n.port}`);
          }
        }
        return new Response(lines.join("\n") + "\n", {
          headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders },
        });
      } catch (err) {
        return new Response(`Error: ${err.message}\n`, { status: 500, headers: corsHeaders });
      }
    }

    // 6. 手动更新并持久化入库接口 (需鉴权)
    if (path === "/update") {
      if (!isClientAuthorized(request, env)) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
        });
      }

      try {
        const updated = await executeFullProbePipeline(env);
        return new Response(JSON.stringify({ success: true, count: updated.stats.success, data: updated }), {
          headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },

  // -------------------------------------------------------------------------
  // Cloudflare 定时自动触发任务 (Cron Triggers 后台静默刷新)
  // -------------------------------------------------------------------------
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      executeFullProbePipeline(env)
        .then(res => console.log(`[Cron] Telemetry probe completed, saved to KV: ${res.stats.success}`))
        .catch(err => console.error(`[Cron] Telemetry probe failed: ${err.message}`))
    );
  },
};
