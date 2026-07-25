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
    const changeLogMigrationSql = await readFile(
      join(__dirname, '../prisma/migrations/20260511095143_add_inspection_record_change_log/migration.sql'),
      'utf8'
    );
    execFileSync('sqlite3', [dbPath], { input: changeLogMigrationSql });
    const operatorMigrationSql = await readFile(
      join(__dirname, '../prisma/migrations/20260518113000_add_operator_profiles_and_deductions/migration.sql'),
      'utf8'
    );
    execFileSync('sqlite3', [dbPath], { input: operatorMigrationSql });
    const operationLogMigrationSql = await readFile(
      join(__dirname, '../prisma/migrations/20260525090000_add_operation_logs/migration.sql'),
      'utf8'
    );
    execFileSync('sqlite3', [dbPath], { input: operationLogMigrationSql });
    const dailyPlanMigrationSql = await readFile(
      join(__dirname, '../prisma/migrations/20260605093000_add_daily_production_plans/migration.sql'),
      'utf8'
    );
    execFileSync('sqlite3', [dbPath], { input: dailyPlanMigrationSql });
    const qualityReportSnapshotMigrationSql = await readFile(
      join(__dirname, '../prisma/migrations/20260713150000_add_quality_report_snapshots/migration.sql'),
      'utf8'
    );
    execFileSync('sqlite3', [dbPath], { input: qualityReportSnapshotMigrationSql });

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
    await prisma.productionOrderCache.deleteMany();
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
      barcode: 'MAY-UNQUAL-A',
      partNumber: 'PN-A',
      productionLineId: lineOneId,
      result: InspectionResult.UNQUALIFIED,
      scannedAt: new Date('2026-05-10T02:00:00.000Z'),
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
    vehicleModel?: string | null;
    partName?: string | null;
    productionOrderNo?: string | null;
    defectReasonIds?: string[];
  }) {
    const record = await prisma.inspectionRecord.create({
      data: {
        barcode: data.barcode,
        qualifiedBarcodeKey: data.qualifiedBarcodeKey ?? null,
        partNumber: data.partNumber,
        vehicleModel: data.vehicleModel === undefined ? `车型-${data.partNumber}` : data.vehicleModel,
        partName: data.partName ?? null,
        productionOrderNo: data.productionOrderNo ?? null,
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

  it('returns the monthly quality daily report from each barcode global first inspection only', async () => {
    const inactiveReason = await prisma.defectReason.create({
      data: { code: 'A-INACTIVE', name: '历史原因', isActive: false }
    });
    await prisma.productionOrderCache.createMany({
      data: [
        {
          productionOrderNo: 'MO-QUALITY-A',
          partNumber: 'PN-QUALITY-A',
          productName: '质量产品A',
          orderQuantity: 500
        },
        {
          productionOrderNo: 'MO-QUALITY-B',
          partNumber: 'PN-QUALITY-B',
          productName: '质量产品B',
          orderQuantity: 300
        }
      ]
    });
    await seedRecord({
      barcode: 'FIRST-MAY-UNQUALIFIED',
      partNumber: 'PN-QUALITY-A',
      vehicleModel: '车型-质量',
      partName: '部件-质量',
      productionOrderNo: 'MO-QUALITY-A',
      productionLineId: lineOneId,
      result: InspectionResult.UNQUALIFIED,
      scannedAt: new Date('2026-05-10T01:00:00.000Z'),
      defectReasonIds: [defectReasonId]
    });
    await seedRecord({
      barcode: 'FIRST-MAY-UNQUALIFIED',
      qualifiedBarcodeKey: 'FIRST-MAY-UNQUALIFIED',
      partNumber: 'PN-QUALITY-A',
      vehicleModel: '车型-质量',
      partName: '部件-质量',
      productionOrderNo: 'MO-QUALITY-A',
      productionLineId: lineOneId,
      result: InspectionResult.QUALIFIED,
      scannedAt: new Date('2026-06-02T01:00:00.000Z')
    });
    await seedRecord({
      barcode: 'FIRST-MAY-QUALIFIED',
      qualifiedBarcodeKey: 'FIRST-MAY-QUALIFIED',
      partNumber: 'PN-QUALITY-A',
      vehicleModel: '车型-质量',
      partName: '部件-质量',
      productionOrderNo: 'MO-QUALITY-A',
      productionLineId: lineOneId,
      result: InspectionResult.QUALIFIED,
      scannedAt: new Date('2026-05-10T02:00:00.000Z')
    });
    await seedRecord({
      barcode: 'FIRST-MAY-INACTIVE-REASON',
      partNumber: 'PN-QUALITY-B',
      vehicleModel: null,
      partName: null,
      productionOrderNo: 'MO-QUALITY-B',
      productionLineId: lineTwoId,
      result: InspectionResult.UNQUALIFIED,
      scannedAt: new Date('2026-05-11T01:00:00.000Z'),
      defectReasonIds: [inactiveReason.id]
    });

    const query = await login('query');
    const mayResponse = await query.get('/analytics/quality-daily-report?year=2026&month=5').expect(200);

    expect(mayResponse.body).toMatchObject({
      period: { year: 2026, month: 5 },
      workshop: '缝纫',
      process: '缝纫'
    });
    expect(mayResponse.body.defectReasons).toEqual([
      expect.objectContaining({ id: defectReasonId, code: 'SCRATCH', name: '划伤' })
    ]);
    expect(mayResponse.body.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          businessDate: '2026-05-10',
          productionLineId: lineOneId,
          vehicleModel: '车型-质量',
          partName: '部件-质量',
          productionOrderQuantity: 500,
          productionQuantity: 2,
          qualifiedQuantity: 1,
          unqualifiedQuantity: 1,
          qualifiedRate: 0.5,
          defectCounts: { [defectReasonId]: 1 }
        }),
        expect.objectContaining({
          businessDate: '2026-05-11',
          productionLineId: lineTwoId,
          vehicleModel: null,
          partName: null,
          productionOrderQuantity: 300,
          productionQuantity: 1,
          qualifiedQuantity: 0,
          unqualifiedQuantity: 1,
          qualifiedRate: 0,
          defectCounts: { [defectReasonId]: 0 }
        })
      ])
    );

    const juneResponse = await query.get('/analytics/quality-daily-report?year=2026&month=6').expect(200);
    expect(
      juneResponse.body.rows.some(
        (row: { vehicleModel: string | null; partName: string | null }) =>
          row.vehicleModel === '车型-质量' && row.partName === '部件-质量'
      )
    ).toBe(false);

    const lineOneResponse = await query
      .get(`/analytics/quality-daily-report?year=2026&month=5&productionLineId=${lineOneId}`)
      .expect(200);
    expect(lineOneResponse.body.rows).toEqual(
      expect.arrayContaining([expect.objectContaining({ productionLineId: lineOneId })])
    );
    expect(lineOneResponse.body.rows).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ productionLineId: lineTwoId })])
    );

    const inspector = await login('inspector');
    await inspector.get('/analytics/quality-daily-report?year=2026&month=5').expect(403);
  });
});
