ALTER TABLE "SupportGroup"
ADD COLUMN "group_name" TEXT,
ADD COLUMN "main_client_contact" TEXT,
ADD COLUMN "commercial_responsible" TEXT,
ADD COLUMN "account_responsible" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'not_created';