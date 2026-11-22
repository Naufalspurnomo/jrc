-- Remove previously delivered verification links from persistent outbox storage.
UPDATE "email_outbox"
SET "body" = '[DELIVERED]'
WHERE "status" = 'SENT'
  AND position('token=' in "body") > 0;
