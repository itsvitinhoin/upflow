import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/log-error";

export async function reconcileAcceptedWorkspaceInvites(workspaceId: string) {
  const acceptedInvites = await prisma.workspaceInvite.findMany({
    where: {
      workspace_id: workspaceId,
      accepted_at: { not: null },
    },
    select: {
      id: true,
      email: true,
      role: true,
      accepted_by: true,
    },
  });

  for (const invite of acceptedInvites) {
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: { email: invite.email.toLowerCase() },
          create: {
            email: invite.email.toLowerCase(),
            name: invite.email.split("@")[0] || invite.email,
            role: "member",
          },
          update: {},
          select: { id: true },
        });

        await tx.workspaceMember.upsert({
          where: {
            workspace_id_user_id: {
              workspace_id: workspaceId,
              user_id: user.id,
            },
          },
          create: {
            workspace_id: workspaceId,
            user_id: user.id,
            role: invite.role,
            status: "active",
          },
          update: {
            role: invite.role,
            status: "active",
          },
        });

        if (!invite.accepted_by) {
          await tx.workspaceInvite.update({
            where: { id: invite.id },
            data: { accepted_by: user.id },
          });
        }
      });
    } catch (err) {
      logError("invites:reconcile-accepted", err, {
        invite_id: invite.id,
        workspace_id: workspaceId,
      });
    }
  }
}
