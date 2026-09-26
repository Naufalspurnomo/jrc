ALTER TYPE "TeamMemberRole" ADD VALUE 'SUPERVISOR';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "registrations"
    GROUP BY "owner_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one registration per account while duplicate owners exist';
  END IF;
END $$;

DROP INDEX IF EXISTS "registrations_owner_id_idx";
CREATE UNIQUE INDEX "registrations_owner_id_key" ON "registrations"("owner_id");
ALTER TABLE "documents" ADD COLUMN "subject_name" TEXT, ADD COLUMN "subject_role" TEXT;