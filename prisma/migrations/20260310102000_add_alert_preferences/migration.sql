CREATE TABLE IF NOT EXISTS "AlertPreference" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "notifyOffline" BOOLEAN NOT NULL DEFAULT true,
  "notifyDegraded" BOOLEAN NOT NULL DEFAULT true,
  "emailRecipients" TEXT,
  "smsRecipients" TEXT,
  "fromEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AlertPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AlertPreference_key_key" ON "AlertPreference"("key");
