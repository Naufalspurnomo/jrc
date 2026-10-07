-- Correct the published arena display-name typo without changing its stable slug.
WITH catalog(slug, name) AS (
  VALUES ('wacky-rally-line-follower-mikro', 'Chariot Line')
)
UPDATE "competitions" AS competition
SET "name" = catalog.name,
    "updated_at" = CURRENT_TIMESTAMP
FROM catalog
WHERE competition."slug" = catalog.slug
  AND competition."name" = 'Charion Line';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "competitions"
    WHERE "slug" = 'wacky-rally-line-follower-mikro'
      AND "name" IS DISTINCT FROM 'Chariot Line'
  ) THEN
    RAISE EXCEPTION 'Competition display-name correction failed for wacky-rally-line-follower-mikro';
  END IF;
END $$;