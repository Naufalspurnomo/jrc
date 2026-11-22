ALTER TABLE "team_members"
  ADD COLUMN "attended_at" TIMESTAMP(3),
  ADD COLUMN "attended_by_id" UUID;

ALTER TABLE "tickets"
  ADD COLUMN "kit_handed_over_at" TIMESTAMP(3),
  ADD COLUMN "kit_handed_over_by_id" UUID;

CREATE INDEX "team_members_attended_by_id_idx" ON "team_members"("attended_by_id");
CREATE INDEX "tickets_kit_handed_over_by_id_idx" ON "tickets"("kit_handed_over_by_id");

ALTER TABLE "team_members" ADD CONSTRAINT "team_members_attended_by_id_fkey"
  FOREIGN KEY ("attended_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_kit_handed_over_by_id_fkey"
  FOREIGN KEY ("kit_handed_over_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;