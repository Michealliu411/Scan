import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';

@Controller('scanning')
@UseGuards(SessionGuard, RolesGuard)
export class ScanningController {
  @Get('boundary')
  @Roles(Role.INSPECTOR, Role.ADMIN)
  boundary(): { module: 'scanning'; status: 'ready' } {
    return {
      module: 'scanning',
      status: 'ready'
    };
  }
}
