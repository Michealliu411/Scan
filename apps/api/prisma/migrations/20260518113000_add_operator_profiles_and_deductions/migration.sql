-- Add deduction amounts to defect reasons and inspection records.
ALTER TABLE "DefectReason" ADD COLUMN "deductionAmount" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "InspectionRecord" ADD COLUMN "deductionAmount" DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE "InspectionRecord" ADD COLUMN "operatorProfileId" TEXT;

-- CreateTable
CREATE TABLE "OperatorProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeCode" TEXT,
    "name" TEXT NOT NULL,
    "pinyinInitials" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "OperatorProfile_employeeCode_key" ON "OperatorProfile"("employeeCode");
CREATE INDEX "OperatorProfile_name_idx" ON "OperatorProfile"("name");
CREATE INDEX "OperatorProfile_pinyinInitials_idx" ON "OperatorProfile"("pinyinInitials");
CREATE INDEX "OperatorProfile_employmentType_idx" ON "OperatorProfile"("employmentType");
CREATE INDEX "InspectionRecord_operatorProfileId_idx" ON "InspectionRecord"("operatorProfileId");
