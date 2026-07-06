-- Add production-order daily plan support without rewriting existing inspection data.
ALTER TABLE "InspectionRecord" ADD COLUMN "productionOrderNo" TEXT;
ALTER TABLE "InspectionRecord" ADD COLUMN "dailyProductionPlanId" TEXT;

-- CreateTable
CREATE TABLE "ProductionOrderCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productionOrderNo" TEXT NOT NULL,
    "barcode" TEXT,
    "partNumber" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "orderQuantity" INTEGER NOT NULL,
    "rawJson" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DailyProductionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessDate" TEXT NOT NULL,
    "productionOrderNo" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "orderQuantity" INTEGER NOT NULL,
    "plannedQuantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "closedAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdByUsername" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedByUsername" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "InspectionRecord_productionOrderNo_idx" ON "InspectionRecord"("productionOrderNo");
CREATE INDEX "InspectionRecord_dailyProductionPlanId_idx" ON "InspectionRecord"("dailyProductionPlanId");
CREATE UNIQUE INDEX "ProductionOrderCache_productionOrderNo_key" ON "ProductionOrderCache"("productionOrderNo");
CREATE INDEX "ProductionOrderCache_barcode_idx" ON "ProductionOrderCache"("barcode");
CREATE INDEX "ProductionOrderCache_partNumber_idx" ON "ProductionOrderCache"("partNumber");
CREATE UNIQUE INDEX "DailyProductionPlan_businessDate_productionOrderNo_key" ON "DailyProductionPlan"("businessDate", "productionOrderNo");
CREATE INDEX "DailyProductionPlan_businessDate_idx" ON "DailyProductionPlan"("businessDate");
CREATE INDEX "DailyProductionPlan_productionOrderNo_idx" ON "DailyProductionPlan"("productionOrderNo");
CREATE INDEX "DailyProductionPlan_status_idx" ON "DailyProductionPlan"("status");
