-- CreateTable
CREATE TABLE IF NOT EXISTS "Space" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "owner_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Space"
  DROP CONSTRAINT IF EXISTS "Space_owner_id_fkey";
ALTER TABLE "Space"
  ADD CONSTRAINT "Space_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "space_id" TEXT;

-- AddForeignKey
ALTER TABLE "Project"
  DROP CONSTRAINT IF EXISTS "Project_space_id_fkey";
ALTER TABLE "Project"
  ADD CONSTRAINT "Project_space_id_fkey"
  FOREIGN KEY ("space_id") REFERENCES "Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;
