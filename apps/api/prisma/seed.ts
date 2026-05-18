import { PrismaClient, Role } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const defaultProductionLine = {
  code: 'LINE-01',
  name: '产线01',
  isActive: true,
  sortOrder: 1
};

const dirtyBarcodeDefectReason = {
  code: 'BARCODE_DAMAGED',
  name: '条码污损',
  isActive: true
};

const initialDefectReasons = [
  dirtyBarcodeDefectReason,
  { code: 'A0', name: '针距偏大', isActive: true },
  { code: 'A1', name: '针距偏小', isActive: true },
  { code: 'A2', name: '缝距偏大', isActive: true },
  { code: 'A3', name: '缝距偏小', isActive: true },
  { code: 'A4', name: '倒回针不良', isActive: true },
  { code: 'A5', name: '抛线', isActive: true },
  { code: 'A6', name: '跳针', isActive: true },
  { code: 'A7', name: '打皱', isActive: true },
  { code: 'A8', name: '缝线弯曲', isActive: true },
  { code: 'A9', name: '外观污渍', isActive: true },
  { code: 'A10', name: '破损', isActive: true },
  { code: 'A11', name: '针眼', isActive: true },
  { code: 'A12', name: '开线', isActive: true },
  { code: 'A13', name: '断针', isActive: true },
  { code: 'A14', name: '错缝', isActive: true },
  { code: 'A15', name: '漏缝', isActive: true },
  { code: 'A16', name: '刀眼超标', isActive: true },
  { code: 'A17', name: '起始位置超标', isActive: true },
  { code: 'A18', name: '有线头', isActive: true },
  { code: 'A19', name: '叠缝', isActive: true },
  { code: 'A20', name: '合缝', isActive: true },
  { code: 'A21', name: '套结松散', isActive: true },
  { code: 'A22', name: '包边不平整', isActive: true },
  { code: 'A23', name: '包边漏边', isActive: true },
  { code: 'A24', name: '折边距超标', isActive: true },
  { code: 'A25', name: '对称不良', isActive: true },
  { code: 'A26', name: '开、倒缝错误', isActive: true },
  { code: 'A27', name: '接线不良', isActive: true },
  { code: 'A28', name: '裁片参差超标', isActive: true },
  { code: 'A29', name: '线迹外露', isActive: true },
  { code: 'A30', name: '爆针', isActive: true },
  { code: 'A31', name: '剪线剪到裁片', isActive: true },
  { code: 'A32', name: '套结：长度错误', isActive: true },
  { code: 'A33', name: '套结：针数错误', isActive: true },
  { code: 'A34', name: '表面漏针', isActive: true },
  { code: 'A35', name: '正面不平整，打结松线', isActive: true },
  { code: 'A36', name: '方向错误', isActive: true },
  { code: 'A37', name: '色差超标', isActive: true },
  { code: 'A38', name: '面料斑点', isActive: true },
  { code: 'A39', name: '尺寸规格错误', isActive: true },
  { code: 'A40', name: '毛向错误', isActive: true },
  { code: 'A41', name: '绣斜超标', isActive: true }
];

async function main(): Promise<void> {
  const initialAdminPassword = resolveInitialAdminPassword();
  const adminPasswordHash = await argon2.hash(initialAdminPassword);

  await prisma.$transaction(async (tx) => {
    await tx.inspectionRecordDefectReason.deleteMany();
    await tx.inspectionRecord.deleteMany();
    await tx.session.deleteMany();

    const admin = await tx.user.upsert({
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

    await tx.user.deleteMany({
      where: {
        id: { not: admin.id }
      }
    });

    await tx.productionLine.upsert({
      where: { code: defaultProductionLine.code },
      update: defaultProductionLine,
      create: defaultProductionLine
    });

    await tx.productionLine.deleteMany({
      where: {
        code: { not: defaultProductionLine.code }
      }
    });

    let dirtyReasonId = '';

    for (const defectReason of initialDefectReasons) {
      const reason = await tx.defectReason.upsert({
        where: { code: defectReason.code },
        update: {
          name: defectReason.name,
          deductionAmount: 0,
          isActive: defectReason.isActive
        },
        create: {
          ...defectReason,
          deductionAmount: 0
        }
      });

      if (defectReason.code === dirtyBarcodeDefectReason.code) {
        dirtyReasonId = reason.id;
      }
    }

    if (!dirtyReasonId) {
      throw new Error('Expected dirty barcode defect reason to be seeded.');
    }

    await tx.specialBarcode.updateMany({
      where: {
        type: 'DIRTY',
        defectReasonId: { not: dirtyReasonId }
      },
      data: {
        defectReasonId: dirtyReasonId
      }
    });

    await tx.defectReason.deleteMany({
      where: {
        code: { notIn: initialDefectReasons.map((reason) => reason.code) }
      }
    });
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
