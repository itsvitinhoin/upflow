-- Keep hidden Spaces as a personal preference. This deliberately does not use
-- Space.sidebar_hidden, which is a workspace-wide visibility setting.
CREATE TABLE "SidebarSpaceHide" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SidebarSpaceHide_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SidebarSpaceHide_workspace_id_user_id_space_id_key"
  ON "SidebarSpaceHide"("workspace_id", "user_id", "space_id");
CREATE INDEX "SidebarSpaceHide_workspace_id_user_id_created_at_idx"
  ON "SidebarSpaceHide"("workspace_id", "user_id", "created_at");
CREATE INDEX "SidebarSpaceHide_space_id_idx" ON "SidebarSpaceHide"("space_id");

ALTER TABLE "SidebarSpaceHide"
  ADD CONSTRAINT "SidebarSpaceHide_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SidebarSpaceHide"
  ADD CONSTRAINT "SidebarSpaceHide_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SidebarSpaceHide"
  ADD CONSTRAINT "SidebarSpaceHide_space_id_fkey"
  FOREIGN KEY ("space_id") REFERENCES "Space"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- The application uses server-side Prisma access. Do not expose personal
-- navigation preferences through Supabase's browser-facing Data API.
ALTER TABLE "SidebarSpaceHide" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "SidebarSpaceHide" FROM anon, authenticated;
