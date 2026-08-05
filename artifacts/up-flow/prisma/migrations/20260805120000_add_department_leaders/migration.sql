ALTER TABLE "Department"
ADD COLUMN "leader_id" TEXT;

CREATE INDEX "Department_leader_id_idx"
ON "Department"("leader_id");

ALTER TABLE "Department"
ADD CONSTRAINT "Department_leader_id_fkey"
FOREIGN KEY ("leader_id") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
