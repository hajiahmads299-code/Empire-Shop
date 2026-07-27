import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { prisma, isDatabaseConfigured } from '@/lib/db';
import { SellerApplicationActions } from '@/features/admin/components/seller-application-actions';

export const dynamic = 'force-dynamic';

type Status = 'pending' | 'approved' | 'rejected';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}

const STATUS_TABS: { key: Status | 'all'; label: string }[] = [
  { key: 'pending', label: 'در انتظار' },
  { key: 'approved', label: 'تایید شده' },
  { key: 'rejected', label: 'رد شده' },
  { key: 'all', label: 'همه' },
];

const BADGES: Record<Status, string> = {
  pending: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-700 border-red-500/30',
};

const LABELS: Record<Status, string> = {
  pending: 'در انتظار تأیید',
  approved: 'تایید شده',
  rejected: 'رد شده',
};

function formatDate(d: Date | string): string {
  try {
    return new Date(d).toLocaleDateString('fa-IR');
  } catch {
    return String(d);
  }
}

interface AppRow {
  id: string;
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  description: string | null;
  logoUrl: string | null;
  status: Status;
  rejectionReason: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  user: { id: string; fullName: string; email: string | null; phone: string | null };
  reviewedBy: { id: string; fullName: string } | null;
}

export default async function AdminSellerApplicationsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const statusFilter =
    sp.status === 'approved' || sp.status === 'rejected' || sp.status === 'all'
      ? sp.status
      : 'pending';

  let items: AppRow[] = [];
  let dbAvailable = isDatabaseConfigured();
  if (dbAvailable) {
    try {
      const where = statusFilter === 'all' ? {} : { status: statusFilter };
      items = (await (
        prisma as unknown as {
          sellerApplication: { findMany: (a: unknown) => Promise<unknown[]> };
        }
      ).sellerApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true } },
          reviewedBy: { select: { id: true, fullName: true } },
        },
      })) as AppRow[];
    } catch (err) {
      console.error('[admin/seller-applications]', err);
      dbAvailable = false;
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-bold text-foreground">درخواست‌های فروشندگی</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          بررسی، تایید و رد درخواست‌های ثبت‌شده توسط کاربران
        </p>
      </header>

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {STATUS_TABS.map((t) => {
            const href =
              `/${locale}/admin/seller-applications` +
              (t.key === 'pending' ? '' : `?status=${t.key}`);
            const active = statusFilter === t.key;
            return (
              <Link
                key={t.key}
                href={href}
                className={`inline-flex h-8 items-center rounded-md px-3 text-xs font-medium transition ${
                  active
                    ? 'bg-card text-foreground shadow-sm dark:bg-card'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        {!dbAvailable ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            پایگاه داده در دسترس نیست.
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            درخواستی برای نمایش وجود ندارد.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((a) => (
              <div
                key={a.id}
                className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[auto_1fr_auto]"
              >
                <div className="flex items-start">
                  {a.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.logoUrl}
                      alt={a.shopName}
                      className="h-16 w-16 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-xl font-bold text-muted-foreground">
                      {a.shopName.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">{a.shopName}</h3>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${BADGES[a.status]}`}
                    >
                      {LABELS[a.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {a.ownerName} · {a.user.fullName} · {a.user.email ?? a.user.phone ?? '—'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                    📞 {a.phone}
                  </p>
                  <p className="mt-1 text-sm text-foreground">{a.address}</p>
                  {a.description && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {a.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    ثبت: {formatDate(a.createdAt)}
                    {a.reviewedAt && (
                      <>
                        {' '}
                        · بررسی: {formatDate(a.reviewedAt)}
                        {a.reviewedBy && <> توسط {a.reviewedBy.fullName}</>}
                      </>
                    )}
                  </p>
                  {a.status === 'rejected' && a.rejectionReason && (
                    <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-800">
                      دلیل رد: {a.rejectionReason}
                    </p>
                  )}
                </div>
                <div className="flex items-start justify-end">
                  <SellerApplicationActions applicationId={a.id} status={a.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
