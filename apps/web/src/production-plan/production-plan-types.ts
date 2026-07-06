export type DailyProductionPlanStatus = 'ACTIVE' | 'CLOSED';

export type ProductionOrderLookup = {
  barcode: string;
  productionOrderNo: string;
  partNumber: string;
  productName: string;
  orderQuantity: number;
};

export type ProductionLineOption = {
  id: string;
  code: string;
  name: string;
};

export type DailyProductionPlan = {
  id: string;
  businessDate: string;
  productionOrderNo: string;
  partNumber: string;
  productName: string;
  orderQuantity: number;
  plannedQuantity: number;
  productionLine: ProductionLineOption;
  status: DailyProductionPlanStatus;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUsername: string;
  updatedByUsername: string;
  qualifiedCount: number;
  unqualifiedCount: number;
  remainingQuantity: number;
  completionRate: number;
  productionLines: Array<{
    id: string;
    code: string;
    name: string;
  }>;
};

export type ProductionPlanFilters = {
  date?: string;
  status?: DailyProductionPlanStatus | '';
  productionOrderNo?: string;
};

export type CreateDailyProductionPlanInput = {
  businessDate?: string;
  productionOrderNo: string;
  partNumber: string;
  productName: string;
  productionLineId: string;
  orderQuantity: number;
  plannedQuantity: number;
};

export type UpdateDailyProductionPlanInput = {
  plannedQuantity?: number;
  productionLineId?: string;
};

export type CopyDailyProductionPlansInput = {
  sourceDate?: string;
  targetDate?: string;
};

export type CopyDailyProductionPlansResponse = {
  sourceDate: string;
  targetDate: string;
  created: number;
  skipped: number;
  plans: DailyProductionPlan[];
};
