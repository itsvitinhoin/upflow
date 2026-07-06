import { createClient } from "@supabase/supabase-js";
import type { Prisma } from "@prisma/client";
import { logError } from "@/lib/log-error";

export type SupabaseUserDeletionResult = {
  attempted: boolean;
  deleted: number;
  error: string | null;
};

export async function deleteSupabaseUsersByEmail(email: string): Promise<SupabaseUserDeletionResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      attempted: false,
      deleted: 0,
      error: "Supabase service role key is required to delete the login account",
    };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const targetEmail = email.trim().toLowerCase();
  let deleted = 0;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      logError("user-deletion:supabase-list-users", error, { email: targetEmail, page });
      return { attempted: true, deleted, error: error.message };
    }

    const users = data.users ?? [];
    const matches = users.filter((user) => user.email?.toLowerCase() === targetEmail);
    for (const user of matches) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) {
        logError("user-deletion:supabase-delete-user", deleteError, {
          email: targetEmail,
          supabase_id: user.id,
        });
        return { attempted: true, deleted, error: deleteError.message };
      }
      deleted += 1;
    }

    if (users.length < 1000) break;
  }

  return { attempted: true, deleted, error: null };
}

export async function deleteAppUserPreservingWorkspaceData(
  tx: Prisma.TransactionClient,
  {
    userId,
    email,
    replacementUserId,
  }: { userId: string; email: string; replacementUserId: string },
) {
  const emailFilter = { equals: email, mode: "insensitive" as const };

  await tx.workspaceInvite.deleteMany({
    where: { OR: [{ email: emailFilter }, { accepted_by: userId }] },
  });

  await tx.workspaceInvite.updateMany({ where: { invited_by: userId }, data: { invited_by: replacementUserId } });
  await tx.space.updateMany({ where: { owner_id: userId }, data: { owner_id: replacementUserId } });
  await tx.folder.updateMany({ where: { owner_id: userId }, data: { owner_id: replacementUserId } });
  await tx.project.updateMany({ where: { owner_id: userId }, data: { owner_id: replacementUserId } });
  await tx.company.updateMany({ where: { owner_id: userId }, data: { owner_id: replacementUserId } });
  await tx.calendarEvent.updateMany({ where: { created_by: userId }, data: { created_by: replacementUserId } });
  await tx.recurringTaskRule.updateMany({ where: { created_by: userId }, data: { created_by: replacementUserId } });
  await tx.automationRule.updateMany({ where: { created_by: userId }, data: { created_by: replacementUserId } });
  await tx.template.updateMany({ where: { created_by: userId }, data: { created_by: replacementUserId } });
  await tx.approvalRequest.updateMany({ where: { requested_by: userId }, data: { requested_by: replacementUserId } });
  await tx.clientReport.updateMany({ where: { author_id: userId }, data: { author_id: replacementUserId } });
  await tx.clientOnboarding.updateMany({ where: { created_by: userId }, data: { created_by: replacementUserId } });
  await tx.clientContract.updateMany({ where: { uploaded_by: userId }, data: { uploaded_by: replacementUserId } });
  await tx.doc.updateMany({ where: { author_id: userId }, data: { author_id: replacementUserId } });
  await tx.comment.updateMany({ where: { author_id: userId }, data: { author_id: replacementUserId } });
  await tx.companyNote.updateMany({ where: { author_id: userId }, data: { author_id: replacementUserId } });

  await tx.task.updateMany({ where: { assignee_id: userId }, data: { assignee_id: null } });
  await tx.goal.updateMany({ where: { owner_id: userId }, data: { owner_id: null } });
  await tx.activityEvent.updateMany({ where: { actor_id: userId }, data: { actor_id: null } });
  await tx.activityEvent.updateMany({
    where: { entity_type: "user", entity_id: userId },
    data: { entity_id: null, metadata: { deleted_user: true } },
  });
  await tx.automationRun.updateMany({ where: { created_by: userId }, data: { created_by: null } });
  await tx.approvalRequest.updateMany({ where: { approver_id: userId }, data: { approver_id: null } });
  await tx.approvalEvent.updateMany({ where: { actor_id: userId }, data: { actor_id: null } });
  await tx.clientReport.updateMany({ where: { approved_by: userId }, data: { approved_by: null } });
  await tx.clientReport.updateMany({ where: { sent_by: userId }, data: { sent_by: null } });
  await tx.project.updateMany({ where: { responsible_salesperson_id: userId }, data: { responsible_salesperson_id: null } });
  await tx.clientOnboarding.updateMany({
    where: { responsible_salesperson_id: userId },
    data: { responsible_salesperson_id: null },
  });
  await tx.clientOnboarding.updateMany({
    where: { completion_overridden_by: userId },
    data: { completion_overridden_by: null },
  });
  await tx.onboardingChecklistItem.updateMany({ where: { owner_id: userId }, data: { owner_id: null } });
  await tx.onboardingChecklistItem.updateMany({ where: { completed_by: userId }, data: { completed_by: null } });
  await tx.onboardingServiceAssignment.updateMany({ where: { leader_id: userId }, data: { leader_id: null } });
  await tx.onboardingMeeting.updateMany({ where: { leader_id: userId }, data: { leader_id: null } });
  await tx.supportGroup.updateMany({ where: { created_by: userId }, data: { created_by: null } });
  await tx.serviceLeaderMapping.updateMany({ where: { leader_id: userId }, data: { leader_id: null } });
  await tx.serviceLeaderMapping.updateMany({ where: { backup_leader_id: userId }, data: { backup_leader_id: null } });
  await tx.marketingB2BOnboardingForm.updateMany({ where: { completed_by: userId }, data: { completed_by: null } });
  await tx.marketingB2COnboardingForm.updateMany({ where: { completed_by: userId }, data: { completed_by: null } });

  await tx.notification.deleteMany({ where: { user_id: userId } });
  await tx.calendarEventAttendee.deleteMany({ where: { user_id: userId } });
  await tx.projectMember.deleteMany({ where: { user_id: userId } });
  await tx.savedView.deleteMany({ where: { user_id: userId } });
  await tx.workspaceMember.deleteMany({ where: { user_id: userId } });
  await tx.timeEntry.deleteMany({ where: { user_id: userId } });

  await tx.user.delete({ where: { id: userId } });
}
