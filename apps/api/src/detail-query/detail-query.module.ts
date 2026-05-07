import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SessionsModule } from '../sessions/sessions.module';
import { DetailQueryController } from './detail-query.controller';
import { DetailQueryService } from './detail-query.service';

@Module({
  imports: [AuthModule, SessionsModule],
  controllers: [DetailQueryController],
  providers: [DetailQueryService]
})
export class DetailQueryModule {}
