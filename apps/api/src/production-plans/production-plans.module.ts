import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SCAN_LOOKUP_GATEWAY } from '../scanning/scan-lookup.gateway';
import { ProductionOrderScanLookupService } from '../scanning/production-order-scan-lookup.service';
import { SessionsModule } from '../sessions/sessions.module';
import { ProductionPlansController } from './production-plans.controller';
import { ProductionPlansService } from './production-plans.service';

@Module({
  imports: [AuthModule, ConfigModule, PrismaModule, SessionsModule],
  controllers: [ProductionPlansController],
  providers: [
    ProductionPlansService,
    {
      provide: SCAN_LOOKUP_GATEWAY,
      useClass: ProductionOrderScanLookupService
    }
  ]
})
export class ProductionPlansModule {}
