-- Publish the final arena identities while keeping discipline in its dedicated column.
DO $$
DECLARE
  expected_count CONSTANT INTEGER := 6;
  addressed_count INTEGER;
  mismatched_count INTEGER;
BEGIN
  LOCK TABLE "competitions" IN SHARE ROW EXCLUSIVE MODE;

  WITH catalog(slug, name) AS (
    VALUES
      ('donatopia-transporter', 'Castra Guardian'),
      ('nightmaze-rescue-transporter', 'Robo Chiper'),
      ('pirate-clash-transporter-shooter', 'Aquaduct Romana'),
      ('wacky-rally-line-follower-mikro', 'Charion Line'),
      ('ring-rumble-sumo', 'Colosseum Clash'),
      ('goal-rush-soccer', 'Harpastum Arena')
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

  WITH catalog(slug, name) AS (
    VALUES
      ('donatopia-transporter', 'Castra Guardian'),
      ('nightmaze-rescue-transporter', 'Robo Chiper'),
      ('pirate-clash-transporter-shooter', 'Aquaduct Romana'),
      ('wacky-rally-line-follower-mikro', 'Charion Line'),
      ('ring-rumble-sumo', 'Colosseum Clash'),
      ('goal-rush-soccer', 'Harpastum Arena')
  )
  UPDATE "competitions" AS competition
  SET "name" = catalog.name,
      "updated_at" = CURRENT_TIMESTAMP
  FROM catalog
  WHERE competition."slug" = catalog.slug
    AND competition."name" IS DISTINCT FROM catalog.name;

  WITH catalog(slug, name) AS (
    VALUES
      ('donatopia-transporter', 'Castra Guardian'),
      ('nightmaze-rescue-transporter', 'Robo Chiper'),
      ('pirate-clash-transporter-shooter', 'Aquaduct Romana'),
      ('wacky-rally-line-follower-mikro', 'Charion Line'),
      ('ring-rumble-sumo', 'Colosseum Clash'),
      ('goal-rush-soccer', 'Harpastum Arena')
  )
  SELECT COUNT(*) INTO mismatched_count
  FROM "competitions" AS competition
  INNER JOIN catalog ON catalog.slug = competition."slug"
  WHERE competition."name" IS DISTINCT FROM catalog.name;

  IF mismatched_count <> 0 THEN
    RAISE EXCEPTION
      'Competition catalog update failed: % target rows do not match',
      mismatched_count;
  END IF;
END $$;
