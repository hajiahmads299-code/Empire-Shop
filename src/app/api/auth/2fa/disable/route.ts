import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, err } from '@/lib/api/response';
import { requireUserApi } from '@/lib/auth/guards';
import { verifyPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const schema = z.object({ password: z.string().min(1) });

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
  if (!parsed.success) return err('VALIDATION_ERROR', 'رمز عبور الزامی است', 422);

  const { password } = parsed.data;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true, twoFactorEnabled: true },
    });
    if (!dbUser) return err('NOT_FOUND', 'کاربر یافت نشد', 404);
    if (!dbUser.twoFactorEnabled) {
      return err('NOT_ENABLED', 'احراز هویت دو مرحله‌ای فعال نیست', 400);
    }

    const valid = await verifyPassword(password, dbUser.passwordHash);
    if (!valid) return err('INVALID_PASSWORD', 'رمز عبور نادرست است', 401);

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    return ok({ message: 'احراز هویت دو مرحله‌ای غیرفعال شد.' });
  } catch (e) {
    logger.error('auth.2fa.disable.error', { userId: user.id, route: '/api/auth/2fa/disable' }, e);
    return err('INTERNAL_ERROR', 'خطای داخلی سرور', 500);
  }
}
