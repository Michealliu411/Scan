import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import { ActiveSessionContext } from '../sessions/sessions.service';
import { CreateInspectionRecordDto } from './dto/create-inspection-record.dto';
import { LookupBarcodeDto } from './dto/lookup-barcode.dto';
import { ScanningService } from './scanning.service';

@Controller('scanning')
@UseGuards(SessionGuard, RolesGuard)
export class ScanningController {
  constructor(private readonly scanning: ScanningService) {}

  @Get('boundary')
  @Roles(Role.INSPECTOR, Role.ADMIN)
  boundary(): { module: 'scanning'; status: 'ready' } {
    return {
      module: 'scanning',
      status: 'ready'
    };
  }

  @Post('lookup')
  @Roles(Role.INSPECTOR, Role.ADMIN)
  lookup(@Body() dto: LookupBarcodeDto) {
    return this.scanning.lookupBarcode(dto.barcode);
  }

  @Get('defect-reasons')
  @Roles(Role.INSPECTOR, Role.ADMIN)
  defectReasons() {
    return this.scanning.listActiveDefectReasons();
  }

  @Get('today-records')
  @Roles(Role.INSPECTOR, Role.ADMIN)
  todayRecords(@CurrentUser() auth: ActiveSessionContext) {
    return this.scanning.listTodayRecords(auth);
  }

  @Post('records')
  @Roles(Role.INSPECTOR, Role.ADMIN)
  createRecord(
    @CurrentUser() auth: ActiveSessionContext,
    @Body() dto: CreateInspectionRecordDto
  ) {
    return this.scanning.createRecord(auth, dto);
  }
}
