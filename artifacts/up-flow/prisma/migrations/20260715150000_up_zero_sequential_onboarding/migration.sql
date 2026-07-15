ALTER TABLE "ClientOnboarding"
  ADD COLUMN IF NOT EXISTS "sequence_status" TEXT NOT NULL DEFAULT 'commercial_pending',
  ADD COLUMN IF NOT EXISTS "commercial_completed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "technical_support_started_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "up_zero_configuration_completed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "marketing_b2b_released_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "marketing_b2b_dependency_override_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "marketing_b2b_dependency_overridden_by" TEXT,
  ADD COLUMN IF NOT EXISTS "marketing_b2b_dependency_overridden_at" TIMESTAMP(3);

ALTER TABLE "OnboardingChecklistItem"
  ADD COLUMN IF NOT EXISTS "automation_key" TEXT;

UPDATE "ClientOnboarding" AS onboarding
SET "commercial_completed_at" = COALESCE(
  onboarding."commercial_completed_at",
  (
    SELECT item."completed_at"
    FROM "OnboardingChecklistItem" AS item
    WHERE item."onboarding_id" = onboarding."id"
      AND lower(item."department") = 'commercial'
      AND item."status" = 'complete'
    ORDER BY item."completed_at" DESC NULLS LAST
    LIMIT 1
  ),
  onboarding."created_at"
);

UPDATE "ClientOnboarding" AS onboarding
SET
  "sequence_status" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(onboarding."contracted_services") = 'array'
            THEN onboarding."contracted_services"
          ELSE '[]'::jsonb
        END
      ) AS service(value)
      WHERE btrim(regexp_replace(lower(service.value), '[^a-z0-9]+', ' ', 'g')) = 'up zero'
    ) THEN 'technical_support_pending'
    ELSE 'marketing_b2b_ready'
  END,
  "marketing_b2b_released_at" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(onboarding."contracted_services") = 'array'
            THEN onboarding."contracted_services"
          ELSE '[]'::jsonb
        END
      ) AS service(value)
      WHERE btrim(regexp_replace(lower(service.value), '[^a-z0-9]+', ' ', 'g')) = 'up zero'
    ) THEN onboarding."marketing_b2b_released_at"
    ELSE COALESCE(onboarding."marketing_b2b_released_at", onboarding."commercial_completed_at", onboarding."created_at")
  END;

CREATE INDEX IF NOT EXISTS "ClientOnboarding_workspace_id_sequence_status_idx"
  ON "ClientOnboarding"("workspace_id", "sequence_status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OnboardingChecklistItem_onboarding_id_automation_key_key'
      AND conrelid = '"OnboardingChecklistItem"'::regclass
  ) THEN
    ALTER TABLE "OnboardingChecklistItem"
      ADD CONSTRAINT "OnboardingChecklistItem_onboarding_id_automation_key_key"
      UNIQUE ("onboarding_id", "automation_key");
  END IF;
END $$;
