import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { DetailQueryModule } from './detail-query/detail-query.module';
import { MasterDataModule } from './master-data/master-data.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductionPlansModule } from './production-plans/production-plans.module';
import { ProductionLinesModule } from './production-lines/production-lines.module';
import { ScanningModule } from './scanning/scanning.module';
import { SessionsModule } from './sessions/sessions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ProductionLinesModule,
    UsersModule,
    SessionsModule,
    AuthModule,
    ScanningModule,
    ProductionPlansModule,
    AnalyticsModule,
    DetailQueryModule,
    MasterDataModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
