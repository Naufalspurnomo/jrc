-- JRC stakeholder revision: allow up to five teams per account,
-- including repeated competition/division selections.
BEGIN;

DROP INDEX IF EXISTS "registrations_owner_id_competition_id_key";

DROP TRIGGER IF EXISTS "registrations_owner_max_two_trigger" ON "registrations";
DROP TRIGGER IF EXISTS "registrations_owner_max_five_trigger" ON "registrations";

CREATE OR REPLACE FUNCTION "enforce_registration_account_limit"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."owner_id"::text, 0));

  IF (
    SELECT COUNT(*)
    FROM "registrations"
    WHERE "owner_id" = NEW."owner_id"
      AND "id" <> NEW."id"
  ) >= 5 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'registrations_owner_max_five',
      MESSAGE = 'A participant account may own at most five registrations';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "registrations_owner_max_five_trigger"
BEFORE INSERT OR UPDATE OF "owner_id" ON "registrations"
FOR EACH ROW
EXECUTE FUNCTION "enforce_registration_account_limit"();

COMMIT;
