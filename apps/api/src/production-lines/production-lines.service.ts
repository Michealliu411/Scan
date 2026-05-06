import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ProductionLineSummary = {
  id: string;
  code: string;
  name: string;
};

@Injectable()
export class ProductionLinesService {
  constructor(private readonly prisma: PrismaService) {}

  findActive(): Promise<ProductionLineSummary[]> {
    return this.prisma.productionLine.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        code: true,
        name: true
      }
    });
  }
}
