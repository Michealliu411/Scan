import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ProductionLine, User } from '@prisma/client';
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

    const productionLine = await this.productionLines.findActiveById(dto.productionLineId);
    if (!productionLine) {
      throw new ForbiddenException({
        code: 'PRODUCTION_LINE_INACTIVE',
        message: '产线不可用'
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
