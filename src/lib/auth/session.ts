/**
 * Signed, HTTP-only session cookie.
 * Payload: base64url(JSON({ uid, exp })) + '.' + base64url(HMAC-SHA256)
 */
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'empire_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

interface SessionPayload {
  uid: string;
  exp: number;
}

function getSecret(): string {
  const s =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    // Non-fatal in dev, but log so ops rotate in prod.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET must be set (min 32 chars) in production.');
    }
    return 'dev-insecure-secret-change-me-please-32b';
  }
  return s;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

function sign(payloadB64: string): string {
  return createHmac('sha256', getSecret()).update(payloadB64).digest('base64url');
}

export function encodeSession(uid: string): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload: SessionPayload = { uid, exp };
  const p = b64url(JSON.stringify(payload));
  const sig = sign(p);
  return `${p}.${sig}`;
}

export function decodeSession(token: string): SessionPayload | null {
  const [p, sig] = token.split('.');
  if (!p || !sig) return null;
  const expected = sign(p);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(fromB64url(p).toString('utf8')) as SessionPayload;
    if (!payload?.uid || !payload?.exp) return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(uid: string, res?: NextResponse): Promise<void> {
  const value = encodeSession(uid);
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  } as const;

  if (res && typeof res.cookies?.set === 'function') {
    // Set cookie on the provided response (preferred in route handlers where
    // a NextResponse is being returned)
    res.cookies.set(SESSION_COOKIE, value, opts);
    return;
  }

  // Fallback: use the global cookies store (middleware/edge contexts)
  const store = await cookies();
  store.set(SESSION_COOKIE, value, opts as any);
}

export async function clearSessionCookie(res?: NextResponse): Promise<void> {
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  } as const;

  if (res && typeof res.cookies?.set === 'function') {
    res.cookies.set(SESSION_COOKIE, '', opts);
    return;
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, '', opts as any);
}

export async function readSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return decodeSession(token)?.uid ?? null;
}

/**
 * Phase 12 — Lightweight session shape expected by some auth helpers
 * (notably `./guards` for the email/phone verification endpoints). It just
 * exposes the userId; the role / verification status are loaded
 * separately via `getCurrentUser`.
 */
export interface SessionPayloadShape {
  userId: string;
}

export async function getSessionPayload(): Promise<SessionPayloadShape | null> {
  const uid = await readSessionUserId();
  if (!uid) return null;
  return { userId: uid };
}
