import { ExecutionContext, ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '@prisma/client';
import argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { Roles } from '../src/auth/roles.decorator';
import { RolesGuard } from '../src/auth/roles.guard';

const dbPath = `/private/tmp/scan-auth-e2e-${process.pid}.db`;
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.COOKIE_NAME = 'scan_session';
process.env.COOKIE_SECURE = 'false';

function setCookies(header: string | string[] | undefined): string[] {
  if (!header) {
    return [];
  }

  return Array.isArray(header) ? header : [header];
}

class ProtectedController {
  @Roles(Role.ADMIN)
  adminOnly(): void {
    return undefined;
  }
}

describe('Auth session flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let productionLineId: string;

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
    await prisma.user.deleteMany();
    await prisma.productionLine.deleteMany();

    const productionLine = await prisma.productionLine.create({
      data: {
        code: 'LINE-AUTH',
        name: '认证测试产线',
        isActive: true,
        sortOrder: 1
      }
    });
    productionLineId = productionLine.id;

    await prisma.user.createMany({
      data: [
        {
          username: 'admin',
          passwordHash: await argon2.hash('admin'),
          role: Role.ADMIN,
          isActive: true,
          mustChangePassword: true
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
  });

  afterAll(async () => {
    await app.close();
    if (existsSync(dbPath)) {
      rmSync(dbPath);
    }
  });

  it('rejects a wrong password without setting a cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: 'inspector',
        password: 'wrong-password',
        productionLineId
      })
      .expect(401);

    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('sets an httpOnly cookie and returns user plus selected production line on successful login', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: 'inspector',
        password: 'correct-password',
        productionLineId
      })
      .expect(201);

    const cookies = setCookies(response.headers['set-cookie']);
    expect(cookies.join(';')).toContain('scan_session=');
    expect(cookies.join(';')).toContain('HttpOnly');
    expect(cookies.join(';').toLowerCase()).toContain('httponly');
    expect(response.body).toMatchObject({
      user: {
        username: 'inspector',
        role: Role.INSPECTOR,
        mustChangePassword: false
      },
      productionLine: {
        id: productionLineId,
        code: 'LINE-AUTH',
        name: '认证测试产线'
      }
    });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.token).toBeUndefined();
  });

  it('reports seeded admin mustChangePassword on login', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: 'admin',
        password: 'admin',
        productionLineId
      })
      .expect(201);

    expect(response.body.user.mustChangePassword).toBe(true);
  });

  it('changes first-login password and clears mustChangePassword', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({
        username: 'admin',
        password: 'admin',
        productionLineId
      })
      .expect(201);

    const response = await agent
      .post('/auth/change-password')
      .send({ newPassword: 'updated-password' })
      .expect(201);

    expect(response.body.user.mustChangePassword).toBe(false);

    const admin = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } });
    expect(admin.mustChangePassword).toBe(false);
    await expect(argon2.verify(admin.passwordHash, 'updated-password')).resolves.toBe(true);
  });

  it('invalidates the first session when the same user logs in twice', async () => {
    const firstTerminal = request.agent(app.getHttpServer());
    const secondTerminal = request.agent(app.getHttpServer());

    await firstTerminal
      .post('/auth/login')
      .send({
        username: 'inspector',
        password: 'correct-password',
        productionLineId
      })
      .expect(201);

    await secondTerminal
      .post('/auth/login')
      .send({
        username: 'inspector',
        password: 'correct-password',
        productionLineId
      })
      .expect(201);

    const oldSessionResponse = await firstTerminal.get('/auth/me').expect(401);
    expect(oldSessionResponse.body.code).toBe('SESSION_EXPIRED');

    await secondTerminal.get('/auth/me').expect(200);

    const activeSessions = await prisma.session.count({
      where: {
        user: { username: 'inspector' },
        revokedAt: null
      }
    });
    expect(activeSessions).toBe(1);
  });

  it('revokes the current session and clears the auth cookie on logout', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({
        username: 'inspector',
        password: 'correct-password',
        productionLineId
      })
      .expect(201);

    const logoutResponse = await agent.post('/auth/logout').expect(201);
    expect(setCookies(logoutResponse.headers['set-cookie']).join(';')).toContain('scan_session=');

    const expiredResponse = await agent.get('/auth/me').expect(401);
    expect(expiredResponse.body.code).toBe('SESSION_EXPIRED');
  });
});

describe('RolesGuard', () => {
  it('blocks a user lacking the required role', () => {
    const guard = new RolesGuard(new Reflector());
    const handler = ProtectedController.prototype.adminOnly;
    const context = {
      getHandler: () => handler,
      getClass: () => ProtectedController,
      switchToHttp: () => ({
        getRequest: () => ({
          auth: {
            user: {
              role: Role.QUERY
            }
          }
        })
      })
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
