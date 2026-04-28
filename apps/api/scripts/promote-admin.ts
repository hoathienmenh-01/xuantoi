/**
 * Helper script: promote a user to ADMIN by email.
 *   pnpm --filter @xuantoi/api exec ts-node scripts/promote-admin.ts user@example.com
 *
 * Để bootstrap admin đầu tiên trên môi trường mới, dùng `scripts/bootstrap.ts`
 * (đọc env `INITIAL_ADMIN_EMAIL` + `INITIAL_ADMIN_PASSWORD`).
 */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: promote-admin <email>');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const u = await prisma.user.findUnique({ where: { email } });
    if (!u) {
      console.error(`User not found: ${email}`);
      process.exit(2);
    }
    await prisma.user.update({ where: { id: u.id }, data: { role: 'ADMIN', banned: false } });
    console.log(`Promoted ${email} → ADMIN.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
