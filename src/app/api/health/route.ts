/**
 * Health check endpoint.
 *
 * Liveness + readiness probe for uptime monitors, load balancers and
 * deployment platforms. Never touches user data and never mutates.
 *
 * Response shape:
 *   { ok, status: 'healthy' | 'degraded',
 *     uptime, version, env, db: 'up' | 'down' | 'skipped',
 *     schema: 'ready' | 'pending' | 'missing' | 'unknown' | 'skipped',
 *     migrations, ts }
 *
 * `schema` verifies that Prisma migrations have actually been applied to
 * the connected database, so a deploy against an un-migrated database is
 * reported as `degraded` instead of silently serving 500s.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Matches the `version` field in package.json — single source of truth. */
const APP_VERSION = '0.13.0';

const START = Date.now();

type DbState = 'up' | 'down' | 'skipped';
type SchemaState = 'ready' | 'pending' | 'missing' | 'unknown' | 'skipped';

function hasDatabaseUrl(): boolean {
  return Boolean(
    process.env.DATABASE_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING,
  );
}

async function check(): Promise<{ db: DbState; schema: SchemaState; migrations: number | null }> {
  if (!hasDatabaseUrl()) return { db: 'skipped', schema: 'skipped', migrations: null };

  let prisma: typeof import('@/lib/db')['prisma'];
  try {
    ({ prisma } = await import('@/lib/db'));
    await prisma.$queryRawUnsafe('SELECT 1');
  } catch {
    return { db: 'down', schema: 'unknown', migrations: null };
  }

  try {
    const rows = await prisma.$queryRawUnsafe<
      { applied: bigint | number; failed: bigint | number }[]
    >(
      `SELECT
         COUNT(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS applied,
         COUNT(*) FILTER (WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL) AS failed
       FROM "_prisma_migrations"`,
    );
    const applied = Number(rows?.[0]?.applied ?? 0);
    const failed = Number(rows?.[0]?.failed ?? 0);
    if (applied === 0) return { db: 'up', schema: 'missing', migrations: 0 };
    if (failed > 0) return { db: 'up', schema: 'pending', migrations: applied };
    return { db: 'up', schema: 'ready', migrations: applied };
  } catch {
    // No `_prisma_migrations` table at all — the schema was never deployed.
    return { db: 'up', schema: 'missing', migrations: null };
  }
}

export async function GET() {
  const { db, schema, migrations } = await check();
  const isProd = process.env.NODE_ENV === 'production';

  const degraded =
    db === 'down' ||
    (isProd && db === 'skipped') ||
    schema === 'missing' ||
    schema === 'pending' ||
    (isProd && schema === 'unknown');

  const status = degraded ? 'degraded' : 'healthy';

  // Always return HTTP 200 so probe contracts stay stable; the body carries
  // the degraded state for monitoring.
  return NextResponse.json(
    {
      ok: status === 'healthy',
      status,
      uptime: Math.round((Date.now() - START) / 1000),
      version: process.env.npm_package_version ?? APP_VERSION,
      env: process.env.NODE_ENV ?? 'development',
      db,
      schema,
      migrations,
      ts: new Date().toISOString(),
    },
    { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
