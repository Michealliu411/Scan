import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SessionsModule } from '../sessions/sessions.module';
import { ScanLookupService } from './scan-lookup.service';
import { ScanningController } from './scanning.controller';
import { ScanningService } from './scanning.service';

@Module({
  imports: [AuthModule, SessionsModule],
  controllers: [ScanningController],
  providers: [ScanningService, ScanLookupService]
})
export class ScanningModule {}
