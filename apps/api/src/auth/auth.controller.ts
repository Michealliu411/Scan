import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ActiveSessionContext, SessionsService } from '../sessions/sessions.service';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

export type AuthenticatedRequest = Request & {
  auth?: ActiveSessionContext;
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
    private readonly config: ConfigService
  ) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<ReturnType<AuthService['login']> extends Promise<infer T> ? Omit<T, 'token'> : never> {
    const { token, ...body } = await this.auth.login(dto);

    response.cookie(this.cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure,
      path: '/'
    });

    return body;
  }

  @Post('logout')
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response
  ): Promise<{ ok: true }> {
    const auth = this.requireAuth(request);
    await this.sessions.revokeSession(auth.id);
    this.clearAuthCookie(response);
    return { ok: true };
  }

  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    const auth = this.requireAuth(request);
    return {
      user: this.auth.toPublicUser(auth.user),
      session: {
        id: auth.id,
        createdAt: auth.createdAt,
        lastSeenAt: auth.lastSeenAt,
        expiresAt: auth.expiresAt
      },
      productionLine: {
        id: auth.productionLine.id,
        code: auth.productionLine.code,
        name: auth.productionLine.name
      }
    };
  }

  @Post('change-password')
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto
  ): Promise<{ ok: true; user: ReturnType<AuthService['toPublicUser']> }> {
    const auth = this.requireAuth(request);
    await this.auth.changePassword(auth.user.id, dto);
    return {
      ok: true,
      user: {
        ...this.auth.toPublicUser(auth.user),
        mustChangePassword: false
      }
    };
  }

  private requireAuth(request: AuthenticatedRequest): ActiveSessionContext {
    if (!request.auth) {
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: '登录状态已失效，请重新登录'
      });
    }

    return request.auth;
  }

  private clearAuthCookie(response: Response): void {
    response.clearCookie(this.cookieName, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure,
      path: '/'
    });
  }

  private get cookieName(): string {
    return this.config.get<string>('COOKIE_NAME', 'scan_session');
  }

  private get cookieSecure(): boolean {
    return this.config.get<string>('COOKIE_SECURE', 'false') === 'true';
  }
}
