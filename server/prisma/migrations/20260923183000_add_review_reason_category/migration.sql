ALTER TABLE "registrations" ADD COLUMN "review_reason_category" TEXT;

UPDATE "registrations"
SET "review_reason_category" = 'OTHER'
WHERE "review_reason" IS NOT NULL
  AND BTRIM("review_reason") <> '';

ALTER TABLE "registrations"
ADD CONSTRAINT "registrations_review_reason_category_check"
CHECK (
  "review_reason_category" IS NULL OR
  "review_reason_category" IN (
    'DOCUMENT_INCOMPLETE', 'DOCUMENT_INVALID', 'DATA_MISMATCH',
    'ELIGIBILITY', 'PAYMENT_OR_ADMINISTRATIVE', 'OTHER'
  )
);
