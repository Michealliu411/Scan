import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import { ActiveSessionContext } from '../sessions/sessions.service';
import { CopyDailyProductionPlansDto } from './dto/copy-daily-production-plans.dto';
import { CreateDailyProductionPlanDto } from './dto/create-daily-production-plan.dto';
import { LookupProductionOrderDto } from './dto/lookup-production-order.dto';
import { UpdateDailyProductionPlanDto } from './dto/update-daily-production-plan.dto';
import { ProductionPlansService } from './production-plans.service';

@Controller('production-plans')
@UseGuards(SessionGuard, RolesGuard)
export class ProductionPlansController {
  constructor(private readonly productionPlans: ProductionPlansService) {}

  @Post('lookup')
  @Roles(Role.QUERY, Role.ADMIN)
  lookup(@Body() dto: LookupProductionOrderDto) {
    return this.productionPlans.lookupProductionOrder(dto.barcode);
  }

  @Get()
  @Roles(Role.QUERY, Role.ADMIN)
  list(
    @Query()
    query: {
      date?: string;
      status?: string;
      productionOrderNo?: string;
    }
  ) {
    return this.productionPlans.listPlans(query);
  }

  @Post()
  @Roles(Role.QUERY, Role.ADMIN)
  create(@CurrentUser() auth: ActiveSessionContext, @Body() dto: CreateDailyProductionPlanDto) {
    return this.productionPlans.createPlan(auth, dto);
  }

  @Patch(':id')
  @Roles(Role.QUERY, Role.ADMIN)
  update(
    @CurrentUser() auth: ActiveSessionContext,
    @Param('id') id: string,
    @Body() dto: UpdateDailyProductionPlanDto
  ) {
    return this.productionPlans.updatePlan(auth, id, dto);
  }

  @Post(':id/close')
  @Roles(Role.QUERY, Role.ADMIN)
  close(@CurrentUser() auth: ActiveSessionContext, @Param('id') id: string) {
    return this.productionPlans.closePlan(auth, id);
  }

  @Post(':id/reopen')
  @Roles(Role.QUERY, Role.ADMIN)
  reopen(@CurrentUser() auth: ActiveSessionContext, @Param('id') id: string) {
    return this.productionPlans.reopenPlan(auth, id);
  }

  @Post('copy')
  @Roles(Role.QUERY, Role.ADMIN)
  copy(@CurrentUser() auth: ActiveSessionContext, @Body() dto: CopyDailyProductionPlansDto) {
    return this.productionPlans.copyPlans(auth, dto);
  }
}
