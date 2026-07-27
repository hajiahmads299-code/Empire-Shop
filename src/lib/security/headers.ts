/**
 * Security headers — Phase 10.2 (hardened in Phase 10.4).
 *
 * In production we build a strict, nonce-based CSP: `script-src` no
 * longer carries `'unsafe-inline'` — the caller (middleware) mints a
 * per-request nonce, and Next.js inline bootstrap scripts are tagged
 * with it via `next.config.mjs` / runtime propagation. `'strict-dynamic'`
 * lets nonce-approved scripts load their own dependencies without a
 * host allowlist.
 *
 * In development we keep `'unsafe-inline'` + `'unsafe-eval'` so the
 * Next.js dev overlay and Fast Refresh keep working.
 */

export interface SecurityHeaderOptions {
  /** Per-request nonce (base64). When provided in prod, script-src uses it. */
  nonce?: string;
}

export function securityHeaders(opts: SecurityHeaderOptions = {}): Record<string, string> {
  const isProd = process.env.NODE_ENV === 'production';
  const { nonce } = opts;

  const extraConnect = (process.env.CSP_CONNECT_EXTRA ?? '')
    .split(/[,\s]+/)
    .filter(Boolean);
  const connectSrc = [
    "'self'",
    'https://api.atomapay.com',
    ...(isProd ? [] : ['https:', 'wss:']),
    ...extraConnect,
  ].join(' ');

  // script-src:
  //   - prod + nonce  → 'self' 'nonce-...' 'strict-dynamic'   (no unsafe-inline)
  //   - prod, no nonce (edge cases / static probes) → 'self' (deny inline)
  //   - dev           → 'self' 'unsafe-inline' 'unsafe-eval'  (HMR + overlay)
  const scriptSrc = isProd
    ? nonce
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
      : "script-src 'self'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    scriptSrc,
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ');

  return {
    'Content-Security-Policy': csp,
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-site',
    'X-DNS-Prefetch-Control': 'on',
  };
}
