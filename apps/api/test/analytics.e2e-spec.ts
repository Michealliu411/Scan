import { INestApplication, ValidationPipe } from '@nestjs/common';
import { InspectionResult, Role } from '@prisma/client';
import argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';

const dbPath = `/private/tmp/scan-analytics-e2e-${process.pid}.db`;
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.COOKIE_NAME = 'scan_session';
process.env.COOKIE_SECURE = 'false';

describe('Analytics API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let lineOneId: string;
  let lineTwoId: string;
  let inspectorId: string;
  let defectReasonId: string;

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

    const [lineOne, lineTwo] = await Promise.all([
      prisma.productionLine.create({
        data: { code: 'LINE-A', name: '一号产线', isActive: true, sortOrder: 1 }
      }),
      prisma.productionLine.create({
        data: { code: 'LINE-B', name: '二号产线', isActive: true, sortOrder: 2 }
      })
    ]);
    lineOneId = lineOne.id;
    lineTwoId = lineTwo.id;

    const defectReason = await prisma.defectReason.create({
      data: { code: 'SCRATCH', name: '划伤', isActive: true }
    });
    defectReasonId = defectReason.id;

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
        }
      ]
    });

    const inspector = await prisma.user.findUniqueOrThrow({ where: { username: 'inspector' } });
    inspectorId = inspector.id;

    await seedRecord({
      barcode: 'MAY-QUAL-A',
      qualifiedBarcodeKey: 'MAY-QUAL-A',
      partNumber: 'PN-A',
      productionLineId: lineOneId,
      result: InspectionResult.QUALIFIED,
      scannedAt: new Date('2026-05-01T01:00:00.000Z')
    });
    await seedRecord({
      barcode: 'MAY-UNQUAL-A',
      partNumber: 'PN-A',
      productionLineId: lineOneId,
      result: InspectionResult.UNQUALIFIED,
      scannedAt: new Date('2026-05-10T01:00:00.000Z'),
      defectReasonIds: [defectReasonId]
    });
    await seedRecord({
      barcode: 'MAY-QUAL-B',
      qualifiedBarcodeKey: 'MAY-QUAL-B',
      partNumber: 'PN-B',
      productionLineId: lineTwoId,
      result: InspectionResult.QUALIFIED,
      scannedAt: new Date('2026-05-20T01:00:00.000Z')
    });
    await seedRecord({
      barcode: 'JUNE-QUAL',
      qualifiedBarcodeKey: 'JUNE-QUAL',
      partNumber: 'PN-JUNE',
      productionLineId: lineOneId,
      result: InspectionResult.QUALIFIED,
      scannedAt: new Date('2026-05-31T16:00:00.000Z')
    });
  });

  afterAll(async () => {
    await app?.close();
    if (existsSync(dbPath)) {
      rmSync(dbPath);
    }
  });

  async function login(
    username: string,
    lineId = lineOneId
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

  async function seedRecord(data: {
    barcode: string;
    qualifiedBarcodeKey?: string;
    partNumber: string;
    productionLineId: string;
    result: InspectionResult;
    scannedAt: Date;
    defectReasonIds?: string[];
  }) {
    const record = await prisma.inspectionRecord.create({
      data: {
        barcode: data.barcode,
        qualifiedBarcodeKey: data.qualifiedBarcodeKey ?? null,
        partNumber: data.partNumber,
        vehicleModel: `车型-${data.partNumber}`,
        productionLineId: data.productionLineId,
        inspectorId,
        result: data.result,
        scannedAt: data.scannedAt
      }
    });

    if (data.defectReasonIds?.length) {
      await prisma.inspectionRecordDefectReason.createMany({
        data: data.defectReasonIds.map((reasonId) => ({
          inspectionRecordId: record.id,
          defectReasonId: reasonId
        }))
      });
    }
  }

  it('returns Beijing-month workshop totals, line totals, and part distributions', async () => {
    const query = await login('query');

    const response = await query.get('/analytics/dashboard?year=2026&month=5').expect(200);

    expect(response.body.period).toMatchObject({
      year: 2026,
      month: 5,
      startUtc: '2026-04-30T16:00:00.000Z',
      endUtc: '2026-05-31T16:00:00.000Z'
    });
    expect(response.body.workshopTotals).toEqual({
      total: 3,
      qualified: 2,
      unqualified: 1
    });
    expect(response.body.productionLineTotals).toEqual([
      expect.objectContaining({
        productionLineId: lineOneId,
        productionLineCode: 'LINE-A',
        productionLineName: '一号产线',
        total: 2,
        qualified: 1,
        unqualified: 1
      }),
      expect.objectContaining({
        productionLineId: lineTwoId,
        productionLineCode: 'LINE-B',
        productionLineName: '二号产线',
        total: 1,
        qualified: 1,
        unqualified: 0
      })
    ]);
    expect(response.body.productDistribution).toEqual([
      { partNumber: 'PN-A', total: 2 },
      { partNumber: 'PN-B', total: 1 }
    ]);
    expect(response.body.unqualifiedPartDistribution).toEqual([
      { partNumber: 'PN-A', unqualified: 1 }
    ]);
  });

  it('filters dashboard totals and distributions by production line', async () => {
    const admin = await login('admin');

    const response = await admin
      .get(`/analytics/dashboard?year=2026&month=5&productionLineId=${lineTwoId}`)
      .expect(200);

    expect(response.body.workshopTotals).toEqual({
      total: 1,
      qualified: 1,
      unqualified: 0
    });
    expect(response.body.productionLineTotals).toEqual([
      expect.objectContaining({
        productionLineId: lineTwoId,
        total: 1,
        qualified: 1,
        unqualified: 0
      })
    ]);
    expect(response.body.productDistribution).toEqual([{ partNumber: 'PN-B', total: 1 }]);
    expect(response.body.unqualifiedPartDistribution).toEqual([]);
  });

  it('blocks inspectors from analytics endpoints', async () => {
    const inspector = await login('inspector');

    const response = await inspector.get('/analytics/dashboard?year=2026&month=5').expect(403);

    expect(response.body.code).toBe('ROLE_FORBIDDEN');
  });
});
