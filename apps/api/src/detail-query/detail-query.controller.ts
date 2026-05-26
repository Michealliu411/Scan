import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import { ActiveSessionContext } from '../sessions/sessions.service';
import { ReclassifyInspectionRecordDto } from './dto/reclassify-inspection-record.dto';
import { DetailQueryService } from './detail-query.service';

@Controller('detail-query')
@UseGuards(SessionGuard, RolesGuard)
export class DetailQueryController {
  constructor(private readonly detailQuery: DetailQueryService) {}

  @Get('defect-reasons')
  @Roles(Role.QUERY, Role.ADMIN)
  defectReasons() {
    return this.detailQuery.listActiveDefectReasons();
  }

  @Get('records')
  @Roles(Role.QUERY, Role.ADMIN)
  records(
    @Query()
    query: {
      startDate?: string;
      endDate?: string;
      productionLineId?: string;
      barcode?: string;
      partNumber?: string;
      result?: string;
      defectReasonId?: string;
      page?: string;
      pageSize?: string;
    }
  ) {
    return this.detailQuery.listRecords(query);
  }

  @Post('records/:id/reclassify-unqualified')
  @Roles(Role.QUERY, Role.ADMIN)
  reclassifyUnqualified(
    @CurrentUser() auth: ActiveSessionContext,
    @Param('id') id: string,
    @Body() dto: ReclassifyInspectionRecordDto
  ) {
    return this.detailQuery.reclassifyQualifiedRecordToUnqualified(auth, id, dto);
  }

  @Post('records/:id/update-unqualified-reasons')
  @Roles(Role.QUERY, Role.ADMIN)
  updateUnqualifiedReasons(
    @CurrentUser() auth: ActiveSessionContext,
    @Param('id') id: string,
    @Body() dto: ReclassifyInspectionRecordDto
  ) {
    return this.detailQuery.updateUnqualifiedRecordReasons(auth, id, dto);
  }

  @Get('change-logs')
  @Roles(Role.QUERY, Role.ADMIN)
  changeLogs(
    @Query()
    query: {
      startDate?: string;
      endDate?: string;
      barcode?: string;
      operatorUsername?: string;
      page?: string;
      pageSize?: string;
    }
  ) {
    return this.detailQuery.listChangeLogs(query);
  }
}
