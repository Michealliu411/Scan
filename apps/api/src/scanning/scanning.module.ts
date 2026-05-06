import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SessionsModule } from '../sessions/sessions.module';
import { ScanningController } from './scanning.controller';

@Module({
  imports: [AuthModule, SessionsModule],
  controllers: [ScanningController]
})
export class ScanningModule {}
