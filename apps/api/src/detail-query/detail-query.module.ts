import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SessionsModule } from '../sessions/sessions.module';
import { DetailQueryController } from './detail-query.controller';

@Module({
  imports: [AuthModule, SessionsModule],
  controllers: [DetailQueryController]
})
export class DetailQueryModule {}
