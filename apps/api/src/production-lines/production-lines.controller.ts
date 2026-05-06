import { Controller, Get } from '@nestjs/common';
import { ProductionLinesService, ProductionLineSummary } from './production-lines.service';

@Controller('production-lines')
export class ProductionLinesController {
  constructor(private readonly productionLinesService: ProductionLinesService) {}

  @Get()
  findActive(): Promise<ProductionLineSummary[]> {
    return this.productionLinesService.findActive();
  }
}
