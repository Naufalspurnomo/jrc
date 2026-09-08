-- Synchronize arena display names while preserving stable competition identities and relationships.
DO $$
DECLARE
  expected_count CONSTANT INTEGER := 6;
  addressed_count INTEGER;
  invalid_name_count INTEGER;
  mismatched_count INTEGER;
BEGIN
  -- Prevent concurrent catalog writes between validation and update.
  LOCK TABLE "competitions" IN SHARE ROW EXCLUSIVE MODE;

  WITH catalog(slug, old_name, new_name) AS (
    VALUES
      ('donatopia-transporter', 'Donatopia — Transporter', 'Aquaduct Romana — Transporter'),
      ('nightmaze-rescue-transporter', 'Nightmaze — Rescue Transporter', 'Castra Guardian — Rescue Transporter'),
      ('pirate-clash-transporter-shooter', 'Pirate Clash — Transporter Shooter', 'Robo-Chiper — Transporter Shooter'),
      ('wacky-rally-line-follower-mikro', 'Wacky Rally — Line Follower Mikro', 'Chariot Line — Line Follower Mikro'),
      ('ring-rumble-sumo', 'Ring Rumble — Sumo', 'Colosseum Clash — Sumo'),
      ('goal-rush-soccer', 'Goal Rush — Soccer', 'Harpastum Arena — Soccer')
  )
  SELECT COUNT(*)
  INTO addressed_count
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

  WITH catalog(slug, old_name, new_name) AS (
    VALUES
      ('donatopia-transporter', 'Donatopia — Transporter', 'Aquaduct Romana — Transporter'),
      ('nightmaze-rescue-transporter', 'Nightmaze — Rescue Transporter', 'Castra Guardian — Rescue Transporter'),
      ('pirate-clash-transporter-shooter', 'Pirate Clash — Transporter Shooter', 'Robo-Chiper — Transporter Shooter'),
      ('wacky-rally-line-follower-mikro', 'Wacky Rally — Line Follower Mikro', 'Chariot Line — Line Follower Mikro'),
      ('ring-rumble-sumo', 'Ring Rumble — Sumo', 'Colosseum Clash — Sumo'),
      ('goal-rush-soccer', 'Goal Rush — Soccer', 'Harpastum Arena — Soccer')
  )
  SELECT COUNT(*)
  INTO invalid_name_count
  FROM "competitions" AS competition
  INNER JOIN catalog ON catalog.slug = competition."slug"
  WHERE competition."name" NOT IN (catalog.old_name, catalog.new_name);

  IF invalid_name_count <> 0 THEN
    RAISE EXCEPTION
      'Competition catalog precondition failed: % target rows have unexpected display names',
      invalid_name_count;
  END IF;

  WITH catalog(slug, new_name) AS (
    VALUES
      ('donatopia-transporter', 'Aquaduct Romana — Transporter'),
      ('nightmaze-rescue-transporter', 'Castra Guardian — Rescue Transporter'),
      ('pirate-clash-transporter-shooter', 'Robo-Chiper — Transporter Shooter'),
      ('wacky-rally-line-follower-mikro', 'Chariot Line — Line Follower Mikro'),
      ('ring-rumble-sumo', 'Colosseum Clash — Sumo'),
      ('goal-rush-soccer', 'Harpastum Arena — Soccer')
  )
  UPDATE "competitions" AS competition
  SET "name" = catalog.new_name,
      "updated_at" = CURRENT_TIMESTAMP
  FROM catalog
  WHERE competition."slug" = catalog.slug
    AND competition."name" IS DISTINCT FROM catalog.new_name;

  WITH catalog(slug, new_name) AS (
    VALUES
      ('donatopia-transporter', 'Aquaduct Romana — Transporter'),
      ('nightmaze-rescue-transporter', 'Castra Guardian — Rescue Transporter'),
      ('pirate-clash-transporter-shooter', 'Robo-Chiper — Transporter Shooter'),
      ('wacky-rally-line-follower-mikro', 'Chariot Line — Line Follower Mikro'),
      ('ring-rumble-sumo', 'Colosseum Clash — Sumo'),
      ('goal-rush-soccer', 'Harpastum Arena — Soccer')
  )
  SELECT COUNT(*)
  INTO mismatched_count
  FROM "competitions" AS competition
  INNER JOIN catalog ON catalog.slug = competition."slug"
  WHERE competition."name" IS DISTINCT FROM catalog.new_name;

  IF mismatched_count <> 0 THEN
    RAISE EXCEPTION
      'Competition catalog update failed: % target rows do not have the expected display name',
      mismatched_count;
  END IF;
END $$;
