ALTER TABLE "Space" ADD COLUMN "clickup_id" TEXT;
ALTER TABLE "Folder" ADD COLUMN "clickup_id" TEXT;
ALTER TABLE "Project" ADD COLUMN "clickup_id" TEXT;
ALTER TABLE "Task" ADD COLUMN "clickup_id" TEXT;

CREATE UNIQUE INDEX "Space_clickup_id_key" ON "Space"("clickup_id");
CREATE UNIQUE INDEX "Folder_clickup_id_key" ON "Folder"("clickup_id");
CREATE UNIQUE INDEX "Project_clickup_id_key" ON "Project"("clickup_id");
CREATE UNIQUE INDEX "Task_clickup_id_key" ON "Task"("clickup_id");
