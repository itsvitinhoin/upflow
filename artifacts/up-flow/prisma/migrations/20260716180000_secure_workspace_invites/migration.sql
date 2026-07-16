-- Store invite secrets only as hashes. Existing links continue to work after
-- this migration because their current token values are backfilled as SHA-256.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "WorkspaceInvite"
  ADD COLUMN "token_hash" TEXT,
  ADD COLUMN "expires_at" TIMESTAMP(3);

UPDATE "WorkspaceInvite"
SET
  "token_hash" = encode(digest("token", 'sha256'), 'hex'),
  "expires_at" = CASE
    WHEN "accepted_at" IS NULL THEN "created_at" + INTERVAL '7 days'
    ELSE "accepted_at"
  END
WHERE "token_hash" IS NULL;

ALTER TABLE "WorkspaceInvite"
  ALTER COLUMN "token_hash" SET NOT NULL,
  ALTER COLUMN "expires_at" SET NOT NULL;

CREATE UNIQUE INDEX "WorkspaceInvite_token_hash_key" ON "WorkspaceInvite"("token_hash");
CREATE INDEX "WorkspaceInvite_workspace_id_accepted_at_expires_at_idx"
  ON "WorkspaceInvite"("workspace_id", "accepted_at", "expires_at");

ALTER TABLE "WorkspaceInvite" DROP COLUMN "token";
