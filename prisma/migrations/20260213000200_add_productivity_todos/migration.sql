-- CreateTable
CREATE TABLE "ProductivityTodo" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductivityTodo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductivityTodo_organizationId_userId_isDone_idx" ON "ProductivityTodo"("organizationId", "userId", "isDone");

-- CreateIndex
CREATE INDEX "ProductivityTodo_userId_dueAt_idx" ON "ProductivityTodo"("userId", "dueAt");

-- AddForeignKey
ALTER TABLE "ProductivityTodo" ADD CONSTRAINT "ProductivityTodo_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductivityTodo" ADD CONSTRAINT "ProductivityTodo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
