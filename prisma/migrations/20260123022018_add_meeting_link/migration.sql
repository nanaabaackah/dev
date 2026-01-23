-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "calendarEventId" TEXT,
ADD COLUMN     "calendarProvider" "CalendarProvider",
ADD COLUMN     "meetingLink" TEXT;

-- CreateIndex
CREATE INDEX "Booking_organizationId_calendarProvider_calendarEventId_idx" ON "Booking"("organizationId", "calendarProvider", "calendarEventId");
