/**
 * Create/update the admin user in the database.
 * Run: ADMIN_PASSWORD_HASH=<hash> ADMIN_EMAIL=admin@empire.shop npx tsx scripts/seed-admin.ts
 * Or: ADMIN_PASSWORD=<plain> ADMIN_EMAIL=admin@empire.shop npx tsx scripts/seed-admin.ts
 *
 * Important: Do NOT commit plain passwords. Prefer setting ADMIN_PASSWORD_HASH.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@empire.shop';
  const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!ADMIN_PASSWORD_HASH && !ADMIN_PASSWORD) {
    console.error(
      'ERROR: No ADMIN_PASSWORD_HASH or ADMIN_PASSWORD provided.\n' +
        'Set ADMIN_PASSWORD_HASH to a bcrypt hash, or set ADMIN_PASSWORD (local only) and the script will hash it for you.\n' +
        'You can produce a hash with: npx tsx scripts/hash-password.ts <your-password>\n' +
        'Example: ADMIN_PASSWORD_HASH="$2a$10$..." ADMIN_EMAIL=admin@empire.shop npx tsx scripts/seed-admin.ts'
    );
    process.exit(1);
  }

  const hash = ADMIN_PASSWORD_HASH ?? (await bcrypt.hash(ADMIN_PASSWORD!, 10));

  try {
    const user = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: { passwordHash: hash, role: 'admin', isActive: true },
      create: {
        fullName: 'مدیر سیستم',
        email: ADMIN_EMAIL,
        passwordHash: hash,
        role: 'admin',
        isActive: true,
      },
    });

    console.log('✅ Admin user ready:', user.email, '— role:', user.role);
  } catch (err) {
    console.error('❌ Failed to seed admin user:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌ Seed failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
