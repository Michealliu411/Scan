import { INestApplication, ValidationPipe } from '@nestjs/common';
import { InspectionResult, Role, SpecialBarcodeType } from '@prisma/client';
import argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';

const dbPath = `/private/tmp/scan-scanning-e2e-${process.pid}.db`;
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.COOKIE_NAME = 'scan_session';
process.env.COOKIE_SECURE = 'false';

describe('Scanning API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let productionLineId: string;
  let otherProductionLineId: string;
  let scratchReasonId: string;
  let dirtyReasonId: string;

  beforeAll(async () => {
    if (existsSync(dbPath)) {
      rmSync(dbPath);
    }

    const migrationSql = await readFile(
      join(__dirname, '../prisma/migrations/20260506053000_init/migration.sql'),
      'utf8'
    );
    execFileSync('sqlite3', [dbPath], { input: migrationSql });

    const { Test } = await import('@nestjs/testing');
    const { AppModule } = await import('../src/app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.inspectionRecordDefectReason.deleteMany();
    await prisma.inspectionRecord.deleteMany();
    await prisma.specialBarcode.deleteMany();
    await prisma.defectReason.deleteMany();
    await prisma.user.deleteMany();
    await prisma.productionLine.deleteMany();

    const productionLine = await prisma.productionLine.create({
      data: {
        code: 'LINE-SCAN',
        name: '扫描测试产线',
        isActive: true,
        sortOrder: 1
      }
    });
    productionLineId = productionLine.id;

    const otherProductionLine = await prisma.productionLine.create({
      data: {
        code: 'LINE-OTHER',
        name: '其他测试产线',
        isActive: true,
        sortOrder: 2
      }
    });
    otherProductionLineId = otherProductionLine.id;

    const [scratchReason, dirtyReason] = await Promise.all([
      prisma.defectReason.create({
        data: {
          code: 'SCRATCH',
          name: '划伤',
          isActive: true
        }
      }),
      prisma.defectReason.create({
        data: {
          code: 'BARCODE_DAMAGED',
          name: '条码污损',
          isActive: true
        }
      })
    ]);
    scratchReasonId = scratchReason.id;
    dirtyReasonId = dirtyReason.id;

    await prisma.user.createMany({
      data: [
        {
          username: 'inspector',
          passwordHash: await argon2.hash('correct-password'),
          role: Role.INSPECTOR,
          isActive: true,
          mustChangePassword: false
        },
        {
          username: 'admin',
          passwordHash: await argon2.hash('admin-password'),
          role: Role.ADMIN,
          isActive: true,
          mustChangePassword: false
        },
        {
          username: 'query',
          passwordHash: await argon2.hash('correct-password'),
          role: Role.QUERY,
          isActive: true,
          mustChangePassword: false
        },
        {
          username: 'other-inspector',
          passwordHash: await argon2.hash('correct-password'),
          role: Role.INSPECTOR,
          isActive: true,
          mustChangePassword: false
        }
      ]
    });
  });

  afterAll(async () => {
    await app.close();
    if (existsSync(dbPath)) {
      rmSync(dbPath);
    }
  });

  async function login(
    username: string,
    lineId = productionLineId
  ): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({
        username,
        password: username === 'admin' ? 'admin-password' : 'correct-password',
        productionLineId: lineId
      })
      .expect(201);

    return agent;
  }

  it('lets an inspector lookup a normal barcode and returns part information', async () => {
    const inspector = await login('inspector');

    const response = await inspector
      .post('/scanning/lookup')
      .send({ barcode: 'abc-123456' })
      .expect(201);

    expect(response.body).toMatchObject({
      barcode: 'abc-123456',
      partNumber: 'PN-123456',
      vehicleModel: '车型-ABC1'
    });
  });

  it('returns SCAN_LOOKUP_NOT_FOUND when lookup cannot resolve a barcode', async () => {
    const inspector = await login('inspector');

    const response = await inspector
      .post('/scanning/lookup')
      .send({ barcode: 'part-UNKNOWN-001' })
      .expect(404);

    expect(response.body).toMatchObject({
      code: 'SCAN_LOOKUP_NOT_FOUND',
      message: '未找到零件信息，请修改后重试或重新扫描'
    });
  });

  it('creates one qualified record using the session inspector and production line', async () => {
    const inspector = await login('inspector');

    await inspector
      .post('/scanning/records')
      .send({
        barcode: 'QUAL-000001',
        partNumber: 'PN-000001',
        vehicleModel: '车型-QUAL',
        result: InspectionResult.QUALIFIED
      })
      .expect(201);

    const record = await prisma.inspectionRecord.findUniqueOrThrow({
      where: { qualifiedBarcodeKey: 'QUAL-000001' },
      include: {
        inspector: true,
        productionLine: true
      }
    });

    expect(record.result).toBe(InspectionResult.QUALIFIED);
    expect(record.inspector.username).toBe('inspector');
    expect(record.productionLine.id).toBe(productionLineId);
  });

  it('blocks duplicate qualified submissions with existing record details for BARC-01', async () => {
    const inspector = await login('inspector');

    await inspector
      .post('/scanning/records')
      .send({
        barcode: 'DUP-000001',
        partNumber: 'PN-000001',
        vehicleModel: '车型-DUP',
        result: InspectionResult.QUALIFIED
      })
      .expect(201);

    const response = await inspector
      .post('/scanning/records')
      .send({
        barcode: 'DUP-000001',
        partNumber: 'PN-000001',
        vehicleModel: '车型-DUP',
        result: InspectionResult.QUALIFIED
      })
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'QUALIFIED_BARCODE_DUPLICATE',
      message: '该条码已存在合格记录，不能重复提交',
      existingRecord: {
        barcode: 'DUP-000001',
        productionLine: {
          name: '扫描测试产线'
        },
        inspector: {
          username: 'inspector'
        }
      }
    });
    expect(response.body.existingRecord.scannedAt).toEqual(expect.any(String));
  });

  it('allows two unqualified submissions for the same barcode', async () => {
    const inspector = await login('inspector');

    for (const reasonId of [scratchReasonId, dirtyReasonId]) {
      await inspector
        .post('/scanning/records')
        .send({
          barcode: 'REWORK-000001',
          partNumber: 'PN-000001',
          vehicleModel: '车型-RWK',
          result: InspectionResult.UNQUALIFIED,
          defectReasonIds: [reasonId]
        })
        .expect(201);
    }

    await expect(
      prisma.inspectionRecord.count({ where: { barcode: 'REWORK-000001' } })
    ).resolves.toBe(2);
  });

  it('allows a barcode with prior unqualified records to later be qualified for BARC-03', async () => {
    const inspector = await login('inspector');

    await inspector
      .post('/scanning/records')
      .send({
        barcode: 'PRIOR-000001',
        partNumber: 'PN-000001',
        vehicleModel: '车型-PRIOR',
        result: InspectionResult.UNQUALIFIED,
        defectReasonIds: [scratchReasonId]
      })
      .expect(201);

    await inspector
      .post('/scanning/records')
      .send({
        barcode: 'PRIOR-000001',
        partNumber: 'PN-000001',
        vehicleModel: '车型-PRIOR',
        result: InspectionResult.QUALIFIED
      })
      .expect(201);

    await expect(
      prisma.inspectionRecord.count({ where: { barcode: 'PRIOR-000001' } })
    ).resolves.toBe(2);
    await expect(
      prisma.inspectionRecord.count({
        where: {
          barcode: 'PRIOR-000001',
          result: InspectionResult.QUALIFIED
        }
      })
    ).resolves.toBe(1);
  });

  it('rejects unqualified submission with no defect reasons', async () => {
    const inspector = await login('inspector');

    const response = await inspector
      .post('/scanning/records')
      .send({
        barcode: 'NO-REASON-000001',
        partNumber: 'PN-000001',
        result: InspectionResult.UNQUALIFIED,
        defectReasonIds: []
      })
      .expect(400);

    expect(response.body.code).toBe('DEFECT_REASON_REQUIRED');
  });

  it('returns today-records newest first and scoped to the login production line for SCAN-09', async () => {
    const inspector = await login('inspector');
    const otherInspector = await login('other-inspector', otherProductionLineId);

    await inspector
      .post('/scanning/records')
      .send({
        barcode: 'ORDER-000001',
        partNumber: 'PN-000001',
        vehicleModel: '车型-OLD',
        result: InspectionResult.UNQUALIFIED,
        defectReasonIds: [scratchReasonId]
      })
      .expect(201);

    await otherInspector
      .post('/scanning/records')
      .send({
        barcode: 'OTHER-000001',
        partNumber: 'PN-OTHER',
        result: InspectionResult.QUALIFIED
      })
      .expect(201);

    await inspector
      .post('/scanning/records')
      .send({
        barcode: 'ORDER-000002',
        partNumber: 'PN-000002',
        vehicleModel: '车型-NEW',
        result: InspectionResult.QUALIFIED
      })
      .expect(201);

    const response = await inspector.get('/scanning/today-records').expect(200);

    expect(response.body.map((record: { barcode: string }) => record.barcode)).toEqual([
      'ORDER-000002',
      'ORDER-000001'
    ]);
    expect(response.body[1].defectReasons).toEqual([
      expect.objectContaining({ code: 'SCRATCH', name: '划伤' })
    ]);
  });

  it('blocks query users from scanning endpoints', async () => {
    const query = await login('query');

    const response = await query.post('/scanning/lookup').send({ barcode: 'ABC123' }).expect(403);

    expect(response.body.code).toBe('ROLE_FORBIDDEN');
  });

  it('auto-submits dirty special barcodes as unqualified with 条码污损', async () => {
    const inspector = await login('inspector');
    await prisma.specialBarcode.create({
      data: {
        type: SpecialBarcodeType.DIRTY,
        barcode: '22222222-2222-4222-8222-222222222222',
        defectReasonId: dirtyReasonId,
        isActive: true
      }
    });

    const response = await inspector
      .post('/scanning/lookup')
      .send({ barcode: '22222222-2222-4222-8222-222222222222' })
      .expect(201);

    expect(response.body).toMatchObject({
      kind: 'DIRTY_BARCODE_AUTO_SUBMITTED',
      record: {
        barcode: '22222222-2222-4222-8222-222222222222',
        result: InspectionResult.UNQUALIFIED,
        partNumber: 'DIRTY-BARCODE',
        defectReasons: [
          {
            code: 'BARCODE_DAMAGED',
            name: '条码污损'
          }
        ]
      }
    });

    await expect(
      prisma.inspectionRecord.count({
        where: {
          barcode: '22222222-2222-4222-8222-222222222222',
          result: InspectionResult.UNQUALIFIED
        }
      })
    ).resolves.toBe(1);
  });

  it('resolves no-barcode product configs without calling the simulated lookup', async () => {
    const inspector = await login('inspector');
    await prisma.specialBarcode.create({
      data: {
        type: SpecialBarcodeType.NO_BARCODE_PRODUCT,
        barcode: '33333333-3333-4333-8333-333333333333',
        vehicleModel: '车型-无条码',
        partNumber: 'PN-NO-BARCODE',
        isActive: true
      }
    });

    const response = await inspector
      .post('/scanning/lookup')
      .send({ barcode: '33333333-3333-4333-8333-333333333333' })
      .expect(201);

    expect(response.body).toEqual({
      kind: 'RESOLVED_PART',
      barcode: '33333333-3333-4333-8333-333333333333',
      partNumber: 'PN-NO-BARCODE',
      vehicleModel: '车型-无条码',
      source: 'NO_BARCODE_PRODUCT'
    });
  });
});
