/**
 * Create/update the admin user in the database.
 * Run: npx tsx scripts/seed-admin.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('Admin@1234', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@empire.shop' },
    update: { passwordHash: hash, role: 'admin', isActive: true },
    create: {
      fullName: 'مدیر سیستم',
      email: 'admin@empire.shop',
      passwordHash: hash,
      role: 'admin',
      isActive: true,
    },
  });
  console.log('✅ Admin user ready:', user.email, '— role:', user.role);
  await prisma.$disconnect();
}

main().catch(console.error);
