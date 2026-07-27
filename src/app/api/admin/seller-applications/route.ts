/**
 * Phase 11 — Admin Seller Applications: list.
 * GET /api/admin/seller-applications?status=pending&page=1
 */
import type { NextRequest } from 'next/server';
import { prisma, isDatabaseConfigured } from '@/lib/db';
import { jsonOk, jsonPreflight } from '@/lib/api/response';
import { requireAdminApi } from '@/lib/auth/require-admin-api';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return jsonPreflight();
}

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(50, Math.max(5, parseInt(sp.get('pageSize') ?? '20', 10) || 20));
  const statusRaw = sp.get('status');
  const status =
    statusRaw === 'pending' || statusRaw === 'approved' || statusRaw === 'rejected'
      ? statusRaw
      : undefined;

  if (!isDatabaseConfigured()) {
    return jsonOk({ items: [], total: 0, page, pageSize, mock: true });
  }

  const model = (prisma as unknown as {
    sellerApplication: {
      findMany: (a: unknown) => Promise<unknown[]>;
      count: (a: unknown) => Promise<number>;
    };
  }).sellerApplication;

  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    model.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true } },
      },
    }),
    model.count({ where }),
  ]);

  return jsonOk({ items, total, page, pageSize });
}
