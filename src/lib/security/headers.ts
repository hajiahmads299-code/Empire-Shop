/**
 * Security headers — Phase 10.2 (hardened in Phase 10.4).
 *
 * In production we build a strict CSP that is compatible with statically
 * prerendered Next.js pages: `script-src` allows `'self'` plus inline
 * scripts (the framework's own bootstrap/flight payload). A per-request
 * nonce is intentionally NOT used — prerendered HTML is produced at build
 * time and cannot be tagged per request, and a nonce makes browsers ignore
 * `'self'`, which blocked every script and produced blank pages.
 *
 * In development we keep `'unsafe-inline'` + `'unsafe-eval'` so the
 * Next.js dev overlay and Fast Refresh keep working.
 */

export interface SecurityHeaderOptions {
  /**
   * Per-request nonce (base64). Accepted for backwards compatibility with
   * callers that still mint one; it is no longer added to `script-src`
   * because prerendered pages cannot carry a per-request nonce.
   */
  nonce?: string;
}

export function securityHeaders(_opts: SecurityHeaderOptions = {}): Record<string, string> {
  const isProd = process.env.NODE_ENV === 'production';

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
  //   - prod → 'self' 'unsafe-inline'                         (see note below)
  //   - dev  → 'self' 'unsafe-inline' 'unsafe-eval'           (HMR + overlay)
  //
  // A per-request nonce cannot be used here: most storefront routes (including
  // the `/[locale]` home page) are statically prerendered at build time, so
  // their inline Next.js bootstrap scripts carry no nonce. Because CSP level 3
  // ignores host sources such as 'self' as soon as a nonce/'strict-dynamic' is
  // present, the previous nonce policy blocked *every* Next.js script and the
  // home page rendered blank. `'self' 'unsafe-inline'` keeps the rest of the
  // policy strict while letting the framework's own scripts run.
  const scriptSrc = isProd
    ? "script-src 'self' 'unsafe-inline' 'report-sample'"
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
