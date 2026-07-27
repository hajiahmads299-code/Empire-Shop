import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { securityHeaders } from '@/lib/security/headers';
import { rateLimit, clientKey } from '@/lib/api/rate-limit';

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Middleware — Phase 9.3 (route protection) + Phase 8 (security + rate-limit).
 *
 * Layers, in order:
 *  1. Global per-IP rate limit for `/api/*` (Edge-safe; in-memory per instance).
 *  2. Session-cookie gate for /profile, /admin, /seller (deep role checks
 *     still run in the API/Server-Component layer with DB access).
 *  3. next-intl locale routing.
 *  4. Security response headers on every response.
 */
const PROTECTED_SEGMENTS = ['/profile', '/admin', '/seller'] as const;
const SESSION_COOKIE = 'empire_session';

// Global API rate-limit budget (per-IP). Tune via env if needed.
const API_RATE_LIMIT = Number(process.env.API_RATE_LIMIT ?? 300);
const API_RATE_WINDOW_MS = Number(process.env.API_RATE_WINDOW_MS ?? 60_000);

function stripLocale(pathname: string): { locale: string | null; rest: string } {
  const parts = pathname.split('/').filter(Boolean);
  const maybeLocale = parts[0];
  if (maybeLocale && (routing.locales as readonly string[]).includes(maybeLocale)) {
    return { locale: maybeLocale, rest: '/' + parts.slice(1).join('/') };
  }
  return { locale: null, rest: pathname };
}

function isProtected(rest: string): boolean {
  return PROTECTED_SEGMENTS.some((seg) => rest === seg || rest.startsWith(seg + '/'));
}

function withSecurityHeaders(res: NextResponse, nonce?: string): NextResponse {
  const headers = securityHeaders({ nonce });
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

/** Base64 nonce for the per-request CSP. Uses Web Crypto (Edge-safe). */
function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  // btoa is available in the Edge runtime.
  return btoa(bin);
}

function sameOriginRequest(req: NextRequest): boolean {
  const forwardedHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const forwardedProto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '');
  const requestOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost.split(',')[0].trim()}`
    : req.nextUrl.origin;
  const origin = req.headers.get('origin');
  if (origin) return origin === requestOrigin;
  const referer = req.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).origin === requestOrigin;
    } catch {
      return false;
    }
  }
  return false;
}

export default function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const nonce = makeNonce();

  // 1) API rate-limit (matcher below routes /api through this middleware).
  if (pathname.startsWith('/api/')) {
    // Browser mutations carry an Origin or Referer header. Rejecting requests
    // without either prevents cross-site form posts from using the session
    // cookie. Webhook callbacks are machine-to-machine and authenticate via
    // their own signature instead.
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      pathname !== '/api/payments/callback' &&
      !sameOriginRequest(req)
    ) {
      const res = NextResponse.json(
        { ok: false, error: { code: 'csrf_rejected', message: 'Request origin could not be verified' } },
        { status: 403 },
      );
      return withSecurityHeaders(res, nonce);
    }
    const rl = rateLimit(clientKey(req, 'api:global'), {
      limit: API_RATE_LIMIT,
      windowMs: API_RATE_WINDOW_MS,
    });
    if (!rl.ok) {
      const res = NextResponse.json(
        { ok: false, error: { code: 'rate_limited', message: 'Too many requests' } },
        { status: 429 },
      );
      res.headers.set(
        'Retry-After',
        Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000)).toString(),
      );
      res.headers.set('X-RateLimit-Limit', String(API_RATE_LIMIT));
      res.headers.set('X-RateLimit-Remaining', '0');
      return withSecurityHeaders(res, nonce);
    }
    const passthrough = NextResponse.next();
    passthrough.headers.set('X-RateLimit-Limit', String(API_RATE_LIMIT));
    passthrough.headers.set('X-RateLimit-Remaining', String(rl.remaining));
    return withSecurityHeaders(passthrough, nonce);
  }

  const { locale, rest } = stripLocale(pathname);

  // 2) Session gate for protected app segments.
  if (isProtected(rest)) {
    const hasSession = req.cookies.get(SESSION_COOKIE)?.value;
    if (!hasSession) {
      const target = req.nextUrl.clone();
      const loc = locale ?? routing.defaultLocale;
      target.pathname = `/${loc}/login`;
      target.search = search;
      return withSecurityHeaders(NextResponse.redirect(target), nonce);
    }
  }

  // Propagate the nonce on the response so Server Components / next/script
  // can adopt it via the `x-nonce` header.
  const intlRes = intlMiddleware(req);
  intlRes.headers.set('x-nonce', nonce);
  return withSecurityHeaders(intlRes, nonce);
}

export const config = {
  // Include /api so we can rate-limit and add security headers, but skip
  // Next internals and static assets.
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
