-- Correct the competition mapping while preserving stable competition IDs and legacy slugs.
DO $$
DECLARE
  expected_count CONSTANT INTEGER := 6;
  addressed_count INTEGER;
  mismatched_count INTEGER;
BEGIN
  LOCK TABLE "competitions" IN SHARE ROW EXCLUSIVE MODE;

  WITH catalog(slug, name, level, discipline) AS (
    VALUES
      ('donatopia-transporter', 'Castra — Transporter', 'SD', 'Transporter'),
      ('nightmaze-rescue-transporter', 'Robo Chiper — Rescue Transporter', 'SMP', 'Rescue Transporter'),
      ('pirate-clash-transporter-shooter', 'Aquaduct — Transporter Shooter', 'SMA', 'Transporter Shooter'),
      ('wacky-rally-line-follower-mikro', 'Charion Line — Line Follower Mikro', 'Umum', 'Line Follower Mikro'),
      ('ring-rumble-sumo', 'Colosseum — Sumo', 'Umum', 'Sumo'),
      ('goal-rush-soccer', 'Harpastum — Soccer', 'Umum', 'Soccer')
  )
  SELECT COUNT(*) INTO addressed_count
  FROM "competitions" AS competition
  INNER JOIN catalog ON catalog.slug = competition."slug";

  IF addressed_count = 0 AND NOT EXISTS (SELECT 1 FROM "competitions") THEN
    RETURN;
  END IF;

  IF addressed_count <> expected_count THEN
    RAISE EXCEPTION
      'Competition catalog precondition failed: expected exactly % target rows, found %',
      expected_count,
      addressed_count;
  END IF;

  WITH catalog(slug, name, level, discipline) AS (
    VALUES
      ('donatopia-transporter', 'Castra — Transporter', 'SD', 'Transporter'),
      ('nightmaze-rescue-transporter', 'Robo Chiper — Rescue Transporter', 'SMP', 'Rescue Transporter'),
      ('pirate-clash-transporter-shooter', 'Aquaduct — Transporter Shooter', 'SMA', 'Transporter Shooter'),
      ('wacky-rally-line-follower-mikro', 'Charion Line — Line Follower Mikro', 'Umum', 'Line Follower Mikro'),
      ('ring-rumble-sumo', 'Colosseum — Sumo', 'Umum', 'Sumo'),
      ('goal-rush-soccer', 'Harpastum — Soccer', 'Umum', 'Soccer')
  )
  UPDATE "competitions" AS competition
  SET "name" = catalog.name,
      "level" = catalog.level,
      "discipline" = catalog.discipline,
      "updated_at" = CURRENT_TIMESTAMP
  FROM catalog
  WHERE competition."slug" = catalog.slug
    AND (competition."name", competition."level", competition."discipline")
      IS DISTINCT FROM (catalog.name, catalog.level, catalog.discipline);

  WITH catalog(slug, name, level, discipline) AS (
    VALUES
      ('donatopia-transporter', 'Castra — Transporter', 'SD', 'Transporter'),
      ('nightmaze-rescue-transporter', 'Robo Chiper — Rescue Transporter', 'SMP', 'Rescue Transporter'),
      ('pirate-clash-transporter-shooter', 'Aquaduct — Transporter Shooter', 'SMA', 'Transporter Shooter'),
      ('wacky-rally-line-follower-mikro', 'Charion Line — Line Follower Mikro', 'Umum', 'Line Follower Mikro'),
      ('ring-rumble-sumo', 'Colosseum — Sumo', 'Umum', 'Sumo'),
      ('goal-rush-soccer', 'Harpastum — Soccer', 'Umum', 'Soccer')
  )
  SELECT COUNT(*) INTO mismatched_count
  FROM "competitions" AS competition
  INNER JOIN catalog ON catalog.slug = competition."slug"
  WHERE (competition."name", competition."level", competition."discipline")
    IS DISTINCT FROM (catalog.name, catalog.level, catalog.discipline);

  IF mismatched_count <> 0 THEN
    RAISE EXCEPTION
      'Competition catalog update failed: % target rows do not match',
      mismatched_count;
  END IF;
END $$;
