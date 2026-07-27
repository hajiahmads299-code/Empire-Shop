import { Container } from '@/components/layout/container';
import { requireAuth } from '@/lib/auth/roles';
import { redirect } from '@/i18n/routing';
import { prisma, isDatabaseConfigured } from '@/lib/db';
import { SellerApplyForm } from '@/features/seller/components/apply-form';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function SellerApplyPage({ params }: Props) {
  const { locale } = await params;
  const user = await requireAuth({ locale });

  // Sellers and admins don't need to apply.
  if (user.role === 'seller' || user.role === 'admin') {
    redirect({ href: '/seller', locale });
  }

  let initialApplication = null as Awaited<ReturnType<typeof loadApp>> | null;
  if (isDatabaseConfigured()) {
    initialApplication = await loadApp(user.id);
  }

  return (
    <Container size="lg" className="py-10">
      <SellerApplyForm
        locale={locale}
        initialApplication={initialApplication}
        canApply={user.role === 'customer'}
      />
    </Container>
  );
}

async function loadApp(userId: string) {
  const app = await (prisma as unknown as {
    sellerApplication: { findFirst: (a: unknown) => Promise<unknown | null> };
  }).sellerApplication.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  if (!app) return null;
  const a = app as {
    id: string;
    shopName: string;
    ownerName: string;
    phone: string;
    address: string;
    description: string | null;
    logoUrl: string | null;
    status: 'pending' | 'approved' | 'rejected';
    rejectionReason: string | null;
    createdAt: Date;
  };
  return {
    id: a.id,
    shopName: a.shopName,
    ownerName: a.ownerName,
    phone: a.phone,
    address: a.address,
    description: a.description,
    logoUrl: a.logoUrl,
    status: a.status,
    rejectionReason: a.rejectionReason,
    createdAt: a.createdAt.toISOString(),
  };
}
