-- Add workspace + membership layer and attach existing resources to a
-- default workspace.

CREATE TYPE "WorkspaceRole" AS ENUM ('owner', 'admin', 'member');

CREATE TABLE "Workspace" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

CREATE TABLE "WorkspaceMember" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL DEFAULT 'member',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkspaceMember_workspace_id_user_id_key"
  ON "WorkspaceMember"("workspace_id", "user_id");
CREATE INDEX "WorkspaceMember_user_id_idx" ON "WorkspaceMember"("user_id");
ALTER TABLE "WorkspaceMember"
  ADD CONSTRAINT "WorkspaceMember_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMember"
  ADD CONSTRAINT "WorkspaceMember_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkspaceInvite" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL DEFAULT 'member',
  "token" TEXT NOT NULL,
  "invited_by" TEXT NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkspaceInvite_token_key" ON "WorkspaceInvite"("token");
CREATE INDEX "WorkspaceInvite_workspace_id_idx" ON "WorkspaceInvite"("workspace_id");
CREATE INDEX "WorkspaceInvite_email_idx" ON "WorkspaceInvite"("email");
ALTER TABLE "WorkspaceInvite"
  ADD CONSTRAINT "WorkspaceInvite_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvite"
  ADD CONSTRAINT "WorkspaceInvite_invited_by_fkey"
    FOREIGN KEY ("invited_by") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Default workspace + memberships backfill.
DO $$
DECLARE
  default_ws_id TEXT;
  bootstrap_user_id TEXT;
BEGIN
  default_ws_id := gen_random_uuid()::TEXT;
  INSERT INTO "Workspace" (id, name, slug)
    VALUES (default_ws_id, 'Acme', 'acme');

  -- Pick an admin user (or any user) as the workspace owner.
  SELECT id INTO bootstrap_user_id FROM "User" WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1;
  IF bootstrap_user_id IS NULL THEN
    SELECT id INTO bootstrap_user_id FROM "User" ORDER BY created_at ASC LIMIT 1;
  END IF;

  -- Add every user as a member; the bootstrap user becomes owner, other
  -- global admins become admin, everyone else member.
  INSERT INTO "WorkspaceMember" (id, workspace_id, user_id, role)
  SELECT
    gen_random_uuid()::TEXT,
    default_ws_id,
    u.id,
    CASE
      WHEN u.id = bootstrap_user_id THEN 'owner'::"WorkspaceRole"
      WHEN u.role = 'admin' THEN 'admin'::"WorkspaceRole"
      ELSE 'member'::"WorkspaceRole"
    END
  FROM "User" u;

  -- Attach existing resources to the default workspace.
  ALTER TABLE "Space"   ADD COLUMN "workspace_id" TEXT;
  ALTER TABLE "Folder"  ADD COLUMN "workspace_id" TEXT;
  ALTER TABLE "Project" ADD COLUMN "workspace_id" TEXT;
  ALTER TABLE "Doc"     ADD COLUMN "workspace_id" TEXT;

  UPDATE "Space"   SET "workspace_id" = default_ws_id WHERE "workspace_id" IS NULL;
  UPDATE "Folder"  SET "workspace_id" = default_ws_id WHERE "workspace_id" IS NULL;
  UPDATE "Project" SET "workspace_id" = default_ws_id WHERE "workspace_id" IS NULL;
  UPDATE "Doc"     SET "workspace_id" = default_ws_id WHERE "workspace_id" IS NULL;
END $$;

ALTER TABLE "Space"   ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "Folder"  ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "Doc"     ALTER COLUMN "workspace_id" SET NOT NULL;

ALTER TABLE "Space"
  ADD CONSTRAINT "Space_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Folder"
  ADD CONSTRAINT "Folder_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project"
  ADD CONSTRAINT "Project_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Doc"
  ADD CONSTRAINT "Doc_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Space_workspace_id_idx"   ON "Space"("workspace_id");
CREATE INDEX "Folder_workspace_id_idx"  ON "Folder"("workspace_id");
CREATE INDEX "Project_workspace_id_idx" ON "Project"("workspace_id");
CREATE INDEX "Doc_workspace_id_idx"     ON "Doc"("workspace_id");
