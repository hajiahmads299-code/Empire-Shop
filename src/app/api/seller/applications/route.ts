/**
 * Phase 11 — Seller Applications API.
 *
 * POST /api/seller/applications
 *   Any authenticated non-seller / non-admin user can submit an
 *   application to become a seller. Optional base64 `logoDataUrl`
 *   is decoded and persisted under public/uploads/seller-applications.
 *
 * GET  /api/seller/applications
 *   Returns the current user's latest application (or null).
 *
 * The user cannot submit while a `pending` application exists.
 */
import type { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma, isDatabaseConfigured } from '@/lib/db';
import { jsonError, jsonOk, jsonPreflight } from '@/lib/api/response';
import { getCurrentUser } from '@/lib/auth/current-user';
import { clientKey, rateLimit, RATE_PRESETS } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const MAX_LOGO_BYTES = 1.5 * 1024 * 1024;
const LOGO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};

const bodySchema = z.object({
  shopName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .min(6)
    .max(30)
    .regex(/^[+()0-9\s-]+$/, 'invalid phone'),
  address: z.string().trim().min(5).max(500),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  logoDataUrl: z.string().max(2_500_000).optional().or(z.literal('')),
});

export async function OPTIONS() {
  return jsonPreflight();
}

async function persistLogo(userId: string, dataUrl: string): Promise<string | null> {
  const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!match || !match[1] || !match[2]) return null;
  const ext = LOGO_EXT[match[1].toLowerCase()];
  if (!ext) return null;
  const buf = Buffer.from(match[2], 'base64');
  if (buf.byteLength > MAX_LOGO_BYTES) return null;
  const filename = `${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const dir = path.join(process.cwd(), 'public', 'uploads', 'seller-applications', userId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buf);
  return `/uploads/seller-applications/${userId}/${filename}`;
}

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return jsonError('unauthorized', 'Authentication required', { status: 401 });
  if (!isDatabaseConfigured()) return jsonOk({ application: null, mock: true });

  const app = await (prisma as unknown as {
    sellerApplication: {
      findFirst: (args: unknown) => Promise<unknown>;
    };
  }).sellerApplication.findFirst({
    where: { userId: me.id },
    orderBy: { createdAt: 'desc' },
  });
  return jsonOk({ application: app ?? null });
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return jsonError('unauthorized', 'Authentication required', { status: 401 });
  if (me.role !== 'customer') {
    return jsonError('forbidden', 'Only customers can apply', { status: 403 });
  }

  const rl = rateLimit(clientKey(req, 'seller:apply'), RATE_PRESETS.auth);
  if (!rl.ok) {
    return jsonError('rate_limited', 'تلاش‌های زیاد. کمی بعد دوباره امتحان کنید.', {
      status: 429,
    });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError('invalid_json', 'Invalid JSON', { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError('invalid_body', 'اطلاعات فرم نامعتبر است', {
      status: 422,
      details: { issues: parsed.error.flatten() },
    });
  }

  if (!isDatabaseConfigured()) {
    return jsonError('db_unavailable', 'Database is not configured', { status: 503 });
  }

  const existing = await prisma.sellerApplication.findFirst({
    where: { userId: me.id, status: 'pending' },
  });
  if (existing) {
    return jsonError('application_pending', 'یک درخواست در انتظار بررسی دارید', {
      status: 409,
    });
  }

  let logoUrl: string | null = null;
  if (parsed.data.logoDataUrl && parsed.data.logoDataUrl.length > 0) {
    try {
      logoUrl = await persistLogo(me.id, parsed.data.logoDataUrl);
    } catch (err) {
      logger.warn('seller.apply.logo_persist_failed', { userId: me.id, err: String(err) });
    }
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const application = await tx.sellerApplication.create({
        data: {
          userId: me.id,
          shopName: parsed.data.shopName.trim(),
          ownerName: parsed.data.ownerName.trim(),
          phone: parsed.data.phone.trim(),
          address: parsed.data.address.trim(),
          description: parsed.data.description?.trim() || null,
          logoUrl,
          status: 'pending',
        },
      });
      await tx.user.update({
        where: { id: me.id },
        data: { sellerStatus: 'pending', sellerShopName: parsed.data.shopName.trim() },
      });
      return application;
    });
    return jsonOk({ id: created.id }, { status: 201 });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002') {
      return jsonError('application_pending', 'یک درخواست در انتظار بررسی دارید', { status: 409 });
    }
    logger.error('seller.apply.create_failed', { userId: me.id }, err);
    return jsonError('create_failed', 'ثبت درخواست با خطا مواجه شد', { status: 500 });
  }
}
