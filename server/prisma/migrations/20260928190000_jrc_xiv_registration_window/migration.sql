ALTER TABLE "competitions"
  ADD COLUMN IF NOT EXISTS "registration_open_at" TIMESTAMP(3);

UPDATE "competitions"
SET
  "registration_open_at" = TIMESTAMP '2026-09-30 01:00:00.000',
  "registration_deadline" = TIMESTAMP '2026-11-21 16:59:59.000',
  "name" = CASE "slug"
    WHEN 'donatopia-transporter' THEN 'Castra — Transporter'
    WHEN 'nightmaze-rescue-transporter' THEN 'Robo Chiper — Rescue Transporter'
    WHEN 'pirate-clash-transporter-shooter' THEN 'Aquaduct — Transporter Shooter'
    WHEN 'wacky-rally-line-follower-mikro' THEN 'Charion Line — Line Follower Mikro'
    WHEN 'ring-rumble-sumo' THEN 'Colosseum — Sumo'
    WHEN 'goal-rush-soccer' THEN 'Harpastum — Soccer'
    ELSE "name"
  END,
  "description" = CASE "slug"
    WHEN 'pirate-clash-transporter-shooter' THEN 'Terdapat dua robot, yaitu Robot Transporter dan Line Follower Transporter. Kedua robot memulai perjalanan dari titik yang sama dan bekerja sama membangun kembali jalur irigasi kota pasca perang dengan saling mengoper objek material pembangunan. Robot Transporter bertugas mengangkut dan menyusun balok untuk membangun jalur irigasi serta membuka palang air. Sementara itu, Line Follower Transporter juga bertugas mengangkut dan menyusun balok secara estafet bersama Robot Transporter hingga jalur irigasi selesai dibangun.'
    ELSE "description"
  END
WHERE "slug" IN (
  'donatopia-transporter', 'nightmaze-rescue-transporter',
  'pirate-clash-transporter-shooter', 'wacky-rally-line-follower-mikro',
  'ring-rumble-sumo', 'goal-rush-soccer'
);

UPDATE "competitions"
SET "registration_open_at" = TIMESTAMP '2026-09-30 01:00:00.000'
WHERE "registration_open_at" IS NULL;

ALTER TABLE "competitions"
  ALTER COLUMN "registration_open_at" SET NOT NULL;
