-- CreateEnum
CREATE TYPE "TeamMemberRole" AS ENUM ('LEADER', 'MEMBER');

-- AlterTable
ALTER TABLE "team_members" ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "role" "TeamMemberRole" NOT NULL DEFAULT 'MEMBER';

-- Backfill one deterministic leader per existing registration.
WITH "ranked_members" AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "registration_id"
            ORDER BY "created_at" ASC, "id" ASC
        ) AS "member_rank"
    FROM "team_members"
)
UPDATE "team_members" AS "member"
SET "role" = 'LEADER'
FROM "ranked_members"
WHERE "member"."id" = "ranked_members"."id"
  AND "ranked_members"."member_rank" = 1;

-- Enforce at most one leader per registration. Prisma cannot model partial indexes.
CREATE UNIQUE INDEX "team_members_one_leader_per_registration_key"
ON "team_members"("registration_id")
WHERE "role" = 'LEADER';

-- CreateIndex
CREATE INDEX "invoices_verified_by_id_idx" ON "invoices"("verified_by_id");

-- CreateIndex
CREATE INDEX "tickets_checked_in_by_id_idx" ON "tickets"("checked_in_by_id");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_checked_in_by_id_fkey" FOREIGN KEY ("checked_in_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
