import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ProductionLine, Role, User } from '@prisma/client';
import { ProductionLinesService } from '../production-lines/production-lines.service';
import { SessionsService } from '../sessions/sessions.service';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

export type PublicUser = Pick<User, 'id' | 'username' | 'role' | 'mustChangePassword'>;
export type PublicProductionLine = Pick<ProductionLine, 'id' | 'code' | 'name'>;

export type LoginResponse = {
  user: PublicUser;
  productionLine: PublicProductionLine;
};

export type LoginServiceResult = LoginResponse & {
  token: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly productionLines: ProductionLinesService
  ) {}

  async login(dto: LoginDto): Promise<LoginServiceResult> {
    const user = await this.users.findByUsername(dto.username);
    if (!user || !(await this.users.verifyPassword(user, dto.password))) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: '用户或密码错误'
      });
    }

    if (!user.isActive) {
      throw new ForbiddenException({
        code: 'USER_INACTIVE',
        message: '用户已停用，请联系管理员'
      });
    }

    const productionLineId = dto.productionLineId?.trim();
    if (!productionLineId && user.role === Role.INSPECTOR) {
      throw new ForbiddenException({
        code: 'PRODUCTION_LINE_REQUIRED',
        message: '检验员登录必须选择产线'
      });
    }

    const productionLine = productionLineId
      ? await this.productionLines.findActiveById(productionLineId)
      : await this.productionLines.findDefaultActive();

    if (!productionLine) {
      throw new ForbiddenException({
        code: 'PRODUCTION_LINE_INACTIVE',
        message: productionLineId ? '产线不可用' : '没有可用产线'
      });
    }

    const { token } = await this.sessions.createLoginSession(user.id, productionLine.id);

    return {
      token,
      user: this.toPublicUser(user),
      productionLine
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user || !(await this.users.verifyPassword(user, dto.currentPassword))) {
      throw new ForbiddenException({
        code: 'CURRENT_PASSWORD_INVALID',
        message: '当前密码错误'
      });
    }

    await this.users.changePassword(userId, dto.newPassword);
  }

  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: user.mustChangePassword
    };
  }
}
