ALTER TABLE "WorkspaceInvite"
ADD COLUMN IF NOT EXISTS "invite_mode" TEXT NOT NULL DEFAULT 'personal_workspace';

CREATE INDEX IF NOT EXISTS "WorkspaceInvite_invite_mode_idx" ON "WorkspaceInvite"("invite_mode");
