import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [AuthModule, SessionsModule],
  controllers: [AnalyticsController]
})
export class AnalyticsModule {}
