import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';

@Controller('analytics')
@UseGuards(SessionGuard, RolesGuard)
export class AnalyticsController {
  @Get('boundary')
  @Roles(Role.QUERY, Role.ADMIN)
  boundary(): { module: 'analytics'; status: 'ready' } {
    return {
      module: 'analytics',
      status: 'ready'
    };
  }
}
