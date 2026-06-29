#!/usr/bin/env ts-node
/**
 * Run with: npx ts-node --project tsconfig.json prisma/createAdmin.ts
 *
 * Creates the initial Administrator account.
 * Set environment variables before running:
 *   ADMIN_EMAIL, ADMIN_FIRST_NAME, ADMIN_LAST_NAME, ADMIN_PASSWORD
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@example.com';
  const firstName = process.env.ADMIN_FIRST_NAME ?? 'Admin';
  const lastName = process.env.ADMIN_LAST_NAME ?? 'User';
  const password = process.env.ADMIN_PASSWORD ?? 'Admin@123';

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✓ Admin user already exists: ${email}`);
    await db.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const name = `${firstName} ${lastName}`.trim();

  const admin = await db.user.create({
    data: {
      firstName,
      lastName,
      name,
      email,
      passwordHash,
      role: 'ADMIN',
      active: true,
      forcePasswordChange: false,
      currency: 'USD',
    },
  });

  console.log(`✓ Admin account created:`);
  console.log(`  Name  : ${admin.name}`);
  console.log(`  Email : ${admin.email}`);
  console.log(`  Role  : ${admin.role}`);
  console.log(`\n⚠  Change the password immediately after first login.`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
