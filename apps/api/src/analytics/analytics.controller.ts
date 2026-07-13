import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(SessionGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('dashboard')
  @Roles(Role.QUERY, Role.ADMIN)
  dashboard(
    @Query()
    query: {
      year?: string;
      month?: string;
      productionLineId?: string;
    }
  ) {
    return this.analytics.getDashboard(query);
  }

  @Get('quality-daily-report')
  @Roles(Role.QUERY, Role.ADMIN)
  qualityDailyReport(
    @Query()
    query: {
      year?: string;
      month?: string;
      productionLineId?: string;
    }
  ) {
    return this.analytics.getQualityDailyReport(query);
  }
}
