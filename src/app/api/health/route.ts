/**
 * Health check endpoint — Phase 10.
 *
 * Lightweight liveness + readiness probe for uptime monitors, load
 * balancers, and container orchestrators. Never touches user data.
 *
 * Response shape:
 *   { ok: true, status: 'healthy' | 'degraded',
 *     uptime, version, env, db: 'up' | 'down' | 'skipped', ts }
 *
 * The DB check is best-effort: if `DATABASE_URL` is unset (mock mode)
 * we report `db: 'skipped'`. A DB error downgrades status to `degraded`
 * but keeps a 200 response so liveness probes are not turned into
 * application traffic gates.
 *
 * Version source-of-truth: `process.env.npm_package_version` is set
 * by npm/pnpm when starting via a package.json script and matches
 * package.json exactly. The fallback `APP_VERSION` constant is kept in
 * sync with package.json so cold-start paths never report a stale version.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Matches the `version` field in package.json — single source of truth. */
const APP_VERSION = '0.13.0';

const START = Date.now();

async function checkDb(): Promise<'up' | 'down' | 'skipped'> {
  if (!process.env.DATABASE_URL) return 'skipped';
  try {
    const { prisma } = await import('@/lib/db');
    await prisma.$queryRawUnsafe('SELECT 1');
    return 'up';
  } catch {
    return 'down';
  }
}

export async function GET() {
  const db = await checkDb();
  const isProd = process.env.NODE_ENV === 'production';
  // Health endpoints are liveness/readiness signals for this app. Always
  // return HTTP 200 so both public probe contracts remain stable; the body
  // carries the degraded state for monitoring.
  const status = db === 'down' || (isProd && db === 'skipped') ? 'degraded' : 'healthy';
  return NextResponse.json(
    {
      ok: status === 'healthy',
      status,
      uptime: Math.round((Date.now() - START) / 1000),
      version: process.env.npm_package_version ?? APP_VERSION,
      env: process.env.NODE_ENV ?? 'development',
      db,
      ts: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    },
  );
}
