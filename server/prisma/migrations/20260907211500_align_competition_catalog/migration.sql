ALTER TABLE "competitions"
ADD COLUMN "level" TEXT,
ADD COLUMN "discipline" TEXT;

DO $$
DECLARE
  mapping RECORD;
  old_id UUID;
  target_id UUID;
BEGIN
  FOR mapping IN
    SELECT * FROM (VALUES
      ('transporter-sd', 'donatopia-transporter', 'Donatopia — Transporter', 'SD', 'Transporter'),
      ('rescue-smp', 'nightmaze-rescue-transporter', 'Nightmaze — Rescue Transporter', 'SMP', 'Rescue Transporter'),
      ('shooter-sma', 'pirate-clash-transporter-shooter', 'Pirate Clash — Transporter Shooter', 'SMA', 'Transporter Shooter'),
      ('line-follower', 'wacky-rally-line-follower-mikro', 'Wacky Rally — Line Follower Mikro', 'Umum', 'Line Follower Mikro'),
      ('sumo', 'ring-rumble-sumo', 'Ring Rumble — Sumo', 'Umum', 'Sumo'),
      ('soccer', 'goal-rush-soccer', 'Goal Rush — Soccer', 'Umum', 'Soccer')
    ) AS catalog(old_slug, new_slug, display_name, competition_level, competition_discipline)
  LOOP
    SELECT "id" INTO old_id FROM "competitions" WHERE "slug" = mapping.old_slug;
    SELECT "id" INTO target_id FROM "competitions" WHERE "slug" = mapping.new_slug;

    IF old_id IS NOT NULL AND target_id IS NOT NULL AND old_id <> target_id THEN
      UPDATE "registrations" SET "competition_id" = target_id WHERE "competition_id" = old_id;
      DELETE FROM "competitions" WHERE "id" = old_id;
      old_id := NULL;
    END IF;

    IF target_id IS NULL AND old_id IS NOT NULL THEN
      UPDATE "competitions"
      SET "slug" = mapping.new_slug,
          "name" = mapping.display_name,
          "level" = mapping.competition_level,
          "discipline" = mapping.competition_discipline
      WHERE "id" = old_id;
      target_id := old_id;
    ELSIF target_id IS NOT NULL THEN
      UPDATE "competitions"
      SET "name" = mapping.display_name,
          "level" = mapping.competition_level,
          "discipline" = mapping.competition_discipline
      WHERE "id" = target_id;
    END IF;

    old_id := NULL;
    target_id := NULL;
  END LOOP;
END $$;

UPDATE "competitions"
SET "level" = COALESCE(NULLIF("level", ''), 'Unspecified'),
    "discipline" = COALESCE(NULLIF("discipline", ''), "name");

ALTER TABLE "competitions"
ALTER COLUMN "level" SET NOT NULL,
ALTER COLUMN "discipline" SET NOT NULL;
