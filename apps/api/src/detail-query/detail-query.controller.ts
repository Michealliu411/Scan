import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
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
    }
  ) {
    return this.detailQuery.listRecords(query);
  }
}
