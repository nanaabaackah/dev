-- CreateEnum
CREATE TYPE "AccountingType" AS ENUM ('REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "AccountingStatus" AS ENUM ('PAID', 'PENDING', 'SCHEDULED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('CAD', 'GHS');

-- CreateTable
CREATE TABLE "AccountingEntry" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "type" "AccountingType" NOT NULL,
    "status" "AccountingStatus" NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "serviceName" TEXT NOT NULL,
    "detail" TEXT,
    "paidAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountingEntry_organizationId_type_idx" ON "AccountingEntry"("organizationId", "type");

-- CreateIndex
CREATE INDEX "AccountingEntry_organizationId_status_idx" ON "AccountingEntry"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AccountingEntry_organizationId_currency_idx" ON "AccountingEntry"("organizationId", "currency");

-- CreateIndex
CREATE INDEX "AccountingEntry_organizationId_paidAt_idx" ON "AccountingEntry"("organizationId", "paidAt");

-- CreateIndex
CREATE INDEX "AccountingEntry_organizationId_dueAt_idx" ON "AccountingEntry"("organizationId", "dueAt");

-- AddForeignKey
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
