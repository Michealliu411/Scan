import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SessionsModule } from '../sessions/sessions.module';
import { SCAN_LOOKUP_GATEWAY } from './scan-lookup.gateway';
import { ScanningController } from './scanning.controller';
import { ScanningService } from './scanning.service';
import { SimulatedScanLookupService } from './simulated-scan-lookup.service';

@Module({
  imports: [AuthModule, SessionsModule],
  controllers: [ScanningController],
  providers: [
    ScanningService,
    SimulatedScanLookupService,
    {
      provide: SCAN_LOOKUP_GATEWAY,
      useExisting: SimulatedScanLookupService
    }
  ]
})
export class ScanningModule {}
