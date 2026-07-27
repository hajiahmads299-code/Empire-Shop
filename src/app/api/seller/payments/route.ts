/**
 * Seller Payments / Transactions API — Phase 13 (Prisma)
 *
 * GET /api/seller/payments
 *
 * Returns wallet transactions for the authenticated seller with
 * pagination, type filter, and summary.
 *
 * Stage 6 fixes:
 *  - `type` query-param filter was parsed but never applied to the DB query;
 *    now forwarded to both `findMany` and `count`.
 *  - Summary previously fetched ALL transactions into memory then filtered in JS
 *    — O(n) full-table scan. Now computed with two server-side `aggregate` calls.
 *  - console.error replaced with structured logger.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma, isDatabaseConfigured } from '@/lib/db';
import { requireSellerApi } from '@/lib/auth/require-seller-api';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guard = await requireSellerApi();
  if (!guard.ok) return guard.response;

  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      data: {
        transactions: [],
        summary: { totalIncome: 0, totalWithdrawal: 0, balance: 0 },
        pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
        source: 'mock',
      },
    });
  }

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
  const limit = Math.min(50, Math.max(5, parseInt(sp.get('limit') ?? '10', 10) || 10));
  // FIX: carry `type` through to all DB queries instead of discarding it.
  const type = sp.get('type') || undefined;

  const baseWhere = {
    sellerId: guard.user.id,
    ...(type ? { type } : {}),
  };

  try {
    // FIX: compute summary with aggregate — no full-table scan.
    const [transactions, total, incomeAgg, payoutAgg] = await Promise.all([
      prisma.walletTransaction.findMany({
        // FIX: apply type filter to paginated list.
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      // FIX: apply type filter to count as well.
      prisma.walletTransaction.count({ where: baseWhere }),
      // FIX: server-side aggregation for income instead of JS reduce over full table.
      prisma.walletTransaction.aggregate({
        where: { sellerId: guard.user.id, type: 'sale' },
        _sum: { amount: true },
      }),
      // FIX: server-side aggregation for withdrawals.
      prisma.walletTransaction.aggregate({
        where: { sellerId: guard.user.id, type: 'payout' },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = incomeAgg._sum.amount ?? 0;
    const totalWithdrawal = Math.abs(payoutAgg._sum.amount ?? 0);
    const balance = totalIncome - totalWithdrawal;

    return NextResponse.json({
      ok: true,
      data: {
        transactions,
        summary: { totalIncome, totalWithdrawal, balance },
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        source: 'db',
      },
    });
  } catch (err) {
    logger.error('seller.payments.error', { sellerId: guard.user.id }, err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
