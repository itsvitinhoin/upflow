DO $$
BEGIN
  CREATE TYPE "ProjectKind" AS ENUM (
    'client',
    'internal',
    'operational_queue',
    'onboarding'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "ProjectKind" ADD VALUE IF NOT EXISTS 'client';
ALTER TYPE "ProjectKind" ADD VALUE IF NOT EXISTS 'internal';
ALTER TYPE "ProjectKind" ADD VALUE IF NOT EXISTS 'operational_queue';
ALTER TYPE "ProjectKind" ADD VALUE IF NOT EXISTS 'onboarding';

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "kind" "ProjectKind" NOT NULL DEFAULT 'internal';

-- Starter lists and the shared departmental onboarding queues are reusable
-- operational containers. Match both the seeded English names and aliases
-- used by older workspaces so this update can safely be re-run.
WITH operational_project_names (space_name, project_name) AS (
  VALUES
    ('commercial', 'leads'),
    ('commercial', 'proposals'),
    ('commercial', 'follow-ups'),
    ('commercial', 'contracts'),
    ('commercial', 'contracts & handoffs'),
    ('comercial', 'leads'),
    ('comercial', 'proposals'),
    ('comercial', 'follow-ups'),
    ('comercial', 'contracts'),
    ('comercial', 'contracts & handoffs'),
    ('marketing b2b', 'campaigns'),
    ('marketing b2b', 'linkedin & outbound'),
    ('marketing b2b', 'landing pages'),
    ('marketing b2b', 'reports'),
    ('marketing b2b', 'service onboarding'),
    ('paid media', 'campaigns'),
    ('paid media', 'linkedin & outbound'),
    ('paid media', 'landing pages'),
    ('paid media', 'reports'),
    ('paid media', 'service onboarding'),
    ('media buying', 'campaigns'),
    ('media buying', 'linkedin & outbound'),
    ('media buying', 'landing pages'),
    ('media buying', 'reports'),
    ('media buying', 'service onboarding'),
    ('marketing', 'campaigns'),
    ('marketing', 'linkedin & outbound'),
    ('marketing', 'landing pages'),
    ('marketing', 'reports'),
    ('marketing', 'service onboarding'),
    ('marketing b2c', 'campaigns'),
    ('marketing b2c', 'content calendar'),
    ('marketing b2c', 'ads'),
    ('marketing b2c', 'promotions'),
    ('marketing b2c', 'service onboarding'),
    ('consumer marketing', 'campaigns'),
    ('consumer marketing', 'content calendar'),
    ('consumer marketing', 'ads'),
    ('consumer marketing', 'promotions'),
    ('consumer marketing', 'service onboarding'),
    ('b2c', 'campaigns'),
    ('b2c', 'content calendar'),
    ('b2c', 'ads'),
    ('b2c', 'promotions'),
    ('b2c', 'service onboarding'),
    ('varejo', 'campaigns'),
    ('varejo', 'content calendar'),
    ('varejo', 'ads'),
    ('varejo', 'promotions'),
    ('varejo', 'service onboarding'),
    ('ecommerce', 'campaigns'),
    ('ecommerce', 'content calendar'),
    ('ecommerce', 'ads'),
    ('ecommerce', 'promotions'),
    ('ecommerce', 'service onboarding'),
    ('creative & design', 'design queue'),
    ('creative & design', 'creative reviews'),
    ('creative & design', 'brand assets'),
    ('creative & design', 'approvals'),
    ('creative & design', 'service onboarding'),
    ('creative and design', 'design queue'),
    ('creative and design', 'creative reviews'),
    ('creative and design', 'brand assets'),
    ('creative and design', 'approvals'),
    ('creative and design', 'service onboarding'),
    ('creative design', 'design queue'),
    ('creative design', 'creative reviews'),
    ('creative design', 'brand assets'),
    ('creative design', 'approvals'),
    ('creative design', 'service onboarding'),
    ('criativo', 'design queue'),
    ('criativo', 'creative reviews'),
    ('criativo', 'brand assets'),
    ('criativo', 'approvals'),
    ('criativo', 'service onboarding'),
    ('design', 'design queue'),
    ('design', 'creative reviews'),
    ('design', 'brand assets'),
    ('design', 'approvals'),
    ('design', 'service onboarding'),
    ('finance', 'invoices'),
    ('finance', 'payments'),
    ('finance', 'commissions'),
    ('finance', 'expenses'),
    ('finance', 'client onboarding'),
    ('financial', 'invoices'),
    ('financial', 'payments'),
    ('financial', 'commissions'),
    ('financial', 'expenses'),
    ('financial', 'client onboarding'),
    ('financeiro', 'invoices'),
    ('financeiro', 'payments'),
    ('financeiro', 'commissions'),
    ('financeiro', 'expenses'),
    ('financeiro', 'client onboarding'),
    ('production', 'shoots'),
    ('production', 'editing'),
    ('production', 'publishing'),
    ('production', 'deliverables'),
    ('support', 'support tickets'),
    ('support', 'bug reports'),
    ('support', 'access issues'),
    ('support', 'client requests'),
    ('support', 'resolved'),
    ('support', 'client channels'),
    ('technical support', 'support tickets'),
    ('technical support', 'bug reports'),
    ('technical support', 'access issues'),
    ('technical support', 'client requests'),
    ('technical support', 'resolved'),
    ('technical support', 'client channels'),
    ('suporte', 'support tickets'),
    ('suporte', 'bug reports'),
    ('suporte', 'access issues'),
    ('suporte', 'client requests'),
    ('suporte', 'resolved'),
    ('suporte', 'client channels'),
    ('suporte tecnico', 'support tickets'),
    ('suporte tecnico', 'bug reports'),
    ('suporte tecnico', 'access issues'),
    ('suporte tecnico', 'client requests'),
    ('suporte tecnico', 'resolved'),
    ('suporte tecnico', 'client channels'),
    ('suporte técnico', 'support tickets'),
    ('suporte técnico', 'bug reports'),
    ('suporte técnico', 'access issues'),
    ('suporte técnico', 'client requests'),
    ('suporte técnico', 'resolved'),
    ('suporte técnico', 'client channels'),
    ('general admin', 'internal requests'),
    ('general admin', 'access & accounts'),
    ('general admin', 'documents'),
    ('general admin', 'vendors'),
    ('general admin', 'rh'),
    ('general admin', 'onboarding triage')
), matched_operational_projects AS (
  SELECT project."id"
  FROM "Project" AS project
  INNER JOIN "Space" AS space
    ON space."id" = project."space_id"
   AND space."workspace_id" = project."workspace_id"
  -- Runtime accepts aliases inside longer Space names such as "Finance Ops".
  -- Keep the alias bounded by normalized spaces so partial words do not match.
  INNER JOIN operational_project_names AS known
    ON (
      btrim(regexp_replace(
        translate(lower(btrim(space."name")), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
        '[^a-z0-9]+', ' ', 'g'
      )) = btrim(regexp_replace(
        translate(known.space_name, 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
        '[^a-z0-9]+', ' ', 'g'
      ))
      OR (' ' || btrim(regexp_replace(
        translate(lower(btrim(space."name")), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
        '[^a-z0-9]+', ' ', 'g'
      )) || ' ') LIKE ('% ' || btrim(regexp_replace(
        translate(known.space_name, 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
        '[^a-z0-9]+', ' ', 'g'
      )) || ' %')
    )
   AND btrim(regexp_replace(
         translate(lower(btrim(project."name")), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
         '[^a-z0-9]+', ' ', 'g'
       )) = btrim(regexp_replace(
         translate(known.project_name, 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
         '[^a-z0-9]+', ' ', 'g'
       ))
  WHERE project."company_id" IS NULL
    AND (
      project."folder_id" IS NULL
      OR (
        btrim(regexp_replace(
          translate(lower(btrim(project."name")), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
          '[^a-z0-9]+', ' ', 'g'
        )) IN ('contracts handoffs', 'client onboarding', 'client channels', 'service onboarding')
        AND EXISTS (
          SELECT 1
          FROM "OnboardingChecklistItem" AS item
          INNER JOIN "Task" AS task ON task."id" = item."task_id"
          WHERE task."project_id" = project."id"
        )
      )
      -- General Admin has one canonical foldered preset: RH folder -> RH project.
      -- Match that exact structure without opening every foldered RH project.
      OR (
        btrim(regexp_replace(
          translate(lower(btrim(space."name")), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
          '[^a-z0-9]+', ' ', 'g'
        )) = 'general admin'
        AND btrim(regexp_replace(
          translate(lower(btrim(project."name")), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
          '[^a-z0-9]+', ' ', 'g'
        )) = 'rh'
        AND EXISTS (
          SELECT 1
          FROM "Folder" AS rh_folder
          WHERE rh_folder."id" = project."folder_id"
            AND rh_folder."workspace_id" = project."workspace_id"
            AND rh_folder."space_id" = project."space_id"
            AND rh_folder."parent_id" IS NULL
            AND btrim(regexp_replace(
              translate(lower(btrim(rh_folder."name")), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
              '[^a-z0-9]+', ' ', 'g'
            )) = 'rh'
        )
      )
    )
)
UPDATE "Project" AS project
SET "kind" = 'operational_queue'
FROM matched_operational_projects AS matched
WHERE project."id" = matched."id"
  AND project."kind" = 'internal';

-- Projects enabled for onboarding or tied to an onboarding record, form,
-- checklist task, or Onboarding folder are onboarding projects. Shared
-- company-free queues were classified above and intentionally remain queues.
UPDATE "Project" AS project
SET "kind" = 'onboarding'
WHERE project."kind" = 'internal'
  AND (
    project."onboarding_enabled" = TRUE
    OR EXISTS (
      SELECT 1
      FROM "ClientOnboarding" AS onboarding
      WHERE onboarding."project_id" = project."id"
    )
    OR EXISTS (
      SELECT 1
      FROM "MarketingB2BOnboardingForm" AS form
      WHERE form."project_id" = project."id"
    )
    OR EXISTS (
      SELECT 1
      FROM "MarketingB2COnboardingForm" AS form
      WHERE form."project_id" = project."id"
    )
    OR EXISTS (
      SELECT 1
      FROM "OnboardingChecklistItem" AS item
      INNER JOIN "Task" AS task ON task."id" = item."task_id"
      WHERE task."project_id" = project."id"
    )
    OR (
      project."company_id" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM "Folder" AS client_folder
        INNER JOIN "Folder" AS root_folder
          ON root_folder."id" = client_folder."parent_id"
        WHERE client_folder."id" = project."folder_id"
          AND lower(btrim(root_folder."name")) IN ('onboarding', 'client onboarding')
      )
    )
  );

UPDATE "Project"
SET "kind" = 'client'
WHERE "company_id" IS NOT NULL
  AND "kind" = 'internal';

CREATE INDEX IF NOT EXISTS "Project_workspace_id_kind_status_idx"
  ON "Project"("workspace_id", "kind", "status");

CREATE INDEX IF NOT EXISTS "Project_workspace_id_company_id_kind_idx"
  ON "Project"("workspace_id", "company_id", "kind");
