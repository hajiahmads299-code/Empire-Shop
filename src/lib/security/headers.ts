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
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'report-sample'`
      : "script-src 'self' 'report-sample'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  const cspDirectives = [
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
  ];

  const csp = cspDirectives.join('; ');

  const headers: Record<string, string> = {};

  // Allow running CSP in Report-Only mode for rollout/testing. Set
  // CSP_REPORT_ONLY=true in the environment to enable.
  const reportOnly = (process.env.CSP_REPORT_ONLY ?? 'false') === 'true';
  if (reportOnly) {
    headers['Content-Security-Policy-Report-Only'] = csp;
  } else {
    headers['Content-Security-Policy'] = csp;
  }

  // HSTS is only applied in production responses. Some environments (local)
  // serve over HTTP and must not receive HSTS.
  if (isProd) {
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
  }

  headers['X-Content-Type-Options'] = 'nosniff';
  headers['X-Frame-Options'] = 'DENY';
  headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
  headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self)';
  headers['Cross-Origin-Opener-Policy'] = 'same-origin';
  headers['Cross-Origin-Resource-Policy'] = 'same-site';
  headers['X-DNS-Prefetch-Control'] = 'on';

  return headers;
}
