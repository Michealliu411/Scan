-- Bind each daily production plan to one planned production line.
-- Existing plans are backfilled from their first linked scan record when possible;
-- otherwise they fall back to the first configured production line.

ALTER TABLE "DailyProductionPlan" ADD COLUMN "productionLineId" TEXT;

UPDATE "DailyProductionPlan"
SET "productionLineId" = COALESCE(
  (
    SELECT "InspectionRecord"."productionLineId"
    FROM "InspectionRecord"
    WHERE "InspectionRecord"."dailyProductionPlanId" = "DailyProductionPlan"."id"
    ORDER BY "InspectionRecord"."scannedAt" ASC
    LIMIT 1
  ),
  (
    SELECT "ProductionLine"."id"
    FROM "ProductionLine"
    WHERE "ProductionLine"."isActive" = true
    ORDER BY "ProductionLine"."sortOrder" ASC
    LIMIT 1
  ),
  (
    SELECT "ProductionLine"."id"
    FROM "ProductionLine"
    ORDER BY "ProductionLine"."sortOrder" ASC
    LIMIT 1
  )
);

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_DailyProductionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessDate" TEXT NOT NULL,
    "productionOrderNo" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "orderQuantity" INTEGER NOT NULL,
    "plannedQuantity" INTEGER NOT NULL,
    "productionLineId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "closedAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdByUsername" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedByUsername" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyProductionPlan_productionLineId_fkey" FOREIGN KEY ("productionLineId") REFERENCES "ProductionLine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_DailyProductionPlan" (
    "id",
    "businessDate",
    "productionOrderNo",
    "partNumber",
    "productName",
    "orderQuantity",
    "plannedQuantity",
    "productionLineId",
    "status",
    "closedAt",
    "createdById",
    "createdByUsername",
    "updatedById",
    "updatedByUsername",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "businessDate",
    "productionOrderNo",
    "partNumber",
    "productName",
    "orderQuantity",
    "plannedQuantity",
    "productionLineId",
    "status",
    "closedAt",
    "createdById",
    "createdByUsername",
    "updatedById",
    "updatedByUsername",
    "createdAt",
    "updatedAt"
FROM "DailyProductionPlan"
WHERE "productionLineId" IS NOT NULL;

DROP TABLE "DailyProductionPlan";
ALTER TABLE "new_DailyProductionPlan" RENAME TO "DailyProductionPlan";

CREATE UNIQUE INDEX "DailyProductionPlan_businessDate_productionOrderNo_key" ON "DailyProductionPlan"("businessDate", "productionOrderNo");
CREATE INDEX "DailyProductionPlan_businessDate_idx" ON "DailyProductionPlan"("businessDate");
CREATE INDEX "DailyProductionPlan_productionOrderNo_idx" ON "DailyProductionPlan"("productionOrderNo");
CREATE INDEX "DailyProductionPlan_productionLineId_idx" ON "DailyProductionPlan"("productionLineId");
CREATE INDEX "DailyProductionPlan_status_idx" ON "DailyProductionPlan"("status");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
