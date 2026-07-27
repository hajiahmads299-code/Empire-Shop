/**
 * Phase 11 — Admin Seller Application: review one.
 * PATCH /api/admin/seller-applications/[id]  { action: 'approve' | 'reject', rejectionReason? }
 * GET   /api/admin/seller-applications/[id]
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseConfigured } from '@/lib/db';
import { jsonError, jsonOk, jsonPreflight } from '@/lib/api/response';
import { requireAdminApi } from '@/lib/auth/require-admin-api';
import { writeAuditLog } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

const patchSchema = z
  .object({
    action: z.enum(['approve', 'reject']),
    rejectionReason: z.string().trim().max(1000).optional(),
  })
  .strict();

export async function OPTIONS() {
  return jsonPreflight();
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  if (!isDatabaseConfigured())
    return jsonError('db_unavailable', 'Database is not configured', { status: 503 });

  const app = await (prisma as unknown as {
    sellerApplication: { findUnique: (a: unknown) => Promise<unknown> };
  }).sellerApplication.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, fullName: true, email: true, phone: true, role: true } },
      reviewedBy: { select: { id: true, fullName: true } },
    },
  });
  if (!app) return jsonError('not_found', 'Not found', { status: 404 });
  return jsonOk(app);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  if (!isDatabaseConfigured())
    return jsonError('db_unavailable', 'Database is not configured', { status: 503 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError('invalid_json', 'Invalid JSON', { status: 400 });
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError('invalid_body', 'Invalid patch', {
      status: 422,
      details: { issues: parsed.error.issues },
    });
  }
  if (parsed.data.action === 'reject' && !parsed.data.rejectionReason) {
    return jsonError('reason_required', 'دلیل رد الزامی است', { status: 422 });
  }

  const model = (prisma as unknown as {
    sellerApplication: {
      findUnique: (a: unknown) => Promise<{
        id: string;
        userId: string;
        status: string;
        shopName: string;
        description: string | null;
      } | null>;
      update: (a: unknown) => Promise<unknown>;
    };
  }).sellerApplication;

  const app = await model.findUnique({ where: { id } });
  if (!app) return jsonError('not_found', 'Not found', { status: 404 });
  if (app.status !== 'pending') {
    return jsonError('already_reviewed', 'این درخواست قبلاً بررسی شده است', { status: 409 });
  }

  const now = new Date();

  if (parsed.data.action === 'approve') {
    const changed = await prisma.$transaction(async (tx) => {
      const result = await tx.sellerApplication.updateMany({
        where: { id: app.id, status: 'pending' },
        data: {
          status: 'approved',
          reviewedById: guard.user.id,
          reviewedAt: now,
          rejectionReason: null,
        },
      });
      if (result.count === 0) return false;
      await tx.user.update({
        where: { id: app.userId },
        data: {
          role: 'seller',
          sellerStatus: 'approved',
          sellerShopName: app.shopName,
          sellerBio: app.description ?? undefined,
        },
      });
      await tx.sellerNotification.create({
        data: {
          sellerId: app.userId,
          title: 'درخواست فروشندگی تأیید شد',
          message: `فروشگاه «${app.shopName}» تأیید شد. اکنون پنل فروشنده برای شما فعال است.`,
          type: 'success',
          link: '/seller',
        },
      });
      return true;
    });
    if (!changed) {
      return jsonError('already_reviewed', 'این درخواست قبلاً بررسی شده است', { status: 409 });
    }
    await writeAuditLog({
      actor: { id: guard.user.id, role: guard.user.role },
      action: 'seller.status_change',
      entityType: 'seller',
      entityId: app.userId,
      before: { status: app.status },
      after: { status: 'approved', applicationId: app.id },
      req,
    });
    return jsonOk({ id: app.id, status: 'approved' });
  }

  // reject
  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.sellerApplication.updateMany({
      where: { id: app.id, status: 'pending' },
      data: {
        status: 'rejected',
        reviewedById: guard.user.id,
        reviewedAt: now,
        rejectionReason: parsed.data.rejectionReason,
      },
    });
    if (result.count === 0) return false;
    await tx.user.update({
      where: { id: app.userId },
      data: { sellerStatus: 'rejected' },
    });
    await tx.sellerNotification.create({
      data: {
        sellerId: app.userId,
        title: 'درخواست فروشندگی رد شد',
        message: `درخواست فروشگاه «${app.shopName}» رد شد. دلیل: ${parsed.data.rejectionReason}`,
        type: 'warning',
        link: '/seller/apply',
      },
    });
    return true;
  });
  if (!changed) {
    return jsonError('already_reviewed', 'این درخواست قبلاً بررسی شده است', { status: 409 });
  }
  await writeAuditLog({
    actor: { id: guard.user.id, role: guard.user.role },
    action: 'seller.status_change',
    entityType: 'seller',
    entityId: app.userId,
    before: { status: app.status },
    after: { status: 'rejected', applicationId: app.id, reason: parsed.data.rejectionReason },
    req,
  });
  return jsonOk({ id: app.id, status: 'rejected' });
}
