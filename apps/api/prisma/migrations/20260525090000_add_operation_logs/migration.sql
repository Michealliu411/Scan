-- CreateTable
CREATE TABLE "OperationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "targetLabel" TEXT NOT NULL,
    "barcode" TEXT,
    "partNumber" TEXT,
    "previousResult" TEXT,
    "newResult" TEXT,
    "defectReasonsJson" TEXT,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "operatorId" TEXT NOT NULL,
    "operatorUsername" TEXT NOT NULL,
    "operatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "OperationLog_operatedAt_idx" ON "OperationLog"("operatedAt");
CREATE INDEX "OperationLog_operatorUsername_idx" ON "OperationLog"("operatorUsername");
CREATE INDEX "OperationLog_barcode_idx" ON "OperationLog"("barcode");
CREATE INDEX "OperationLog_module_idx" ON "OperationLog"("module");
CREATE INDEX "OperationLog_targetType_idx" ON "OperationLog"("targetType");

-- Preserve existing qualified-to-unqualified audit rows in the generic operation log.
INSERT INTO "OperationLog" (
    "id",
    "module",
    "action",
    "targetType",
    "targetId",
    "targetLabel",
    "barcode",
    "partNumber",
    "previousResult",
    "newResult",
    "defectReasonsJson",
    "operatorId",
    "operatorUsername",
    "operatedAt",
    "createdAt"
)
SELECT
    "InspectionRecordChangeLog"."id",
    'inspection',
    'RECLASSIFY_UNQUALIFIED',
    'inspectionRecord',
    "InspectionRecordChangeLog"."inspectionRecordId",
    "InspectionRecordChangeLog"."barcode",
    "InspectionRecordChangeLog"."barcode",
    "InspectionRecordChangeLog"."partNumber",
    "InspectionRecordChangeLog"."previousResult",
    "InspectionRecordChangeLog"."newResult",
    "InspectionRecordChangeLog"."defectReasonsJson",
    "InspectionRecordChangeLog"."operatorId",
    "User"."username",
    "InspectionRecordChangeLog"."operatedAt",
    "InspectionRecordChangeLog"."createdAt"
FROM "InspectionRecordChangeLog"
JOIN "User" ON "User"."id" = "InspectionRecordChangeLog"."operatorId";
