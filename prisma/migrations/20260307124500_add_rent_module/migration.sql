-- CreateEnum
CREATE TYPE "RentTenantStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "RentTenant" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "status" "RentTenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "tenantName" TEXT NOT NULL,
    "tenantEmail" TEXT NOT NULL,
    "landlordName" TEXT,
    "landlordEmail" TEXT,
    "currency" "CurrencyCode" NOT NULL,
    "monthlyRent" DECIMAL(14,2) NOT NULL,
    "leaseStartDate" DATE NOT NULL,
    "leaseEndDate" DATE,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "lastQuarterlySummaryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentTenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentPayment" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAt" DATE NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentTenant_organizationId_status_idx" ON "RentTenant"("organizationId", "status");

-- CreateIndex
CREATE INDEX "RentTenant_organizationId_tenantEmail_idx" ON "RentTenant"("organizationId", "tenantEmail");

-- CreateIndex
CREATE INDEX "RentPayment_organizationId_tenantId_paidAt_idx" ON "RentPayment"("organizationId", "tenantId", "paidAt");

-- CreateIndex
CREATE INDEX "RentPayment_tenantId_paidAt_idx" ON "RentPayment"("tenantId", "paidAt");

-- AddForeignKey
ALTER TABLE "RentTenant" ADD CONSTRAINT "RentTenant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "RentTenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
