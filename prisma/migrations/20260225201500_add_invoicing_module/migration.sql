-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID');

-- CreateTable
CREATE TABLE "Invoice" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" "CurrencyCode" NOT NULL,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE,
    "paidAt" TIMESTAMP(3),
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientAddress" TEXT,
    "notes" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_organizationId_invoiceNumber_key" ON "Invoice"("organizationId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_status_idx" ON "Invoice"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_dueDate_idx" ON "Invoice"("organizationId", "dueDate");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_issueDate_idx" ON "Invoice"("organizationId", "issueDate");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_sortOrder_idx" ON "InvoiceLineItem"("invoiceId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
