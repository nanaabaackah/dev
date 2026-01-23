-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('MANUAL', 'GOOGLE_CALENDAR');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'TENTATIVE', 'CANCELED');

-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE_CALENDAR');

-- CreateTable
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "externalId" TEXT,
    "source" "BookingSource" NOT NULL DEFAULT 'MANUAL',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "attendeeEmail" TEXT,
    "attendeeName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSettings" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "bookingLink" TEXT,
    "calendarEmail" TEXT,
    "defaultLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarIntegration" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "scope" TEXT,
    "email" TEXT,
    "calendarId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "channelId" TEXT,
    "channelToken" TEXT,
    "channelResourceId" TEXT,
    "channelExpiration" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Booking_organizationId_startAt_idx" ON "Booking"("organizationId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_organizationId_externalId_source_key" ON "Booking"("organizationId", "externalId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSettings_organizationId_key" ON "BookingSettings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarIntegration_organizationId_provider_key" ON "CalendarIntegration"("organizationId", "provider");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSettings" ADD CONSTRAINT "BookingSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarIntegration" ADD CONSTRAINT "CalendarIntegration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
