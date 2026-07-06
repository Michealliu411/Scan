-- Allow the same production order to be planned on multiple lines on the same day.
-- Keep one plan per business date, production order, and production line.

DROP INDEX IF EXISTS "DailyProductionPlan_businessDate_productionOrderNo_key";

CREATE UNIQUE INDEX "DailyProductionPlan_businessDate_productionOrderNo_productionLineId_key"
ON "DailyProductionPlan"("businessDate", "productionOrderNo", "productionLineId");
