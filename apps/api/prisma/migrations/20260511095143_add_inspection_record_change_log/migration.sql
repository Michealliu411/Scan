-- CreateTable
CREATE TABLE "InspectionRecordChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspectionRecordId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "previousResult" TEXT NOT NULL,
    "newResult" TEXT NOT NULL,
    "defectReasonsJson" TEXT NOT NULL,
    "operatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InspectionRecordChangeLog_inspectionRecordId_fkey" FOREIGN KEY ("inspectionRecordId") REFERENCES "InspectionRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InspectionRecordChangeLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "InspectionRecordChangeLog_inspectionRecordId_idx" ON "InspectionRecordChangeLog"("inspectionRecordId");

-- CreateIndex
CREATE INDEX "InspectionRecordChangeLog_operatorId_idx" ON "InspectionRecordChangeLog"("operatorId");

-- CreateIndex
CREATE INDEX "InspectionRecordChangeLog_operatedAt_idx" ON "InspectionRecordChangeLog"("operatedAt");

-- CreateIndex
CREATE INDEX "InspectionRecordChangeLog_barcode_idx" ON "InspectionRecordChangeLog"("barcode");
