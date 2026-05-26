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

const dbPath = `/private/tmp/scan-detail-query-e2e-${process.pid}.db`;
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.COOKIE_NAME = 'scan_session';
process.env.COOKIE_SECURE = 'false';

describe('Detail query API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let lineOneId: string;
  let lineTwoId: string;
  let inspectorId: string;
  let scratchReasonId: string;
  let dentReasonId: string;

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
    await prisma.operationLog.deleteMany();
    await prisma.inspectionRecordChangeLog.deleteMany();
    await prisma.inspectionRecordDefectReason.deleteMany();
    await prisma.inspectionRecord.deleteMany();
    await prisma.specialBarcode.deleteMany();
    await prisma.defectReason.deleteMany();
    await prisma.user.deleteMany();
    await prisma.productionLine.deleteMany();

    const [lineOne, lineTwo] = await Promise.all([
      prisma.productionLine.create({
        data: { code: 'LINE-Q1', name: '查询一线', isActive: true, sortOrder: 1 }
      }),
      prisma.productionLine.create({
        data: { code: 'LINE-Q2', name: '查询二线', isActive: true, sortOrder: 2 }
      })
    ]);
    lineOneId = lineOne.id;
    lineTwoId = lineTwo.id;

    const [scratchReason, dentReason] = await Promise.all([
      prisma.defectReason.create({
        data: { code: 'SCRATCH', name: '划伤', isActive: true }
      }),
      prisma.defectReason.create({
        data: { code: 'DENT', name: '凹陷', isActive: true }
      })
    ]);
    scratchReasonId = scratchReason.id;
    dentReasonId = dentReason.id;

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
      barcode: 'DETAIL-NEWEST',
      partNumber: 'PN-ALPHA',
      vehicleModel: '车型-A',
      productionLineId: lineOneId,
      result: InspectionResult.UNQUALIFIED,
      scannedAt: new Date('2026-05-20T08:00:00.000Z'),
      defectReasonIds: [scratchReasonId, dentReasonId]
    });
    await seedRecord({
      barcode: 'DETAIL-QUALIFIED',
      qualifiedBarcodeKey: 'DETAIL-QUALIFIED',
      partNumber: 'PN-BETA',
      vehicleModel: null,
      productionLineId: lineTwoId,
      result: InspectionResult.QUALIFIED,
      scannedAt: new Date('2026-05-10T08:00:00.000Z')
    });
    await seedRecord({
      barcode: 'DETAIL-OLD',
      partNumber: 'PN-OLD',
      vehicleModel: '车型-OLD',
      productionLineId: lineOneId,
      result: InspectionResult.UNQUALIFIED,
      scannedAt: new Date('2026-04-01T08:00:00.000Z'),
      defectReasonIds: [scratchReasonId]
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
    vehicleModel: string | null;
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
        vehicleModel: data.vehicleModel,
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

    return record;
  }

  it('returns newest-first detail rows with all audit fields for a Beijing date range', async () => {
    const query = await login('query');

    const response = await query
      .get('/detail-query/records?startDate=2026-05-01&endDate=2026-05-31')
      .expect(200);

    expect(response.body.records.map((record: { barcode: string }) => record.barcode)).toEqual([
      'DETAIL-NEWEST',
      'DETAIL-QUALIFIED'
    ]);
    expect(response.body.records[0]).toMatchObject({
      barcode: 'DETAIL-NEWEST',
      partNumber: 'PN-ALPHA',
      vehicleModel: '车型-A',
      result: InspectionResult.UNQUALIFIED,
      productionLine: {
        id: lineOneId,
        code: 'LINE-Q1',
        name: '查询一线'
      },
      inspector: {
        username: 'inspector'
      },
      defectReasons: expect.arrayContaining([
        { id: scratchReasonId, code: 'SCRATCH', name: '划伤' },
        { id: dentReasonId, code: 'DENT', name: '凹陷' }
      ])
    });
    expect(response.body.records[0].defectReasons).toHaveLength(2);
    expect(response.body.records[0].scannedAt).toEqual('2026-05-20T08:00:00.000Z');
    expect(response.body).toMatchObject({ page: 1, pageSize: 50, total: 2 });
  });

  it('filters detail records by production line, barcode, part number, result, and defect reason', async () => {
    const admin = await login('admin');

    await admin
      .get(
        `/detail-query/records?startDate=2026-05-01&endDate=2026-05-31&productionLineId=${lineOneId}&barcode=NEWEST&partNumber=ALPHA&result=UNQUALIFIED&defectReasonId=${scratchReasonId}`
      )
      .expect(200)
      .expect((response) => {
        expect(response.body.records.map((record: { barcode: string }) => record.barcode)).toEqual([
          'DETAIL-NEWEST'
        ]);
      });

    await admin
      .get(
        `/detail-query/records?startDate=2026-05-01&endDate=2026-05-31&productionLineId=${lineTwoId}&result=QUALIFIED`
      )
      .expect(200)
      .expect((response) => {
        expect(response.body.records.map((record: { barcode: string }) => record.barcode)).toEqual([
          'DETAIL-QUALIFIED'
        ]);
      });
  });

  it('returns active defect reason filter options for query users', async () => {
    const query = await login('query');

    const response = await query.get('/detail-query/defect-reasons').expect(200);

    expect(response.body).toEqual([
      { id: dentReasonId, code: 'DENT', name: '凹陷' },
      { id: scratchReasonId, code: 'SCRATCH', name: '划伤' }
    ]);
  });

  it('lets query users change a qualified record to unqualified and records an operation log', async () => {
    const query = await login('query');
    const qualified = await prisma.inspectionRecord.findUniqueOrThrow({
      where: { qualifiedBarcodeKey: 'DETAIL-QUALIFIED' }
    });

    const response = await query
      .post(`/detail-query/records/${qualified.id}/reclassify-unqualified`)
      .send({ defectReasonIds: [scratchReasonId] })
      .expect(201);

    expect(response.body).toMatchObject({
      id: qualified.id,
      barcode: 'DETAIL-QUALIFIED',
      result: InspectionResult.UNQUALIFIED,
      defectReasons: [{ id: scratchReasonId, code: 'SCRATCH', name: '划伤' }]
    });

    const updated = await prisma.inspectionRecord.findUniqueOrThrow({
      where: { id: qualified.id },
      include: { defectReasonLinks: true }
    });
    expect(updated.result).toBe(InspectionResult.UNQUALIFIED);
    expect(updated.qualifiedBarcodeKey).toBeNull();
    expect(updated.defectReasonLinks.map((link) => link.defectReasonId)).toEqual([scratchReasonId]);

    const logs = await query
      .get('/detail-query/change-logs?startDate=2026-05-01&endDate=2026-05-31&barcode=DETAIL-QUALIFIED&operatorUsername=query')
      .expect(200);

    expect(logs.body.logs).toHaveLength(1);
    expect(logs.body.logs[0]).toMatchObject({
      inspectionRecordId: qualified.id,
      action: 'RECLASSIFY_UNQUALIFIED',
      barcode: 'DETAIL-QUALIFIED',
      partNumber: 'PN-BETA',
      previousResult: InspectionResult.QUALIFIED,
      newResult: InspectionResult.UNQUALIFIED,
      operator: { username: 'query' },
      defectReasons: [{ id: scratchReasonId, code: 'SCRATCH', name: '划伤' }]
    });
    expect(logs.body).toMatchObject({ page: 1, pageSize: 50, total: 1 });
  });

  it('lets query users update defect reasons on an unqualified record and records an operation log', async () => {
    const query = await login('query');
    const unqualified = await prisma.inspectionRecord.findFirstOrThrow({
      where: { barcode: 'DETAIL-NEWEST' }
    });

    const response = await query
      .post(`/detail-query/records/${unqualified.id}/update-unqualified-reasons`)
      .send({ defectReasonIds: [dentReasonId] })
      .expect(201);

    expect(response.body).toMatchObject({
      id: unqualified.id,
      barcode: 'DETAIL-NEWEST',
      result: InspectionResult.UNQUALIFIED,
      defectReasons: [{ id: dentReasonId, code: 'DENT', name: '凹陷' }]
    });

    const updated = await prisma.inspectionRecord.findUniqueOrThrow({
      where: { id: unqualified.id },
      include: { defectReasonLinks: true }
    });
    expect(updated.defectReasonLinks.map((link) => link.defectReasonId)).toEqual([dentReasonId]);

    const logs = await query
      .get('/detail-query/change-logs?startDate=2026-05-01&endDate=2026-05-31&barcode=DETAIL-NEWEST&operatorUsername=query')
      .expect(200);

    expect(logs.body.logs).toHaveLength(1);
    expect(logs.body.logs[0]).toMatchObject({
      inspectionRecordId: unqualified.id,
      action: 'UPDATE_UNQUALIFIED_REASONS',
      barcode: 'DETAIL-NEWEST',
      partNumber: 'PN-ALPHA',
      previousResult: InspectionResult.UNQUALIFIED,
      newResult: InspectionResult.UNQUALIFIED,
      operator: { username: 'query' },
      defectReasons: [{ id: dentReasonId, code: 'DENT', name: '凹陷' }]
    });
  });

  it('requires defect reasons and a currently qualified record for reclassification', async () => {
    const query = await login('query');
    const qualified = await prisma.inspectionRecord.findUniqueOrThrow({
      where: { qualifiedBarcodeKey: 'DETAIL-QUALIFIED' }
    });
    const unqualified = await prisma.inspectionRecord.findFirstOrThrow({
      where: { barcode: 'DETAIL-NEWEST' }
    });

    await query
      .post(`/detail-query/records/${qualified.id}/reclassify-unqualified`)
      .send({ defectReasonIds: [] })
      .expect(400)
      .expect((response) => {
        expect(response.body.code).toBe('DEFECT_REASON_REQUIRED');
      });

    await query
      .post(`/detail-query/records/${unqualified.id}/reclassify-unqualified`)
      .send({ defectReasonIds: [scratchReasonId] })
      .expect(409)
      .expect((response) => {
        expect(response.body.code).toBe('INSPECTION_RECORD_NOT_QUALIFIED');
      });
  });

  it('blocks inspectors from detail query endpoints', async () => {
    const inspector = await login('inspector');

    const response = await inspector
      .get('/detail-query/records?startDate=2026-05-01&endDate=2026-05-31')
      .expect(403);

    expect(response.body.code).toBe('ROLE_FORBIDDEN');

    await inspector
      .get('/detail-query/change-logs?startDate=2026-05-01&endDate=2026-05-31')
      .expect(403);
  });
});
