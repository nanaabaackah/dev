-- CreateEnum
CREATE TYPE "AccountingSource" AS ENUM ('MANUAL', 'FAAKO_SUBSCRIPTION');

-- AlterTable
ALTER TABLE "AccountingEntry" ADD COLUMN     "source" "AccountingSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "sourceRef" TEXT;

-- CreateIndex
CREATE INDEX "AccountingEntry_organizationId_source_idx" ON "AccountingEntry"("organizationId", "source");
