ALTER TABLE "ServiceLeaderMapping" ADD COLUMN "backup_leader_id" TEXT;
CREATE INDEX "ServiceLeaderMapping_backup_leader_id_idx" ON "ServiceLeaderMapping"("backup_leader_id");
ALTER TABLE "ServiceLeaderMapping" ADD CONSTRAINT "ServiceLeaderMapping_backup_leader_id_fkey" FOREIGN KEY ("backup_leader_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
