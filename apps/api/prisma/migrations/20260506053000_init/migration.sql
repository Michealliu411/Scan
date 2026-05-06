-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productionLineId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "replacedBySessionId" TEXT,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Session_productionLineId_fkey" FOREIGN KEY ("productionLineId") REFERENCES "ProductionLine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Session_replacedBySessionId_fkey" FOREIGN KEY ("replacedBySessionId") REFERENCES "Session" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DefectReason" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SpecialBarcode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "vehicleModel" TEXT,
    "partNumber" TEXT,
    "defectReasonId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpecialBarcode_defectReasonId_fkey" FOREIGN KEY ("defectReasonId") REFERENCES "DefectReason" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "barcode" TEXT NOT NULL,
    "qualifiedBarcodeKey" TEXT,
    "partNumber" TEXT NOT NULL,
    "vehicleModel" TEXT,
    "productionLineId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "scannedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InspectionRecord_productionLineId_fkey" FOREIGN KEY ("productionLineId") REFERENCES "ProductionLine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InspectionRecord_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectionRecordDefectReason" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspectionRecordId" TEXT NOT NULL,
    "defectReasonId" TEXT NOT NULL,
    CONSTRAINT "InspectionRecordDefectReason_inspectionRecordId_fkey" FOREIGN KEY ("inspectionRecordId") REFERENCES "InspectionRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InspectionRecordDefectReason_defectReasonId_fkey" FOREIGN KEY ("defectReasonId") REFERENCES "DefectReason" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_productionLineId_idx" ON "Session"("productionLineId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionLine_code_key" ON "ProductionLine"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DefectReason_code_key" ON "DefectReason"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialBarcode_barcode_key" ON "SpecialBarcode"("barcode");

-- CreateIndex
CREATE INDEX "SpecialBarcode_defectReasonId_idx" ON "SpecialBarcode"("defectReasonId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionRecord_qualifiedBarcodeKey_key" ON "InspectionRecord"("qualifiedBarcodeKey");

-- CreateIndex
CREATE INDEX "InspectionRecord_barcode_idx" ON "InspectionRecord"("barcode");

-- CreateIndex
CREATE INDEX "InspectionRecord_productionLineId_scannedAt_idx" ON "InspectionRecord"("productionLineId", "scannedAt");

-- CreateIndex
CREATE INDEX "InspectionRecord_inspectorId_idx" ON "InspectionRecord"("inspectorId");

-- CreateIndex
CREATE INDEX "InspectionRecordDefectReason_defectReasonId_idx" ON "InspectionRecordDefectReason"("defectReasonId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionRecordDefectReason_inspectionRecordId_defectReasonId_key" ON "InspectionRecordDefectReason"("inspectionRecordId", "defectReasonId");
