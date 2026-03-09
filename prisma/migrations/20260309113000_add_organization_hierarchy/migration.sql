ALTER TABLE "Organization"
ADD COLUMN "parentOrganizationId" INTEGER;

CREATE INDEX "Organization_parentOrganizationId_idx"
ON "Organization"("parentOrganizationId");

ALTER TABLE "Organization"
ADD CONSTRAINT "Organization_parentOrganizationId_fkey"
FOREIGN KEY ("parentOrganizationId") REFERENCES "Organization"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
