import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, err } from '@/lib/api/response';
import { requireUserApi } from '@/lib/auth/guards';
import { verifyTotpCode } from '@/lib/totp';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const schema = z.object({ code: z.string().length(6) });

export async function POST(req: NextRequest) {
  const { user, response } = await requireUserApi();
  if (response) return response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err('INVALID_JSON', 'Invalid request body', 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return err('VALIDATION_ERROR', 'کد باید ۶ رقم باشد', 422);

  const { code } = parsed.data;

  try {
    // Get latest secret from DB.
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });
    if (!dbUser?.twoFactorSecret) {
      return err('NO_SECRET', 'ابتدا باید راه‌اندازی ۲FA را شروع کنید', 400);
    }

    if (!verifyTotpCode(dbUser.twoFactorSecret, code)) {
      return err('INVALID_CODE', 'کد نادرست است', 400);
    }

    // If not yet enabled, enable it now (first-time verification).
    if (!dbUser.twoFactorEnabled) {
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: true },
      });
    }

    return ok({ message: 'احراز هویت دو مرحله‌ای با موفقیت فعال شد.' });
  } catch (e) {
    logger.error('auth.2fa.verify.error', { userId: user.id, route: '/api/auth/2fa/verify' }, e);
    return err('INTERNAL_ERROR', 'خطای داخلی سرور', 500);
  }
}
