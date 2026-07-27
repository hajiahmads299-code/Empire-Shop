import { NextRequest } from 'next/server';
import { ok, err } from '@/lib/api/response';
import { requireUserApi } from '@/lib/auth/guards';
import { generateTotpSecret, buildOtpAuthUri, buildQrCodeUrl } from '@/lib/totp';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(_req: NextRequest) {
  const { user, response } = await requireUserApi();
  if (response) return response;

  if (user.twoFactorEnabled) {
    return err('ALREADY_ENABLED', 'احراز هویت دو مرحله‌ای قبلاً فعال شده است', 400);
  }

  try {
    const secret = generateTotpSecret();
    const account = user.email ?? user.phone ?? user.id;
    const otpAuthUri = buildOtpAuthUri(secret, account);
    const qrCodeUrl = buildQrCodeUrl(otpAuthUri);

    // Store secret temporarily in DB (not yet enabled until verified).
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret } });

    return ok({ secret, qrCodeUrl, otpAuthUri });
  } catch (e) {
    logger.error('auth.2fa.setup.error', { userId: user.id, route: '/api/auth/2fa/setup' }, e);
    return err('INTERNAL_ERROR', 'خطای داخلی سرور', 500);
  }
}
