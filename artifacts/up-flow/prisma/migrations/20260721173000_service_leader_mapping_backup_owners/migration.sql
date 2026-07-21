-- Allow each department mapping to keep more than one backup/support owner.
-- The existing backup_leader_id remains during this rollout so older clients
-- can continue to read one representative backup owner.

CREATE TABLE "ServiceLeaderMappingBackupOwner" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "mapping_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceLeaderMappingBackupOwner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceLeaderMappingBackupOwner_mapping_id_user_id_key"
  ON "ServiceLeaderMappingBackupOwner"("mapping_id", "user_id");
CREATE INDEX "ServiceLeaderMappingBackupOwner_user_id_idx"
  ON "ServiceLeaderMappingBackupOwner"("user_id");

ALTER TABLE "ServiceLeaderMappingBackupOwner"
  ADD CONSTRAINT "ServiceLeaderMappingBackupOwner_mapping_id_fkey"
  FOREIGN KEY ("mapping_id") REFERENCES "ServiceLeaderMapping"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceLeaderMappingBackupOwner"
  ADD CONSTRAINT "ServiceLeaderMappingBackupOwner_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve every existing single backup owner as the initial multi-owner row.
INSERT INTO "ServiceLeaderMappingBackupOwner" ("id", "mapping_id", "user_id")
SELECT gen_random_uuid()::text, "id", "backup_leader_id"
FROM "ServiceLeaderMapping"
WHERE "backup_leader_id" IS NOT NULL
ON CONFLICT ("mapping_id", "user_id") DO NOTHING;
