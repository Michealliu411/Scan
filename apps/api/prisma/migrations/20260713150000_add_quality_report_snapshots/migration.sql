-- Preserve the old source-product-name value before vehicleModel is repurposed
-- for the upstream 成品车型 field. This migration is additive and keeps all
-- existing inspection records, defect-reason links, operation logs, and plans.

ALTER TABLE "InspectionRecord" ADD COLUMN "productName" TEXT;
ALTER TABLE "InspectionRecord" ADD COLUMN "partName" TEXT;

UPDATE "InspectionRecord"
SET "productName" = "vehicleModel",
    "vehicleModel" = NULL
WHERE "vehicleModel" IS NOT NULL;
