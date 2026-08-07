import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { securityHeaders } from '@/lib/security/headers';
import { rateLimit, rateLimitAsync, clientKey, isDistributedRateLimit } from '@/lib/api/rate-limit';

const intlMiddleware = createIntlMiddleware(routing);
const PROTECTED_SEGMENTS = ['/profile', '/admin', '/seller'] as const;
const SESSION_COOKIE = 'empire_session';
const API_RATE_LIMIT = Number.parseInt(process.env.API_RATE_LIMIT ?? '', 10) || 300;
const API_RATE_WINDOW_MS = Number.parseInt(process.env.API_RATE_WINDOW_MS ?? '', 10) || 60_000;

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
  for (const [key, value] of Object.entries(headers)) res.headers.set(key, value);
  return res;
}

function base64FromBytes(bytes: Uint8Array | ArrayLike<number>): string {
  // Prefer Buffer when available (Node)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof Buffer !== 'undefined') return (Buffer as any).from(bytes).toString('base64');
  // Fallback for browser/edge runtimes
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode((bytes as any)[i]);
  // btoa exists in many web runtimes
  if (typeof btoa !== 'undefined') return btoa(binary);
  // Last resort: return empty string (nonce will be absent)
  return '';
}

function makeNonce(): string {
  // Use Web Crypto when available (Edge/runtime). Otherwise fall back to Node crypto.
  if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    return base64FromBytes(bytes);
  }

  try {
    // dynamic require to avoid import-time failures in non-Node runtimes
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-member-access
    const { randomBytes } = require('node:crypto');
    const bytes = randomBytes(16);
    return base64FromBytes(bytes);
  } catch {
    // If all else fails, return an empty string so CSP will not include a nonce.
    return '';
  }
}

function sameOriginRequest(req: NextRequest): boolean {
  const forwardedHostHeader = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const forwardedHost = forwardedHostHeader ? forwardedHostHeader.split(',')[0].trim() : null;
  const forwardedProtoHeader = req.headers.get('x-forwarded-proto') ?? '';
  const forwardedProto = forwardedProtoHeader ? forwardedProtoHeader.split(',')[0].trim() : req.nextUrl.protocol.replace(':', '');

  const requestOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : req.nextUrl.origin;
  const origin = req.headers.get('origin');
  if (origin) return origin === requestOrigin;
  const referer = req.headers.get('referer');
  if (!referer) return false;
  try {
    return new URL(referer).origin === requestOrigin;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const nonce = makeNonce();

  if (pathname.startsWith('/api/')) {
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      pathname !== '/api/payments/callback' &&
      !sameOriginRequest(req)
    ) {
      return withSecurityHeaders(
        NextResponse.json(
          { ok: false, error: { code: 'csrf_rejected', message: 'Request origin could not be verified' } },
          { status: 403 },
        ),
        nonce,
      );
    }

    // Use distributed limiter when Redis/Upstash is configured; otherwise use in-memory limiter.
    const client = clientKey(req, 'api:global');
    const rl = isDistributedRateLimit
      ? await rateLimitAsync(client, { limit: API_RATE_LIMIT, windowMs: API_RATE_WINDOW_MS })
      : rateLimit(client, { limit: API_RATE_LIMIT, windowMs: API_RATE_WINDOW_MS });

    if (!rl.ok) {
      const res = NextResponse.json(
        { ok: false, error: { code: 'rate_limited', message: 'Too many requests' } },
        { status: 429 },
      );
      res.headers.set('Retry-After', Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000)).toString());
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
  if (isProtected(rest) && !req.cookies.get(SESSION_COOKIE)?.value) {
    const target = req.nextUrl.clone();
    target.pathname = `/${locale ?? routing.defaultLocale}/auth/login`;
    target.search = search ? `${search}&redirect=${encodeURIComponent(rest)}` : `?redirect=${encodeURIComponent(rest)}`;
    return withSecurityHeaders(NextResponse.redirect(target), nonce);
  }

  // intlMiddleware may be sync or async — await to be safe.
  const intlRes = await intlMiddleware(req);
  intlRes.headers.set('x-nonce', nonce);
  return withSecurityHeaders(intlRes, nonce);
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
