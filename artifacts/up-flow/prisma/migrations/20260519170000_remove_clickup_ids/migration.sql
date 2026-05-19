DROP INDEX IF EXISTS "Space_clickup_id_key";
DROP INDEX IF EXISTS "Folder_clickup_id_key";
DROP INDEX IF EXISTS "Project_clickup_id_key";
DROP INDEX IF EXISTS "Task_clickup_id_key";

ALTER TABLE "Space" DROP COLUMN IF EXISTS "clickup_id";
ALTER TABLE "Folder" DROP COLUMN IF EXISTS "clickup_id";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "clickup_id";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "clickup_id";
