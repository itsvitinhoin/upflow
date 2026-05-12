-- CreateTable
CREATE TABLE IF NOT EXISTS "Folder" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "space_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Folder"
  DROP CONSTRAINT IF EXISTS "Folder_space_id_fkey";
ALTER TABLE "Folder"
  ADD CONSTRAINT "Folder_space_id_fkey"
  FOREIGN KEY ("space_id") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Folder"
  DROP CONSTRAINT IF EXISTS "Folder_owner_id_fkey";
ALTER TABLE "Folder"
  ADD CONSTRAINT "Folder_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Project gains optional folder_id (Project = "List" in UI)
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "folder_id" TEXT;

ALTER TABLE "Project"
  DROP CONSTRAINT IF EXISTS "Project_folder_id_fkey";
ALTER TABLE "Project"
  ADD CONSTRAINT "Project_folder_id_fkey"
  FOREIGN KEY ("folder_id") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
