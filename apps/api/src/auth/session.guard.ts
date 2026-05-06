import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ActiveSessionContext, SessionsService } from '../sessions/sessions.service';

type CookieRequest = Request & {
  signedCookies?: Record<string, string | undefined>;
  auth?: ActiveSessionContext;
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionsService,
    private readonly config: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CookieRequest>();
    const token = this.readSessionToken(request);

    if (!token) {
      throw this.sessionExpired();
    }

    const auth = await this.sessions.findActiveByToken(token);
    if (!auth || !auth.user.isActive || !auth.productionLine.isActive) {
      throw this.sessionExpired();
    }

    request.auth = auth;
    await this.sessions.touchSession(auth.id);
    return true;
  }

  private readSessionToken(request: CookieRequest): string | undefined {
    const cookieName = this.config.get<string>('COOKIE_NAME', 'scan_session');
    return request.cookies?.[cookieName] ?? request.signedCookies?.[cookieName];
  }

  private sessionExpired(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'SESSION_EXPIRED',
      message: '登录状态已失效，请重新登录'
    });
  }
}
