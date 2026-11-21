// Protections for running Ghostrun as a public demo (GHOSTRUN_PUBLIC=1).
// The ghosts' browser runs on the server, so a link chosen by a visitor must not reach the server's own
// network (localhost services, cloud metadata at 169.254.169.254, a home router...): the report would show
// screenshots of whatever is there. And one visitor must not use up the shared API budget.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** Dotted IPv4 from the last 32 bits of an IPv6 address written in hex groups ("7f00:1"). */
function v4FromHex(groups) {
  const [hi, lo] = groups.split(':').map((g) => parseInt(g, 16));
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null;
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.');
}

/** True for addresses that are not on the public internet. Anything that is not an IP counts as unsafe. */
export function isPrivateAddress(ip) {
  const address = String(ip).replace(/^\[|\]$/g, '');
  const version = isIP(address);
  if (version === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return (
      a === 0 || // "this network"
      a === 10 || // private
      a === 127 || // loopback
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) || // private
      (a === 192 && b === 168) || // private
      (a === 192 && b === 0 && (c === 0 || c === 2)) || // IETF protocol assignments, TEST-NET-1
      (a === 198 && (b === 18 || b === 19)) || // benchmarking
      a >= 224 // multicast and reserved
    );
  }
  if (version === 6) {
    const x = address.toLowerCase();
    if (x === '::' || x === '::1') return true;
    for (const prefix of ['::ffff:', '64:ff9b::']) {
      // IPv4 inside IPv6 (mapped, or NAT64): judge the IPv4 part
      if (x.startsWith(prefix)) {
        const rest = x.slice(prefix.length);
        const v4 = rest.includes('.') ? rest : v4FromHex(rest);
        return v4 ? isPrivateAddress(v4) : true;
      }
    }
    return /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith('ff'); // unique local, link-local, multicast
  }
  return true;
}

/**
 * Checks a link a visitor wants the ghosts to open. allowHosts lists "host:port" values that are always
 * fine (our own test games). Returns { ok } or { ok: false, reason: 'invalid_url' | 'unresolvable' | 'private_address' }.
 */
export async function checkTarget(href, { allowHosts = [], resolve = lookup } = {}) {
  let u;
  try {
    u = new URL(href);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, reason: 'invalid_url' };
  if (allowHosts.includes(u.host)) return { ok: true };
  const host = u.hostname.replace(/^\[|\]$/g, '');
  let addresses;
  if (isIP(host)) addresses = [host];
  else {
    try {
      addresses = (await resolve(host, { all: true, verbatim: true })).map((a) => a.address);
    } catch {
      return { ok: false, reason: 'unresolvable' };
    }
  }
  if (!addresses.length || addresses.some(isPrivateAddress)) return { ok: false, reason: 'private_address' };
  return { ok: true };
}

/**
 * For every request the game page makes (redirects, scripts, images, fetch): may it go out? Results are
 * cached per host for a minute so a game's many requests cost one DNS lookup.
 */
export function createRequestGuard({ allowHosts = [], resolve = lookup, ttlMs = 60_000 } = {}) {
  const cache = new Map();
  return async (href) => {
    let u;
    try {
      u = new URL(href);
    } catch {
      return false;
    }
    if (u.protocol === 'data:' || u.protocol === 'blob:') return true; // no network involved
    const key = u.host;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.ok;
    const { ok } = await checkTarget(href, { allowHosts, resolve });
    cache.set(key, { ok, at: Date.now() });
    return ok;
  };
}

/** Sliding-window rate limit per key (for example per visitor IP). */
export class RateLimiter {
  constructor({ limit, windowMs }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = new Map();
  }
  /** Records a hit if allowed. Returns { ok } or { ok: false, retryAfterMs }. */
  take(key, now = Date.now()) {
    if (this.hits.size > 10_000) for (const [k, list] of this.hits) if (now - list.at(-1) >= this.windowMs) this.hits.delete(k);
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return { ok: false, retryAfterMs: this.windowMs - (now - list[0]) };
    }
    list.push(now);
    this.hits.set(key, list);
    return { ok: true };
  }
}

/** The visitor's IP. Behind a reverse proxy (TRUST_PROXY=1), the first X-Forwarded-For address. */
export function clientIp(req, trustProxy = false) {
  const forwarded = trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '';
  return forwarded || req.socket?.remoteAddress || 'unknown';
}
