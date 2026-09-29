-- Align the SMA discipline with the final two-robot restoration concept.
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  LOCK TABLE "competitions" IN SHARE ROW EXCLUSIVE MODE;

  IF NOT EXISTS (SELECT 1 FROM "competitions") THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "competitions"
    WHERE "slug" = 'pirate-clash-transporter-shooter'
      AND "name" = 'Aquaduct Romana'
  ) THEN
    RAISE EXCEPTION 'Aquaduct Romana competition row is missing';
  END IF;

  UPDATE "competitions"
  SET "discipline" = 'Transporter Line Follower',
      "updated_at" = CURRENT_TIMESTAMP
  WHERE "slug" = 'pirate-clash-transporter-shooter'
    AND "name" = 'Aquaduct Romana'
    AND "discipline" IS DISTINCT FROM 'Transporter Line Follower';

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF NOT EXISTS (
    SELECT 1
    FROM "competitions"
    WHERE "slug" = 'pirate-clash-transporter-shooter'
      AND "name" = 'Aquaduct Romana'
      AND "discipline" = 'Transporter Line Follower'
  ) THEN
    RAISE EXCEPTION 'Aquaduct Romana discipline update failed';
  END IF;

  IF updated_count > 1 THEN
    RAISE EXCEPTION 'Aquaduct Romana discipline update touched % rows', updated_count;
  END IF;
END $$;