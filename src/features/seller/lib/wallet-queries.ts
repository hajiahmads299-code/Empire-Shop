/**
 * Read-side helpers for wallet UI + APIs. Kept separate from
 * `wallet.ts` so pure business logic stays free of pagination/UI concerns.
 */
import { prisma, isDatabaseConfigured } from '@/lib/db';
import { ensureWallet } from '@/lib/finance/wallet';

export interface WalletSummary {
  balance: number;
  totalEarned: number;
  totalPaidOut: number;
  pendingPayoutAmount: number;
  currency: string;
  commissionRate: number;
  source: 'db' | 'empty';
}

export async function getWalletSummary(sellerId: string): Promise<WalletSummary> {
  const empty: WalletSummary = {
    balance: 0,
    totalEarned: 0,
    totalPaidOut: 0,
    pendingPayoutAmount: 0,
    currency: 'AFN',
    commissionRate: 10,
    source: 'empty',
  };
  if (!isDatabaseConfigured()) return empty;

  const wallet = await ensureWallet(sellerId);
  const user = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { commissionRate: true },
  });
  const pending = await prisma.payout.aggregate({
    where: { sellerId, status: { in: ['pending', 'approved'] } },
    _sum: { amount: true },
  });
  return {
    balance: wallet.balance,
    totalEarned: wallet.totalEarned,
    totalPaidOut: wallet.totalPaidOut,
    pendingPayoutAmount: pending._sum.amount ?? 0,
    currency: wallet.currency,
    commissionRate: user?.commissionRate ?? 10,
    source: 'db',
  };
}

export async function listWalletTransactions(sellerId: string, limit = 50) {
  if (!isDatabaseConfigured()) return [];
  return prisma.walletTransaction.findMany({
    where: { sellerId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function listSellerPayouts(sellerId: string, limit = 50) {
  if (!isDatabaseConfigured()) return [];
  return prisma.payout.findMany({
    where: { sellerId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function listAllPayouts(status?: 'pending' | 'approved' | 'paid' | 'rejected') {
  if (!isDatabaseConfigured()) return [];
  return prisma.payout.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      seller: { select: { id: true, fullName: true, email: true, sellerShopName: true } },
    },
    take: 200,
  });
}
