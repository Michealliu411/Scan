import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DailyProductionPlanStatus, InspectionResult, Role } from '@prisma/client';
import argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';

const dbPath = `/private/tmp/scan-production-plans-e2e-${process.pid}.db`;
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.COOKIE_NAME = 'scan_session';
process.env.COOKIE_SECURE = 'false';

describe('Production plans API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let productionLineId: string;
  let otherProductionLineId: string;
  let fetchMock: jest.Mock;

  beforeAll(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;

    if (existsSync(dbPath)) {
      rmSync(dbPath);
    }

    for (const migration of [
      '20260506053000_init',
      '20260511095143_add_inspection_record_change_log',
      '20260518113000_add_operator_profiles_and_deductions',
      '20260525090000_add_operation_logs',
      '20260605093000_add_daily_production_plans',
      '20260608131500_add_daily_plan_production_line',
      '20260608134500_allow_daily_plan_multi_line',
      '20260713150000_add_quality_report_snapshots'
    ]) {
      const migrationSql = await readFile(
        join(__dirname, `../prisma/migrations/${migration}/migration.sql`),
        'utf8'
      );
      execFileSync('sqlite3', [dbPath], { input: migrationSql });
    }

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
    fetchMock.mockReset();

    await prisma.session.deleteMany();
    await prisma.operationLog.deleteMany();
    await prisma.inspectionRecordDefectReason.deleteMany();
    await prisma.inspectionRecord.deleteMany();
    await prisma.dailyProductionPlan.deleteMany();
    await prisma.productionOrderCache.deleteMany();
    await prisma.user.deleteMany();
    await prisma.productionLine.deleteMany();

    const line = await prisma.productionLine.create({
      data: {
        code: 'LINE-PLAN',
        name: '计划测试产线',
        isActive: true,
        sortOrder: 1
      }
    });
    productionLineId = line.id;
    const otherLine = await prisma.productionLine.create({
      data: {
        code: 'LINE-PLAN-02',
        name: '计划测试产线02',
        isActive: true,
        sortOrder: 2
      }
    });
    otherProductionLineId = otherLine.id;

    await prisma.user.createMany({
      data: [
        {
          username: 'query',
          passwordHash: await argon2.hash('query-password'),
          role: Role.QUERY,
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
          username: 'inspector',
          passwordHash: await argon2.hash('inspector-password'),
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

  async function login(username: string): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({
        username,
        password: `${username}-password`,
        productionLineId
      })
      .expect(201);

    return agent;
  }

  it('lets query users lookup a production order and caches the returned order data', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ErrCode: 200,
        Message: '查询成功！',
        JsonData: {
          生产订单号: 'PO-LOOKUP-001',
          成品零件编号: 'PN-LOOKUP',
          成品产品名称: '查询产品',
          订单数量: 240
        }
      })
    );
    const query = await login('query');

    const response = await query
      .post('/production-plans/lookup')
      .send({ barcode: 'SHUIXI-LOOKUP-001' })
      .expect(201);

    expect(response.body).toEqual({
      barcode: 'SHUIXI-LOOKUP-001',
      productionOrderNo: 'PO-LOOKUP-001',
      partNumber: 'PN-LOOKUP',
      productName: '查询产品',
      orderQuantity: 240
    });
    await expect(
      prisma.productionOrderCache.count({ where: { productionOrderNo: 'PO-LOOKUP-001' } })
    ).resolves.toBe(1);
  });

  it('blocks inspectors from plan management endpoints', async () => {
    const inspector = await login('inspector');

    const response = await inspector.get('/production-plans').expect(403);

    expect(response.body.code).toBe('ROLE_FORBIDDEN');
  });

  it('allows the same daily order on multiple production lines while rejecting duplicate plans on the same line', async () => {
    const query = await login('query');

    const createResponse = await query
      .post('/production-plans')
      .send({
        businessDate: '2026-06-05',
        productionOrderNo: 'PO-DAILY-001',
        partNumber: 'PN-DAILY',
        productName: '日计划产品',
        orderQuantity: 120,
        plannedQuantity: 130,
        productionLineId: otherProductionLineId
      })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      businessDate: '2026-06-05',
      productionOrderNo: 'PO-DAILY-001',
      plannedQuantity: 130,
      status: DailyProductionPlanStatus.ACTIVE,
      productionLine: {
        id: otherProductionLineId,
        code: 'LINE-PLAN-02',
        name: '计划测试产线02'
      },
      qualifiedCount: 0,
      unqualifiedCount: 0,
      remainingQuantity: 130
    });

    const sameOrderOtherLineResponse = await query
      .post('/production-plans')
      .send({
        businessDate: '2026-06-05',
        productionOrderNo: 'PO-DAILY-001',
        partNumber: 'PN-DAILY',
        productName: '日计划产品',
        orderQuantity: 120,
        plannedQuantity: 20,
        productionLineId
      })
      .expect(201);
    expect(sameOrderOtherLineResponse.body).toMatchObject({
      productionOrderNo: 'PO-DAILY-001',
      plannedQuantity: 20,
      productionLine: {
        id: productionLineId,
        code: 'LINE-PLAN',
        name: '计划测试产线'
      }
    });

    const duplicateSameLineResponse = await query
      .post('/production-plans')
      .send({
        businessDate: '2026-06-05',
        productionOrderNo: 'PO-DAILY-001',
        partNumber: 'PN-DAILY',
        productName: '日计划产品',
        orderQuantity: 120,
        plannedQuantity: 10,
        productionLineId
      })
      .expect(409);
    expect(duplicateSameLineResponse.body.code).toBe('DAILY_PLAN_ALREADY_EXISTS');

    const inspectorUser = await prisma.user.findUniqueOrThrow({ where: { username: 'inspector' } });
    await prisma.inspectionRecord.createMany({
      data: [
        {
          barcode: 'STAT-QUALIFIED-001',
          productionOrderNo: 'PO-DAILY-001',
          dailyProductionPlanId: sameOrderOtherLineResponse.body.id,
          partNumber: 'PN-DAILY',
          vehicleModel: '日计划产品',
          productionLineId,
          inspectorId: inspectorUser.id,
          result: InspectionResult.QUALIFIED,
          scannedAt: new Date()
        },
        {
          barcode: 'STAT-UNQUALIFIED-001',
          productionOrderNo: 'PO-DAILY-001',
          dailyProductionPlanId: sameOrderOtherLineResponse.body.id,
          partNumber: 'PN-DAILY',
          vehicleModel: '日计划产品',
          productionLineId,
          inspectorId: inspectorUser.id,
          result: InspectionResult.UNQUALIFIED,
          scannedAt: new Date()
        }
      ]
    });

    const listResponse = await query
      .get('/production-plans')
      .query({ date: '2026-06-05' })
      .expect(200);

    expect(listResponse.body).toHaveLength(2);
    const currentLinePlan = listResponse.body.find((plan: { id: string }) => plan.id === sameOrderOtherLineResponse.body.id);
    const otherLinePlan = listResponse.body.find((plan: { id: string }) => plan.id === createResponse.body.id);
    expect(currentLinePlan).toMatchObject({
      productionOrderNo: 'PO-DAILY-001',
      qualifiedCount: 1,
      unqualifiedCount: 1,
      remainingQuantity: 19,
      productionLine: {
        id: productionLineId
      },
      productionLines: [
        {
          code: 'LINE-PLAN',
          name: '计划测试产线'
        }
      ]
    });
    expect(otherLinePlan).toMatchObject({
      productionOrderNo: 'PO-DAILY-001',
      qualifiedCount: 0,
      unqualifiedCount: 0,
      remainingQuantity: 130,
      productionLine: {
        id: otherProductionLineId
      },
      productionLines: []
    });
  });

  it('rejects moving a plan to a line that already has the same order on that date', async () => {
    const query = await login('query');
    const firstPlan = await query
      .post('/production-plans')
      .send({
        businessDate: '2026-06-05',
        productionOrderNo: 'PO-MOVE-001',
        partNumber: 'PN-MOVE',
        productName: '转线产品',
        orderQuantity: 100,
        plannedQuantity: 20,
        productionLineId
      })
      .expect(201);

    await query
      .post('/production-plans')
      .send({
        businessDate: '2026-06-05',
        productionOrderNo: 'PO-MOVE-001',
        partNumber: 'PN-MOVE',
        productName: '转线产品',
        orderQuantity: 100,
        plannedQuantity: 15,
        productionLineId: otherProductionLineId
      })
      .expect(201);

    const response = await query
      .patch(`/production-plans/${firstPlan.body.id}`)
      .send({ productionLineId: otherProductionLineId })
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'DAILY_PLAN_ALREADY_EXISTS',
      message: '该生产订单今日在所选产线已存在计划，请直接调整该产线计划'
    });
  });

  it('updates, closes, and audits daily plan changes', async () => {
    const query = await login('query');
    const plan = await query
      .post('/production-plans')
      .send({
        businessDate: '2026-06-05',
        productionOrderNo: 'PO-AUDIT-001',
        partNumber: 'PN-AUDIT',
        productName: '审计产品',
        orderQuantity: 100,
        plannedQuantity: 20,
        productionLineId
      })
      .expect(201);

    const updateResponse = await query
      .patch(`/production-plans/${plan.body.id}`)
      .send({ plannedQuantity: 50, productionLineId: otherProductionLineId })
      .expect(200);
    expect(updateResponse.body).toMatchObject({
      plannedQuantity: 50,
      productionLine: {
        id: otherProductionLineId,
        code: 'LINE-PLAN-02',
        name: '计划测试产线02'
      }
    });

    const updateLog = await prisma.operationLog.findFirstOrThrow({
      where: {
        module: 'productionPlan',
        action: 'UPDATE_DAILY_PLAN',
        targetId: plan.body.id
      },
      orderBy: { operatedAt: 'desc' }
    });
    expect(JSON.parse(updateLog.beforeJson ?? '{}')).toMatchObject({
      productionLineId
    });
    expect(JSON.parse(updateLog.afterJson ?? '{}')).toMatchObject({
      productionLineId: otherProductionLineId
    });

    const closeResponse = await query.post(`/production-plans/${plan.body.id}/close`).send({}).expect(201);
    expect(closeResponse.body).toMatchObject({
      id: plan.body.id,
      status: DailyProductionPlanStatus.CLOSED
    });

    const updateClosedResponse = await query
      .patch(`/production-plans/${plan.body.id}`)
      .send({ plannedQuantity: 60 })
      .expect(409);
    expect(updateClosedResponse.body.code).toBe('DAILY_PLAN_CLOSED');

    await expect(
      prisma.operationLog.count({
        where: {
          module: 'productionPlan',
          targetId: plan.body.id
        }
      })
    ).resolves.toBe(3);
  });

  it('reopens a manually closed daily plan and audits the action', async () => {
    const query = await login('query');
    const plan = await query
      .post('/production-plans')
      .send({
        businessDate: '2026-06-05',
        productionOrderNo: 'PO-REOPEN-001',
        partNumber: 'PN-REOPEN',
        productName: '重开产品',
        orderQuantity: 100,
        plannedQuantity: 20,
        productionLineId
      })
      .expect(201);

    await query.post(`/production-plans/${plan.body.id}/close`).send({}).expect(201);

    const reopenResponse = await query.post(`/production-plans/${plan.body.id}/reopen`).send({}).expect(201);
    expect(reopenResponse.body).toMatchObject({
      id: plan.body.id,
      status: DailyProductionPlanStatus.ACTIVE,
      closedAt: null
    });

    await query.patch(`/production-plans/${plan.body.id}`).send({ plannedQuantity: 60 }).expect(200);

    await expect(
      prisma.operationLog.findFirst({
        where: {
          module: 'productionPlan',
          action: 'REOPEN_DAILY_PLAN',
          targetId: plan.body.id
        }
      })
    ).resolves.toMatchObject({
      targetLabel: 'PO-REOPEN-001'
    });
  });

  it('copies active plans across days and skips only existing target line plans', async () => {
    const admin = await login('admin');

    await admin
      .post('/production-plans')
      .send({
        businessDate: '2026-06-04',
        productionOrderNo: 'PO-COPY-001',
        partNumber: 'PN-COPY',
        productName: '复制产品',
        orderQuantity: 80,
        plannedQuantity: 25,
        productionLineId
      })
      .expect(201);
    await admin
      .post('/production-plans')
      .send({
        businessDate: '2026-06-04',
        productionOrderNo: 'PO-COPY-001',
        partNumber: 'PN-COPY',
        productName: '复制产品',
        orderQuantity: 80,
        plannedQuantity: 10,
        productionLineId: otherProductionLineId
      })
      .expect(201);

    const firstCopy = await admin
      .post('/production-plans/copy')
      .send({ sourceDate: '2026-06-04', targetDate: '2026-06-05' })
      .expect(201);

    expect(firstCopy.body).toMatchObject({
      sourceDate: '2026-06-04',
      targetDate: '2026-06-05',
      created: 2,
      skipped: 0
    });
    expect(firstCopy.body.plans).toHaveLength(2);
    expect(firstCopy.body.plans).toEqual(expect.arrayContaining([
      expect.objectContaining({
      businessDate: '2026-06-05',
      productionOrderNo: 'PO-COPY-001',
      plannedQuantity: 25,
      productionLine: expect.objectContaining({
        id: productionLineId
      })
      }),
      expect.objectContaining({
        businessDate: '2026-06-05',
        productionOrderNo: 'PO-COPY-001',
        plannedQuantity: 10,
        productionLine: expect.objectContaining({
          id: otherProductionLineId
        })
      })
    ]));

    const secondCopy = await admin
      .post('/production-plans/copy')
      .send({ sourceDate: '2026-06-04', targetDate: '2026-06-05' })
      .expect(201);

    expect(secondCopy.body).toMatchObject({
      created: 0,
      skipped: 2
    });
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body
  } as Response;
}
