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

const dbPath = `/private/tmp/scan-master-data-e2e-${process.pid}.db`;
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.COOKIE_NAME = 'scan_session';
process.env.COOKIE_SECURE = 'false';

describe('Master data API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let productionLineId: string;
  let adminAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    if (existsSync(dbPath)) {
      rmSync(dbPath);
    }

    const migrationSql = await readFile(
      join(__dirname, '../prisma/migrations/20260506053000_init/migration.sql'),
      'utf8'
    );
    execFileSync('sqlite3', [dbPath], { input: migrationSql });
    const operatorMigrationSql = await readFile(
      join(__dirname, '../prisma/migrations/20260518113000_add_operator_profiles_and_deductions/migration.sql'),
      'utf8'
    );
    execFileSync('sqlite3', [dbPath], { input: operatorMigrationSql });

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
        code: 'LINE-MSTR',
        name: '主数据测试产线',
        isActive: true,
        sortOrder: 1
      }
    });
    productionLineId = productionLine.id;

    await prisma.user.createMany({
      data: [
        {
          username: 'admin',
          passwordHash: await argon2.hash('admin-password'),
          role: Role.ADMIN,
          isActive: true,
          mustChangePassword: false
        },
        {
          username: 'inspector',
          passwordHash: await argon2.hash('correct-password'),
          role: Role.INSPECTOR,
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

    adminAgent = await login('admin', 'admin-password');
  });

  afterAll(async () => {
    await app.close();
    if (existsSync(dbPath)) {
      rmSync(dbPath);
    }
  });

  async function login(
    username: string,
    password = 'correct-password'
  ): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({
        username,
        password,
        productionLineId
      })
      .expect(201);

    return agent;
  }

  it('blocks non-admin users from master data endpoints', async () => {
    const inspector = await login('inspector');

    const response = await inspector.get('/master-data/users').expect(403);

    expect(response.body.code).toBe('ROLE_FORBIDDEN');
  });

  it('creates, updates, resets, disables, and deletes an unreferenced user', async () => {
    const createResponse = await adminAgent
      .post('/master-data/users')
      .send({
        username: 'new-inspector',
        password: 'temporary-password',
        role: Role.INSPECTOR,
        isActive: true
      })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      username: 'new-inspector',
      role: Role.INSPECTOR,
      isActive: true,
      canDelete: true
    });
    expect(createResponse.body.passwordHash).toBeUndefined();

    await adminAgent
      .patch(`/master-data/users/${createResponse.body.id}`)
      .send({
        username: 'renamed-query',
        role: Role.QUERY,
        isActive: false
      })
      .expect(200);

    const resetResponse = await adminAgent
      .post(`/master-data/users/${createResponse.body.id}/reset-password`)
      .send({ password: 'reset-password' })
      .expect(201);

    expect(resetResponse.body).toEqual({ ok: true });

    const resetUser = await prisma.user.findUniqueOrThrow({
      where: { id: createResponse.body.id }
    });
    expect(resetUser.mustChangePassword).toBe(true);
    await expect(argon2.verify(resetUser.passwordHash, 'reset-password')).resolves.toBe(true);

    await adminAgent.delete(`/master-data/users/${createResponse.body.id}`).expect(200);

    await expect(
      prisma.user.findUnique({ where: { id: createResponse.body.id } })
    ).resolves.toBeNull();
  });

  it('blocks administrator password reset through the master-data reset flow', async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } });

    const response = await adminAgent
      .post(`/master-data/users/${admin.id}/reset-password`)
      .send({ password: 'reset-password' })
      .expect(400);

    expect(response.body.code).toBe('ADMIN_PASSWORD_RESET_NOT_ALLOWED');
  });

  it('blocks editing the built-in admin account through master data', async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } });

    const response = await adminAgent
      .patch(`/master-data/users/${admin.id}`)
      .send({ role: Role.QUERY })
      .expect(400);

    expect(response.body.code).toBe('ADMIN_ACCOUNT_EDIT_NOT_ALLOWED');
    await expect(prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).resolves.toMatchObject({
      role: Role.ADMIN
    });
  });

  it('blocks deleting users that are referenced by inspection records', async () => {
    const inspector = await prisma.user.findUniqueOrThrow({ where: { username: 'inspector' } });

    await prisma.inspectionRecord.create({
      data: {
        barcode: 'MSTR-USER-REF',
        qualifiedBarcodeKey: 'MSTR-USER-REF',
        partNumber: 'PN-MSTR',
        productionLineId,
        inspectorId: inspector.id,
        result: InspectionResult.QUALIFIED,
        scannedAt: new Date()
      }
    });

    const response = await adminAgent.delete(`/master-data/users/${inspector.id}`).expect(409);

    expect(response.body.code).toBe('USER_REFERENCED');
  });

  it('manages defect reasons and blocks edits or deletes after use while allowing disable', async () => {
    const createResponse = await adminAgent
      .post('/master-data/defect-reasons')
      .send({ code: 'BURR', name: '毛刺', isActive: true })
      .expect(201);

    await adminAgent
      .patch(`/master-data/defect-reasons/${createResponse.body.id}`)
      .send({ code: 'BURR-1', name: '轻微毛刺', isActive: true })
      .expect(200);

    const inspector = await prisma.user.findUniqueOrThrow({ where: { username: 'inspector' } });
    const record = await prisma.inspectionRecord.create({
      data: {
        barcode: 'MSTR-DEFECT-REF',
        partNumber: 'PN-MSTR',
        productionLineId,
        inspectorId: inspector.id,
        result: InspectionResult.UNQUALIFIED,
        scannedAt: new Date()
      }
    });
    await prisma.inspectionRecordDefectReason.create({
      data: {
        inspectionRecordId: record.id,
        defectReasonId: createResponse.body.id
      }
    });

    const editResponse = await adminAgent
      .patch(`/master-data/defect-reasons/${createResponse.body.id}`)
      .send({ code: 'BURR-2', name: '重度毛刺', isActive: true })
      .expect(409);
    expect(editResponse.body.code).toBe('DEFECT_REASON_REFERENCED');

    await adminAgent
      .patch(`/master-data/defect-reasons/${createResponse.body.id}`)
      .send({ isActive: false })
      .expect(200);

    const deleteResponse = await adminAgent
      .delete(`/master-data/defect-reasons/${createResponse.body.id}`)
      .expect(409);
    expect(deleteResponse.body.code).toBe('DEFECT_REASON_REFERENCED');

    const listResponse = await adminAgent.get('/master-data/defect-reasons').expect(200);
    expect(listResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createResponse.body.id,
          referenced: true,
          canEdit: false,
          canDelete: false
        })
      ])
    );
  });

  it('creates, updates, disables, and deletes unreferenced production lines', async () => {
    const createResponse = await adminAgent
      .post('/master-data/production-lines')
      .send({
        code: 'LINE-NEW',
        name: '新增产线',
        sortOrder: 9,
        isActive: true
      })
      .expect(201);

    await adminAgent
      .patch(`/master-data/production-lines/${createResponse.body.id}`)
      .send({
        code: 'LINE-NEW-2',
        name: '新增产线二',
        sortOrder: 10,
        isActive: false
      })
      .expect(200);

    const listResponse = await adminAgent.get('/master-data/production-lines').expect(200);
    expect(listResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'LINE-MSTR',
          name: '主数据测试产线'
        }),
        expect.objectContaining({
          code: 'LINE-NEW-2',
          isActive: false
        })
      ])
    );

    await adminAgent.delete(`/master-data/production-lines/${createResponse.body.id}`).expect(200);

    await expect(
      prisma.productionLine.findUnique({ where: { id: createResponse.body.id } })
    ).resolves.toBeNull();
  });

  it('blocks deleting production lines referenced by inspection records', async () => {
    const inspector = await prisma.user.findUniqueOrThrow({ where: { username: 'inspector' } });
    await prisma.inspectionRecord.create({
      data: {
        barcode: 'MSTR-LINE-REF',
        qualifiedBarcodeKey: 'MSTR-LINE-REF',
        partNumber: 'PN-MSTR',
        productionLineId,
        inspectorId: inspector.id,
        result: InspectionResult.QUALIFIED,
        scannedAt: new Date()
      }
    });

    const response = await adminAgent.delete(`/master-data/production-lines/${productionLineId}`).expect(409);

    expect(response.body.code).toBe('PRODUCTION_LINE_REFERENCED');
  });

  it('generates and manages special barcodes with reference protection', async () => {
    const damagedReason = await prisma.defectReason.create({
      data: {
        code: 'BARCODE_DAMAGED',
        name: '条码污损',
        isActive: true
      }
    });

    const generatedResponse = await adminAgent
      .post('/master-data/special-barcodes/generate')
      .expect(201);
    expect(generatedResponse.body.barcode).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    const dirtyResponse = await adminAgent
      .post('/master-data/special-barcodes')
      .send({
        type: SpecialBarcodeType.DIRTY,
        barcode: generatedResponse.body.barcode,
        defectReasonId: damagedReason.id,
        isActive: true
      })
      .expect(201);

    expect(dirtyResponse.body).toMatchObject({
      type: SpecialBarcodeType.DIRTY,
      barcode: generatedResponse.body.barcode,
      defectReason: {
        code: 'BARCODE_DAMAGED',
        name: '条码污损'
      },
      referenced: false,
      canDelete: true
    });

    const noBarcodeResponse = await adminAgent
      .post('/master-data/special-barcodes')
      .send({
        type: SpecialBarcodeType.NO_BARCODE_PRODUCT,
        barcode: '11111111-1111-4111-8111-111111111111',
        vehicleModel: '车型-A',
        partNumber: 'PN-NO-BARCODE',
        isActive: true
      })
      .expect(201);

    await adminAgent
      .patch(`/master-data/special-barcodes/${noBarcodeResponse.body.id}`)
      .send({
        vehicleModel: '车型-B',
        partNumber: 'PN-NO-BARCODE-B',
        isActive: false
      })
      .expect(200);

    const inspector = await prisma.user.findUniqueOrThrow({ where: { username: 'inspector' } });
    await prisma.inspectionRecord.create({
      data: {
        barcode: dirtyResponse.body.barcode,
        partNumber: 'PN-DIRTY',
        productionLineId,
        inspectorId: inspector.id,
        result: InspectionResult.UNQUALIFIED,
        scannedAt: new Date()
      }
    });

    const deleteResponse = await adminAgent
      .delete(`/master-data/special-barcodes/${dirtyResponse.body.id}`)
      .expect(409);
    expect(deleteResponse.body.code).toBe('SPECIAL_BARCODE_REFERENCED');

    const listResponse = await adminAgent.get('/master-data/special-barcodes').expect(200);
    expect(listResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: dirtyResponse.body.id,
          referenced: true,
          canEdit: false,
          canDelete: false
        }),
        expect.objectContaining({
          id: noBarcodeResponse.body.id,
          vehicleModel: '车型-B',
          partNumber: 'PN-NO-BARCODE-B',
          isActive: false
        })
      ])
    );
  });
});
