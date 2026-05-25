CREATE TYPE "InviteSendStatus" AS ENUM ('pending', 'sent', 'failed');

ALTER TABLE "WorkspaceInvite"
  ADD COLUMN "tester_invite" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "send_status" "InviteSendStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "send_error" TEXT,
  ADD COLUMN "last_sent_at" TIMESTAMP(3),
  ADD COLUMN "accepted_by" TEXT;

CREATE INDEX "WorkspaceInvite_tester_invite_idx" ON "WorkspaceInvite"("tester_invite");
CREATE INDEX "WorkspaceInvite_send_status_idx" ON "WorkspaceInvite"("send_status");
