import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma, isDatabaseConfigured } from '@/lib/db';
import { jsonError, jsonOk, jsonPreflight } from '@/lib/api/response';
import { requireAdminApi } from '@/lib/auth/require-admin-api';
import { creditSellersForOrder } from '@/lib/finance/wallet';
import { recordAudit } from '@/lib/audit/log';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
});

export async function OPTIONS() {
  return jsonPreflight();
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('invalid_json', 'Invalid JSON', { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('invalid_body', 'Invalid status', {
      status: 422,
      details: { issues: parsed.error.issues },
    });
  }
  if (!isDatabaseConfigured()) {
    // Mock mode — pretend we updated it.
    return jsonOk({ id, status: parsed.data.status, mock: true });
  }
  try {
    // Read previous status inside the same transaction so the audit
    // snapshot is coherent with the update. A missing row 404s early.
    // Phase 10.4 fix: on cancellation, restore stock for every line
    // item atomically, and forbid `delivered -> cancelled` (which
    // would leave sellers credited for goods that never came back).
    const result = await prisma.$transaction(async (tx) => {
      const previous = await tx.order.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          items: { select: { productId: true, quantity: true } },
        },
      });
      if (!previous) return { previous: null, updated: null, restoredLines: 0 };

      const goingToCancel =
        parsed.data.status === 'cancelled' && previous.status !== 'cancelled';

      if (goingToCancel && previous.status === 'delivered') {
        throw new OrderTransitionError(
          'invalid_transition',
          'A delivered order cannot be cancelled — issue a refund instead.',
        );
      }

      // Race-safe atomic transition: only apply when the row is still
      // in the status we just read. Prevents two concurrent admins
      // from both flipping status and both restoring stock.
      const transitioned = await tx.order.updateMany({
        where: { id, status: previous.status },
        data: { status: parsed.data.status },
      });
      if (transitioned.count === 0) {
        throw new OrderTransitionError(
          'conflict',
          'Order status changed concurrently. Please refresh and retry.',
        );
      }

      let restoredLines = 0;
      if (goingToCancel) {
        for (const item of previous.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: { increment: item.quantity },
              salesCount: { decrement: item.quantity },
              // FIX (Stage 6): restore inStock=true when stock comes back after
              // cancellation. Previously the flag stayed false permanently even
              // though stockQuantity was incremented back above zero.
              inStock: true,
            },
          });
          restoredLines += 1;
        }
      }

      const updated = await tx.order.findUniqueOrThrow({ where: { id } });
      return { previous, updated, restoredLines };
    });

    if (!result.previous || !result.updated) {
      return jsonError('not_found', 'Order not found', { status: 404 });
    }
    const { previous, updated, restoredLines } = result;

    // Phase 7: credit seller wallets exactly once when an order is delivered.
    // creditSellersForOrder is itself idempotent (dedupeKey per orderItem).
    let creditedSellerLines = 0;
    if (updated.status === 'delivered') {
      creditedSellerLines = await creditSellersForOrder(updated.id);
    }

    await recordAudit({
      actor: { id: guard.user.id, role: guard.user.role },
      action: 'order.status_change',
      entityType: 'order',
      entityId: updated.id,
      before: { status: previous.status },
      after: { status: updated.status },
      metadata: { creditedSellerLines, restoredLines },
      req,
    });

    return jsonOk({
      id: updated.id,
      status: updated.status,
      creditedSellerLines,
      restoredLines,
    });
  } catch (err) {
    if (err instanceof OrderTransitionError) {
      return jsonError(err.code, err.message, { status: 409 });
    }
    logger.error('admin.orders.patch_failed', { orderId: id, adminId: guard.user.id }, err);
    return jsonError('update_failed', 'Failed to update order', { status: 500 });
  }
}

/** Thrown inside the admin-order transaction so business rule violations
 *  (invalid transition, concurrent update) surface as 409 instead of 500. */
class OrderTransitionError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}
