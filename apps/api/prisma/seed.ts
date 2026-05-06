import { PrismaClient, Role } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const productionLines = Array.from({ length: 14 }, (_, index) => {
  const lineNumber = index + 1;
  const padded = String(lineNumber).padStart(2, '0');

  return {
    code: `LINE-${padded}`,
    name: `产线${padded}`,
    isActive: true,
    sortOrder: lineNumber
  };
});

if (productionLines.length !== 14 || productionLines.at(-1)?.code !== 'LINE-14') {
  throw new Error('Expected seeded production lines from LINE-01 through LINE-14.');
}

async function main(): Promise<void> {
  const initialAdminPassword = resolveInitialAdminPassword();
  const adminPasswordHash = await argon2.hash(initialAdminPassword);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      isActive: true,
      mustChangePassword: true
    },
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      isActive: true,
      mustChangePassword: true
    }
  });

  for (const productionLine of productionLines) {
    await prisma.productionLine.upsert({
      where: { code: productionLine.code },
      update: productionLine,
      create: productionLine
    });
  }

  await prisma.defectReason.upsert({
    where: { code: 'BARCODE_DAMAGED' },
    update: {
      name: '条码污损',
      isActive: true
    },
    create: {
      code: 'BARCODE_DAMAGED',
      name: '条码污损',
      isActive: true
    }
  });

  console.log('Seed data applied.');
}

function resolveInitialAdminPassword(): string {
  const configuredPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (configuredPassword) {
    return configuredPassword;
  }

  if (process.env.ALLOW_DEFAULT_ADMIN_PASSWORD === 'true') {
    return 'admin';
  }

  throw new Error(
    'INITIAL_ADMIN_PASSWORD is required. Set ALLOW_DEFAULT_ADMIN_PASSWORD=true only for local development.'
  );
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
