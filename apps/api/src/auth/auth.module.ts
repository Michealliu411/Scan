import { Module } from '@nestjs/common';
import { ProductionLinesModule } from '../production-lines/production-lines.module';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './roles.guard';
import { SessionGuard } from './session.guard';

@Module({
  imports: [UsersModule, SessionsModule, ProductionLinesModule],
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, RolesGuard],
  exports: [AuthService, SessionGuard, RolesGuard]
})
export class AuthModule {}
