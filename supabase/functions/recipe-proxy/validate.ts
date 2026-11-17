// Pure validation helpers for the recipe-proxy Edge Function. No Deno or Node APIs, so the
// same file runs in the function and under `node --test` in CI.

export const MAX_RESPONSE_BYTES = 2_000_000;
export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_REDIRECTS = 3;

export class BlockedUrlError extends Error {}

/** Parse and check a user-supplied recipe URL before any network access. */
export function parseRecipeUrl(raw: unknown): URL {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) {
    throw new BlockedUrlError('A recipe URL is required');
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError('Not a valid URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new BlockedUrlError('Only http and https URLs are supported');
  }
  if (url.username || url.password) {
    throw new BlockedUrlError('URLs with credentials are not supported');
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new BlockedUrlError('Only the default web ports are supported');
  }
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new BlockedUrlError('Local network addresses are not supported');
  }
  if (isIpLiteral(host) && isPrivateAddress(host)) {
    throw new BlockedUrlError('Local network addresses are not supported');
  }
  return url;
}

export function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[') || host.includes(':');
}

/** True for loopback, private, link-local, CGNAT, multicast, reserved and unspecified addresses. */
export function isPrivateAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '').toLowerCase();

  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }

  if (ip.includes(':')) {
    if (ip === '::' || ip === '::1') return true;
    const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    // IPv4-mapped addresses as normalized by URL parsing, e.g. ::ffff:7f00:1 for 127.0.0.1.
    const mappedHex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const [hi, lo] = [parseInt(mappedHex[1], 16), parseInt(mappedHex[2], 16)];
      return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(ip);
  }

  return true; // unknown format: refuse
}

/** Only HTML-like responses can contain the recipe markup the app parses. */
export function isAcceptableContentType(contentType: string | null): boolean {
  if (!contentType) return true;
  return /text\/html|application\/xhtml\+xml|application\/ld\+json|text\/plain/i.test(contentType);
}
