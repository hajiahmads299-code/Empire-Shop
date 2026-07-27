import type { NextRequest } from 'next/server';
import { prisma, isDatabaseConfigured } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/current-user';
import { jsonError, jsonOk, jsonPreflight } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return jsonPreflight();
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError('unauthorized', 'Authentication required', { status: 401 });
  if (!isDatabaseConfigured()) return jsonOk({ items: [], unreadCount: 0, mock: true });

  const limit = Math.min(30, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 10) || 10));
  const [items, unreadCount] = await Promise.all([
    prisma.sellerNotification.findMany({
      where: { sellerId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.sellerNotification.count({ where: { sellerId: user.id, isRead: false } }),
  ]);

  return jsonOk({ items, unreadCount });
}