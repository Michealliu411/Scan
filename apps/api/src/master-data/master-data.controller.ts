import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import { ActiveSessionContext } from '../sessions/sessions.service';
import {
  CreateDefectReasonDto,
  CreateManagedUserDto,
  CreateOperatorProfileDto,
  CreateProductionLineDto,
  CreateSpecialBarcodeDto,
  ImportOperatorProfilesDto,
  ResetManagedUserPasswordDto,
  UpdateDefectReasonDto,
  UpdateManagedUserDto,
  UpdateOperatorProfileDto,
  UpdateProductionLineDto,
  UpdateSpecialBarcodeDto
} from './dto/master-data.dto';
import { MasterDataService } from './master-data.service';

@Controller('master-data')
@UseGuards(SessionGuard, RolesGuard)
@Roles(Role.ADMIN)
export class MasterDataController {
  constructor(private readonly masterData: MasterDataService) {}

  @Get('boundary')
  boundary(): { module: 'master-data'; status: 'ready' } {
    return {
      module: 'master-data',
      status: 'ready'
    };
  }

  @Get('users')
  users() {
    return this.masterData.listUsers();
  }

  @Post('users')
  createUser(@CurrentUser() auth: ActiveSessionContext, @Body() dto: CreateManagedUserDto) {
    return this.masterData.createUser(auth, dto);
  }

  @Patch('users/:id')
  updateUser(@CurrentUser() auth: ActiveSessionContext, @Param('id') id: string, @Body() dto: UpdateManagedUserDto) {
    return this.masterData.updateUser(auth, id, dto);
  }

  @Post('users/:id/reset-password')
  async resetUserPassword(
    @CurrentUser() auth: ActiveSessionContext,
    @Param('id') id: string,
    @Body() dto: ResetManagedUserPasswordDto
  ): Promise<{ ok: true }> {
    await this.masterData.resetUserPassword(auth, id, dto);
    return { ok: true };
  }

  @Delete('users/:id')
  async deleteUser(@CurrentUser() auth: ActiveSessionContext, @Param('id') id: string): Promise<{ ok: true }> {
    await this.masterData.deleteUser(auth, id);
    return { ok: true };
  }

  @Get('defect-reasons')
  defectReasons() {
    return this.masterData.listDefectReasons();
  }

  @Post('defect-reasons')
  createDefectReason(@CurrentUser() auth: ActiveSessionContext, @Body() dto: CreateDefectReasonDto) {
    return this.masterData.createDefectReason(auth, dto);
  }

  @Patch('defect-reasons/:id')
  updateDefectReason(@CurrentUser() auth: ActiveSessionContext, @Param('id') id: string, @Body() dto: UpdateDefectReasonDto) {
    return this.masterData.updateDefectReason(auth, id, dto);
  }

  @Delete('defect-reasons/:id')
  async deleteDefectReason(@CurrentUser() auth: ActiveSessionContext, @Param('id') id: string): Promise<{ ok: true }> {
    await this.masterData.deleteDefectReason(auth, id);
    return { ok: true };
  }

  @Get('operators')
  operators() {
    return this.masterData.listOperatorProfiles();
  }

  @Post('operators')
  createOperator(@CurrentUser() auth: ActiveSessionContext, @Body() dto: CreateOperatorProfileDto) {
    return this.masterData.createOperatorProfile(auth, dto);
  }

  @Post('operators/import')
  importOperators(@CurrentUser() auth: ActiveSessionContext, @Body() dto: ImportOperatorProfilesDto) {
    return this.masterData.importOperatorProfiles(auth, dto);
  }

  @Patch('operators/:id')
  updateOperator(@CurrentUser() auth: ActiveSessionContext, @Param('id') id: string, @Body() dto: UpdateOperatorProfileDto) {
    return this.masterData.updateOperatorProfile(auth, id, dto);
  }

  @Delete('operators/:id')
  async deleteOperator(@CurrentUser() auth: ActiveSessionContext, @Param('id') id: string): Promise<{ ok: true }> {
    await this.masterData.deleteOperatorProfile(auth, id);
    return { ok: true };
  }

  @Get('production-lines')
  productionLines() {
    return this.masterData.listProductionLines();
  }

  @Post('production-lines')
  createProductionLine(@CurrentUser() auth: ActiveSessionContext, @Body() dto: CreateProductionLineDto) {
    return this.masterData.createProductionLine(auth, dto);
  }

  @Patch('production-lines/:id')
  updateProductionLine(@CurrentUser() auth: ActiveSessionContext, @Param('id') id: string, @Body() dto: UpdateProductionLineDto) {
    return this.masterData.updateProductionLine(auth, id, dto);
  }

  @Delete('production-lines/:id')
  async deleteProductionLine(@CurrentUser() auth: ActiveSessionContext, @Param('id') id: string): Promise<{ ok: true }> {
    await this.masterData.deleteProductionLine(auth, id);
    return { ok: true };
  }

  @Post('special-barcodes/generate')
  generateSpecialBarcode() {
    return this.masterData.generateSpecialBarcode();
  }

  @Get('special-barcodes')
  specialBarcodes() {
    return this.masterData.listSpecialBarcodes();
  }

  @Post('special-barcodes')
  createSpecialBarcode(@CurrentUser() auth: ActiveSessionContext, @Body() dto: CreateSpecialBarcodeDto) {
    return this.masterData.createSpecialBarcode(auth, dto);
  }

  @Patch('special-barcodes/:id')
  updateSpecialBarcode(@CurrentUser() auth: ActiveSessionContext, @Param('id') id: string, @Body() dto: UpdateSpecialBarcodeDto) {
    return this.masterData.updateSpecialBarcode(auth, id, dto);
  }

  @Delete('special-barcodes/:id')
  async deleteSpecialBarcode(@CurrentUser() auth: ActiveSessionContext, @Param('id') id: string): Promise<{ ok: true }> {
    await this.masterData.deleteSpecialBarcode(auth, id);
    return { ok: true };
  }
}
