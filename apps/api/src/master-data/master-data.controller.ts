import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
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
  createUser(@Body() dto: CreateManagedUserDto) {
    return this.masterData.createUser(dto);
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateManagedUserDto) {
    return this.masterData.updateUser(id, dto);
  }

  @Post('users/:id/reset-password')
  async resetUserPassword(
    @Param('id') id: string,
    @Body() dto: ResetManagedUserPasswordDto
  ): Promise<{ ok: true }> {
    await this.masterData.resetUserPassword(id, dto);
    return { ok: true };
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string): Promise<{ ok: true }> {
    await this.masterData.deleteUser(id);
    return { ok: true };
  }

  @Get('defect-reasons')
  defectReasons() {
    return this.masterData.listDefectReasons();
  }

  @Post('defect-reasons')
  createDefectReason(@Body() dto: CreateDefectReasonDto) {
    return this.masterData.createDefectReason(dto);
  }

  @Patch('defect-reasons/:id')
  updateDefectReason(@Param('id') id: string, @Body() dto: UpdateDefectReasonDto) {
    return this.masterData.updateDefectReason(id, dto);
  }

  @Delete('defect-reasons/:id')
  async deleteDefectReason(@Param('id') id: string): Promise<{ ok: true }> {
    await this.masterData.deleteDefectReason(id);
    return { ok: true };
  }

  @Get('operators')
  operators() {
    return this.masterData.listOperatorProfiles();
  }

  @Post('operators')
  createOperator(@Body() dto: CreateOperatorProfileDto) {
    return this.masterData.createOperatorProfile(dto);
  }

  @Post('operators/import')
  importOperators(@Body() dto: ImportOperatorProfilesDto) {
    return this.masterData.importOperatorProfiles(dto);
  }

  @Patch('operators/:id')
  updateOperator(@Param('id') id: string, @Body() dto: UpdateOperatorProfileDto) {
    return this.masterData.updateOperatorProfile(id, dto);
  }

  @Delete('operators/:id')
  async deleteOperator(@Param('id') id: string): Promise<{ ok: true }> {
    await this.masterData.deleteOperatorProfile(id);
    return { ok: true };
  }

  @Get('production-lines')
  productionLines() {
    return this.masterData.listProductionLines();
  }

  @Post('production-lines')
  createProductionLine(@Body() dto: CreateProductionLineDto) {
    return this.masterData.createProductionLine(dto);
  }

  @Patch('production-lines/:id')
  updateProductionLine(@Param('id') id: string, @Body() dto: UpdateProductionLineDto) {
    return this.masterData.updateProductionLine(id, dto);
  }

  @Delete('production-lines/:id')
  async deleteProductionLine(@Param('id') id: string): Promise<{ ok: true }> {
    await this.masterData.deleteProductionLine(id);
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
  createSpecialBarcode(@Body() dto: CreateSpecialBarcodeDto) {
    return this.masterData.createSpecialBarcode(dto);
  }

  @Patch('special-barcodes/:id')
  updateSpecialBarcode(@Param('id') id: string, @Body() dto: UpdateSpecialBarcodeDto) {
    return this.masterData.updateSpecialBarcode(id, dto);
  }

  @Delete('special-barcodes/:id')
  async deleteSpecialBarcode(@Param('id') id: string): Promise<{ ok: true }> {
    await this.masterData.deleteSpecialBarcode(id);
    return { ok: true };
  }
}
