import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@upflow.io" },
    update: { password_hash: passwordHash },
    create: {
      email: "admin@upflow.io",
      name: "Alex Johnson",
      role: "admin",
      password_hash: passwordHash,
    },
  });

  const sarah = await prisma.user.upsert({
    where: { email: "sarah@upflow.io" },
    update: { password_hash: passwordHash },
    create: {
      email: "sarah@upflow.io",
      name: "Sarah Chen",
      role: "member",
      password_hash: passwordHash,
    },
  });

  const mike = await prisma.user.upsert({
    where: { email: "mike@upflow.io" },
    update: { password_hash: passwordHash },
    create: {
      email: "mike@upflow.io",
      name: "Mike Wilson",
      role: "member",
      password_hash: passwordHash,
    },
  });

  console.log("Users:", admin.email, sarah.email, mike.email);

  // Default workspace where everyone is a member.
  const acme = await prisma.workspace.upsert({
    where: { slug: "acme" },
    update: {},
    create: { name: "Acme", slug: "acme" },
  });

  for (const [user, role] of [
    [admin, "owner"],
    [sarah, "member"],
    [mike, "member"],
  ] as const) {
    await prisma.workspaceMember.upsert({
      where: {
        workspace_id_user_id: { workspace_id: acme.id, user_id: user.id },
      },
      create: { workspace_id: acme.id, user_id: user.id, role },
      update: { role },
    });
  }
  console.log("Workspace:", acme.name);

  const p1 = await prisma.project.upsert({
    where: { id: "project-website-redesign" },
    update: { workspace_id: acme.id },
    create: {
      id: "project-website-redesign",
      name: "Website Redesign",
      description: "Modernize the company website with new branding and improved UX.",
      status: "active",
      workspace_id: acme.id,
      owner_id: admin.id,
    },
  });

  const p2 = await prisma.project.upsert({
    where: { id: "project-mobile-app" },
    update: { workspace_id: acme.id },
    create: {
      id: "project-mobile-app",
      name: "Mobile App Launch",
      description: "Build and launch the iOS and Android mobile application.",
      status: "active",
      workspace_id: acme.id,
      owner_id: sarah.id,
    },
  });

  const p3 = await prisma.project.upsert({
    where: { id: "project-api-v2" },
    update: { workspace_id: acme.id },
    create: {
      id: "project-api-v2",
      name: "API v2 Migration",
      description: "Migrate all endpoints to RESTful v2 API with OpenAPI docs.",
      status: "active",
      workspace_id: acme.id,
      owner_id: mike.id,
    },
  });

  console.log("Projects:", p1.name, p2.name, p3.name);

  const taskDefs = [
    { title: "Design new homepage hero", status: "todo" as const, priority: "high" as const, project_id: p1.id, assignee_id: sarah.id },
    { title: "Update brand color palette", status: "in_progress" as const, priority: "medium" as const, project_id: p1.id, assignee_id: sarah.id },
    { title: "Write copy for About page", status: "todo" as const, priority: "low" as const, project_id: p1.id, assignee_id: admin.id },
    { title: "SEO audit and fixes", status: "done" as const, priority: "medium" as const, project_id: p1.id, assignee_id: mike.id },
    { title: "Set up CI/CD pipeline", status: "done" as const, priority: "high" as const, project_id: p1.id, assignee_id: mike.id },

    { title: "Wireframes for onboarding flow", status: "done" as const, priority: "high" as const, project_id: p2.id, assignee_id: sarah.id },
    { title: "Implement push notifications", status: "in_progress" as const, priority: "high" as const, project_id: p2.id, assignee_id: mike.id },
    { title: "App Store submission prep", status: "todo" as const, priority: "medium" as const, project_id: p2.id, assignee_id: admin.id },
    { title: "Beta testing with 20 users", status: "in_progress" as const, priority: "high" as const, project_id: p2.id, assignee_id: sarah.id },

    { title: "Define API schema", status: "done" as const, priority: "high" as const, project_id: p3.id, assignee_id: mike.id },
    { title: "Migrate auth endpoints", status: "in_progress" as const, priority: "high" as const, project_id: p3.id, assignee_id: mike.id },
    { title: "Write OpenAPI documentation", status: "todo" as const, priority: "medium" as const, project_id: p3.id, assignee_id: admin.id },
    { title: "Rate limiting implementation", status: "todo" as const, priority: "medium" as const, project_id: p3.id, assignee_id: mike.id },
  ];

  const createdTasks = [];
  for (const t of taskDefs) {
    const task = await prisma.task.create({ data: t });
    createdTasks.push(task);
  }

  console.log(`Created ${createdTasks.length} tasks`);

  const adminTasks = createdTasks.filter((t) => t.assignee_id === admin.id);
  for (const task of adminTasks.slice(0, 2)) {
    await prisma.notification.create({
      data: { type: "assigned", user_id: admin.id, task_id: task.id, read: false },
    });
  }
  if (adminTasks.length > 0) {
    await prisma.notification.create({
      data: { type: "due_soon", user_id: admin.id, task_id: adminTasks[0].id, read: false },
    });
  }

  console.log("Seed complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
