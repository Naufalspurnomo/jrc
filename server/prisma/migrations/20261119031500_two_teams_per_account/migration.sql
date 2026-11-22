-- Allow at most two registrations per participant account while ensuring
-- each registration belongs to a different competition.
BEGIN;
LOCK TABLE "registrations" IN SHARE ROW EXCLUSIVE MODE;
DROP INDEX IF EXISTS "registrations_owner_id_key";

CREATE INDEX IF NOT EXISTS "registrations_owner_id_idx"
  ON "registrations"("owner_id");

CREATE UNIQUE INDEX "registrations_owner_id_competition_id_key"
  ON "registrations"("owner_id", "competition_id");

CREATE OR REPLACE FUNCTION "enforce_registration_account_limit"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Serialize changes for one owner even when requests arrive concurrently.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."owner_id"::text, 0));

  IF (
    SELECT COUNT(*)
    FROM "registrations"
    WHERE "owner_id" = NEW."owner_id"
      AND "id" <> NEW."id"
  ) >= 2 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'registrations_owner_max_two',
      MESSAGE = 'A participant account may own at most two registrations';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "registrations_owner_max_two_trigger" ON "registrations";
CREATE TRIGGER "registrations_owner_max_two_trigger"
BEFORE INSERT OR UPDATE OF "owner_id" ON "registrations"
FOR EACH ROW
EXECUTE FUNCTION "enforce_registration_account_limit"();
COMMIT;
