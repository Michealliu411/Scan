import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';

@Controller('detail-query')
@UseGuards(SessionGuard, RolesGuard)
export class DetailQueryController {
  @Get('boundary')
  @Roles(Role.QUERY, Role.ADMIN)
  boundary(): { module: 'detail-query'; status: 'ready' } {
    return {
      module: 'detail-query',
      status: 'ready'
    };
  }
}
