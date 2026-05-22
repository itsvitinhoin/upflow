import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/log-error";
import { Prisma } from "@prisma/client";

export async function recordActivity(input: {
  workspace_id: string;
  actor_id?: string | null;
  type: string;
  entity_type: string;
  entity_id?: string | null;
  project_id?: string | null;
  task_id?: string | null;
  company_id?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}) {
  await prisma.activityEvent
    .create({
      data: {
        workspace_id: input.workspace_id,
        actor_id: input.actor_id ?? null,
        type: input.type,
        entity_type: input.entity_type,
        entity_id: input.entity_id ?? null,
        project_id: input.project_id ?? null,
        task_id: input.task_id ?? null,
        company_id: input.company_id ?? null,
        metadata: input.metadata === null ? Prisma.JsonNull : input.metadata ?? undefined,
      },
    })
    .catch((err: unknown) =>
      logError("activity:record", err, {
        workspace_id: input.workspace_id,
        type: input.type,
        entity_type: input.entity_type,
      }),
    );
}
