/**
 * Public shipping methods — Phase 3
 * GET /api/shipping-methods → list of active methods, sorted by sortOrder
 */
import type { NextRequest } from 'next/server';
import { prisma, isDatabaseConfigured } from '@/lib/db';
import { jsonError, jsonOk, jsonPreflight } from '@/lib/api/response';
import { clientKey, rateLimit } from '@/lib/api/rate-limit';
import { mapShippingMethod } from '@/lib/db-mappers';
import type { ShippingMethod } from '@/types';

export const dynamic = 'force-dynamic';

/** Static fallback so the UI still works without a DB. */
const FALLBACK: ShippingMethod[] = [
  { id: 'sm_standard', key: 'standard', name: 'ارسال عادی', description: 'ارسال معمولی در سراسر افغانستان', kind: 'standard', cost: 10, currency: 'AFN', etaDays: 5, isActive: true, sortOrder: 10 },
  { id: 'sm_express',  key: 'express',  name: 'ارسال سریع', description: 'ارسال اکسپرس ۱ تا ۲ روز کاری', kind: 'express',  cost: 20, currency: 'AFN', etaDays: 2, isActive: true, sortOrder: 20 },
  { id: 'sm_cod',      key: 'cod',      name: 'پرداخت هنگام تحویل', description: 'پرداخت وجه به پیک هنگام تحویل', kind: 'cod', cost: 15, currency: 'AFN', etaDays: 5, isActive: true, sortOrder: 30 },
];

export async function OPTIONS() { return jsonPreflight(); }

export async function GET(req: NextRequest) {
  const rl = rateLimit(clientKey(req, 'ship:list'), { limit: 120 });
  if (!rl.ok) return jsonError('rate_limited', 'Too many requests', { status: 429 });

  if (!isDatabaseConfigured()) {
    return jsonOk({ items: FALLBACK }, { meta: { source: 'fallback' } });
  }
  try {
    const rows = await prisma.shippingMethod.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    if (rows.length === 0) return jsonOk({ items: FALLBACK }, { meta: { source: 'fallback' } });
    return jsonOk({ items: rows.map(mapShippingMethod) }, { meta: { source: 'db' } });
  } catch (e) {
    console.error('[shipping-methods] fallback:', e);
    return jsonOk({ items: FALLBACK }, { meta: { source: 'fallback' } });
  }
}
