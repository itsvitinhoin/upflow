CREATE TYPE "WorkspaceMemberStatus" AS ENUM ('active', 'inactive');

ALTER TABLE "WorkspaceMember"
  ADD COLUMN "status" "WorkspaceMemberStatus" NOT NULL DEFAULT 'active';

CREATE INDEX "WorkspaceMember_status_idx" ON "WorkspaceMember"("status");
