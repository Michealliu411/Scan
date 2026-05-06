import { Injectable } from '@nestjs/common';
import { Prisma, Session } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export type ActiveSessionContext = Prisma.SessionGetPayload<{
  include: {
    user: true;
    productionLine: true;
  };
}>;

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async createLoginSession(
    userId: string,
    productionLineId: string
  ): Promise<{ token: string; session: Session }> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const now = new Date();
    const sessionId = randomUUID();
    const expiresAt = this.createExpiry(now);

    const session = await this.prisma.$transaction(async (tx) => {
      const newSession = await tx.session.create({
        data: {
          id: sessionId,
          tokenHash,
          userId,
          productionLineId,
          createdAt: now,
          lastSeenAt: now,
          expiresAt
        }
      });

      await tx.session.updateMany({
        where: {
          userId,
          id: { not: sessionId },
          revokedAt: null,
          expiresAt: { gt: now }
        },
        data: {
          revokedAt: now,
          replacedBySessionId: sessionId
        }
      });

      return newSession;
    });

    return { token, session };
  }

  findActiveByToken(token: string): Promise<ActiveSessionContext | null> {
    return this.prisma.session.findFirst({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: true,
        productionLine: true
      }
    });
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  async revokeActiveSessionsForUser(userId: string, replacedBySessionId?: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        ...(replacedBySessionId ? { id: { not: replacedBySessionId } } : {})
      },
      data: {
        revokedAt: new Date(),
        ...(replacedBySessionId ? { replacedBySessionId } : {})
      }
    });
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastSeenAt: new Date() }
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private createExpiry(now: Date): Date {
    const ttlHours = Number(this.config.get<string>('SESSION_TTL_HOURS', '12'));
    const safeTtlHours = Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : 12;
    return new Date(now.getTime() + safeTtlHours * 60 * 60 * 1000);
  }
}
