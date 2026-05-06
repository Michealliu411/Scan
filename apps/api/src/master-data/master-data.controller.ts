import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';

@Controller('master-data')
@UseGuards(SessionGuard, RolesGuard)
export class MasterDataController {
  @Get('boundary')
  @Roles(Role.ADMIN)
  boundary(): { module: 'master-data'; status: 'ready' } {
    return {
      module: 'master-data',
      status: 'ready'
    };
  }
}
