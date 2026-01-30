-- CreateEnum
CREATE TYPE "AccountingInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- AlterTable
ALTER TABLE "AccountingEntry" ADD COLUMN     "recurringInterval" "AccountingInterval";
