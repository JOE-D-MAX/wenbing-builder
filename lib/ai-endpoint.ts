import { isIP } from 'node:net';

/** Only safe, user-facing validation messages; never echo a submitted URL. */
export class AiEndpointError extends Error {
  constructor(message: string) { super(message); this.name = 'AiEndpointError'; }
}

function ipv4Number(address: string): number {
  return address.split('.').reduce((result, part) => result * 256 + Number(part), 0);
}

function ipv4InRange(address: number, network: string, bits: number): boolean {
  const divisor = 2 ** (32 - bits);
  return Math.floor(address / divisor) === Math.floor(ipv4Number(network) / divisor);
}

/** Conservatively allow public unicast addresses, excluding special-use networks. */
export function isPublicAiAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const numeric = ipv4Number(address);
    const blocked: [string, number][] = [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
      ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
      ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
      ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
      // Azure platform virtual IP is globally shaped but not a public API destination.
      ['168.63.129.16', 32],
    ];
    return !blocked.some(([network, bits]) => ipv4InRange(numeric, network, bits));
  }
  if (family !== 6 || address.includes('%') || address.includes('.')) return false;
  const [left, right = ''] = address.toLowerCase().split('::');
  const leftParts = left ? left.split(':') : [];
  const rightParts = right ? right.split(':') : [];
  const parts = [...leftParts, ...Array(Math.max(0, 8 - leftParts.length - rightParts.length)).fill('0'), ...rightParts].map(part => parseInt(part || '0', 16));
  // Current global unicast allocation only. This also excludes mapped IPv4,
  // NAT64, loopback, link-local, ULA, multicast and unspecified addresses.
  if (parts[0] < 0x2000 || parts[0] > 0x3fff) return false;
  if (parts[0] === 0x2001 && (parts[1] < 0x0200 || parts[1] === 0x0db8)) return false;
  if (parts[0] === 0x2002) return false; // 6to4 can encode private IPv4 destinations.
  if (parts[0] === 0x3fff && parts[1] < 0x1000) return false; // Documentation /20.
  return true;
}

export function normalizeAiEndpoint(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value) || /[\u0020\\]/.test(value.trim())) {
    throw new AiEndpointError('请填写有效的 HTTPS API 地址，不能包含空格或控制字符。');
  }
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new AiEndpointError('请填写完整的 HTTPS API 地址。'); }
  if (url.protocol !== 'https:' || url.username || url.password || /[?#]/.test(value)) {
    throw new AiEndpointError('API 地址必须使用 HTTPS，且不能包含账号、密码、查询参数或片段。');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  const family = isIP(host);
  if (family ? !isPublicAiAddress(host) : (
    !host.includes('.') || /(?:^|\.)(?:localhost|local|internal|localdomain|lan|test|invalid|example)$/.test(host)
    || host.endsWith('.home.arpa') || host === 'metadata.google.internal'
  )) throw new AiEndpointError('API 地址必须指向公网服务，不能使用本机、内网或保留地址。');
  if (!family) url.hostname = host;
  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = path.endsWith('/chat/completions') ? path : path + '/chat/completions';
  return url.href;
}
