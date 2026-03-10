CREATE TABLE "ReportConfig" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "subjectPrefix" TEXT,
  "heading" TEXT,
  "introText" TEXT,
  "footerText" TEXT,
  "contentOptions" JSONB,
  "scheduleWeekdayUtc" INTEGER,
  "scheduleMonthDayUtc" INTEGER,
  "scheduleHourUtc" INTEGER,
  "scheduleMinuteUtc" INTEGER,
  "scheduleDaysBeforeDue" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReportConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportConfig_key_key"
ON "ReportConfig"("key");
