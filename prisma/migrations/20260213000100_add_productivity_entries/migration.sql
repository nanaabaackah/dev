-- CreateTable
CREATE TABLE "ProductivityEntry" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "entryDate" DATE NOT NULL,
    "plannedTasks" INTEGER NOT NULL DEFAULT 0,
    "completedTasks" INTEGER NOT NULL DEFAULT 0,
    "deepWorkMinutes" INTEGER NOT NULL DEFAULT 0,
    "focusBlocks" INTEGER NOT NULL DEFAULT 0,
    "blockers" TEXT,
    "energyLevel" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductivityEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityEntry_userId_entryDate_key" ON "ProductivityEntry"("userId", "entryDate");

-- CreateIndex
CREATE INDEX "ProductivityEntry_organizationId_entryDate_idx" ON "ProductivityEntry"("organizationId", "entryDate");

-- CreateIndex
CREATE INDEX "ProductivityEntry_userId_entryDate_idx" ON "ProductivityEntry"("userId", "entryDate");

-- AddForeignKey
ALTER TABLE "ProductivityEntry" ADD CONSTRAINT "ProductivityEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityEntry" ADD CONSTRAINT "ProductivityEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
