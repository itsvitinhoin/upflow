import { test, expect, request } from "@playwright/test";
import { SEEDED, apiAs, loginAs, uniq } from "./helpers";

/**
 * Full happy-path smoke against the JSON API the UI consumes. We use the
 * `request` fixture (no browser launch needed — the Replit sandbox doesn't
 * ship the browser's system libs out of the box). The corresponding UI
 * regressions are covered by `ui.spec.ts`, which skips gracefully when no
 * browser is available.
 *
 * Covers: login → space → folder → project → task (with priority / due /
 * assignee) → custom field def → custom field value → patch task → search →
 * invite teammate → workspace switch → workspace isolation → logout.
 */
test.describe("Up Flow smoke (API)", () => {
  test("admin happy path", async ({ playwright, baseURL }) => {
    const api = await playwright.request.newContext({ baseURL });
    await loginAs(api, SEEDED.admin.email);

    // Sanity: GET / behind the middleware returns 2xx (no /login bounce).
    const home = await api.get("/");
    expect(
      home.status(),
      `GET / should be 2xx, got ${home.status()}`,
    ).toBeLessThan(400);

    // 1. Space → folder → project.
    const space = await (
      await api.post("/api/spaces", { data: { name: uniq("Space") } })
    ).json();
    expect(space.id, "space created").toBeTruthy();

    const folder = await (
      await api.post("/api/folders", {
        data: { name: uniq("Folder"), space_id: space.id },
      })
    ).json();
    expect(folder.id, "folder created").toBeTruthy();

    const projectName = uniq("Project");
    const project = await (
      await api.post("/api/projects", {
        data: { name: projectName, space_id: space.id, folder_id: folder.id },
      })
    ).json();
    expect(project.id, "project created").toBeTruthy();

    const folderViewRes = await api.get(`/api/folders/${folder.id}`);
    expect(
      folderViewRes.ok(),
      `folder container fetch: ${folderViewRes.status()}`,
    ).toBeTruthy();
    const folderView = await folderViewRes.json();
    expect(folderView.folder.id).toBe(folder.id);
    expect(folderView.space.id).toBe(space.id);
    expect(
      folderView.projects.some((p: { id: string }) => p.id === project.id),
      "folder container includes its lists",
    ).toBeTruthy();

    // 2. Find Sarah (seeded member) so we can assign her.
    const usersResp = await (await api.get("/api/users")).json();
    const users = usersResp.items ?? usersResp;
    const sarah = users.find(
      (u: { email: string }) => u.email === SEEDED.member.email,
    );
    expect(sarah?.id, "Sarah seeded").toBeTruthy();

    // 3. Task with priority / due-date / assignee.
    const dueDate = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const taskTitle = uniq("Task");
    const task = await (
      await api.post("/api/tasks", {
        data: {
          title: taskTitle,
          project_id: project.id,
          priority: "high",
          due_date: dueDate,
          assignee_id: sarah.id,
        },
      })
    ).json();
    expect(task.id).toBeTruthy();
    expect(task.priority).toBe("high");
    expect(task.assignee_id).toBe(sarah.id);

    // 4. Custom field definition on the project + value on the task.
    const fieldRes = await api.post(
      `/api/projects/${project.id}/custom-fields`,
      { data: { name: "Story Points", type: "number" } },
    );
    expect(fieldRes.status(), "admin can create custom fields").toBe(201);
    const field = await fieldRes.json();

    const cfvRes = await api.put(`/api/tasks/${task.id}/custom-fields`, {
      data: { definition_id: field.id, value: 5 },
    });
    expect(
      cfvRes.ok(),
      `set custom field value: ${cfvRes.status()}`,
    ).toBeTruthy();

    // 5. Edit the task (same PATCH the task-detail sheet fires).
    const patchRes = await api.patch(`/api/tasks/${task.id}`, {
      data: { priority: "medium", status: "in_progress" },
    });
    expect(patchRes.ok(), `patch task: ${patchRes.status()}`).toBeTruthy();
    const patched = await patchRes.json();
    expect(patched.priority).toBe("medium");
    expect(patched.status).toBe("in_progress");

    const invalidPatch = await api.patch(`/api/tasks/${task.id}`, {
      data: { due_date: "not-a-date" },
    });
    expect(invalidPatch.status(), "invalid task dates are rejected").toBe(400);

    // Active non-guest contributors can delete tasks in projects without an
    // explicit member allowlist. Exercise that policy on a disposable task so
    // the main task remains available for the search checks below.
    const deleteCandidate = await (
      await api.post("/api/tasks", {
        data: {
          title: uniq("Delete candidate"),
          project_id: project.id,
          assignee_id: sarah.id,
        },
      })
    ).json();
    const memberApi = await apiAs(baseURL!, SEEDED.member.email);
    const allowedDelete = await memberApi.delete(
      `/api/tasks/${deleteCandidate.id}`,
    );
    expect(allowedDelete.status(), "active contributors can delete tasks").toBe(
      200,
    );
    await memberApi.dispose();

    const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const eventRes = await api.post("/api/calendar/events", {
      data: {
        title: uniq("Meeting"),
        type: "meeting",
        starts_at: startsAt,
        ends_at: endsAt,
        timezone: "America/Sao_Paulo",
        project_id: project.id,
      },
    });
    expect(
      eventRes.status(),
      `create calendar event: ${eventRes.status()}`,
    ).toBe(201);
    const event = await eventRes.json();
    const events = await (await api.get("/api/calendar/events")).json();
    expect(
      events.items.some((e: { id: string }) => e.id === event.id),
    ).toBeTruthy();
    const updateEvent = await api.patch(`/api/calendar/events/${event.id}`, {
      data: { title: `${event.title} updated` },
    });
    expect(
      updateEvent.ok(),
      `update calendar event: ${updateEvent.status()}`,
    ).toBeTruthy();
    const deleteEvent = await api.delete(`/api/calendar/events/${event.id}`);
    expect(
      deleteEvent.ok(),
      `delete calendar event: ${deleteEvent.status()}`,
    ).toBeTruthy();

    const existingRunning = await (await api.get("/api/time/running")).json();
    if (existingRunning?.id) {
      await api.post("/api/time/stop", { data: { id: existingRunning.id } });
    }
    const startTimer = await api.post("/api/time/start", {
      data: { project_id: project.id },
    });
    expect(startTimer.status(), `start timer: ${startTimer.status()}`).toBe(
      201,
    );
    const running = await (await api.get("/api/time/running")).json();
    expect(running.id, "running timer is recoverable").toBeTruthy();
    const stopTimer = await api.post("/api/time/stop", {
      data: { id: running.id },
    });
    expect(stopTimer.ok(), `stop timer: ${stopTimer.status()}`).toBeTruthy();

    // 6. Search returns the task. Poll briefly for eventual consistency.
    let found = false;
    for (let i = 0; i < 8; i++) {
      const r = await api.get(`/api/search?q=${encodeURIComponent(taskTitle)}`);
      expect(r.ok()).toBeTruthy();
      const body = await r.json();
      const items: Array<{ id: string }> =
        body.tasks ?? body.items ?? body.results ?? [];
      if (items.some((t) => t.id === task.id)) {
        found = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    expect(found, "search returns the new task").toBeTruthy();

    // 7. Invite a teammate (API-only, no mail delivery).
    const inviteRes = await api.post("/api/invites", {
      data: { emails: [`invitee+${Date.now()}@example.com`], role: "member" },
    });
    expect(inviteRes.ok(), `create invite: ${inviteRes.status()}`).toBeTruthy();

    // 8. Workspace switch: create new ws, switch, verify isolation.
    const newWs = await (
      await api.post("/api/workspaces", { data: { name: uniq("Test WS") } })
    ).json();
    expect(newWs.id).toBeTruthy();

    const switchRes = await api.post("/api/workspaces/switch", {
      data: { workspace_id: newWs.id },
    });
    expect(switchRes.ok(), `switch ws: ${switchRes.status()}`).toBeTruthy();

    const projectsInNew = await (await api.get("/api/projects")).json();
    const projectsList = projectsInNew.items ?? projectsInNew;
    expect(
      projectsList.some((p: { id: string }) => p.id === project.id),
      "project from other workspace must be hidden",
    ).toBeFalsy();

    // 9. Logout — explicit cookie clear since the test-login cookie isn't
    // owned by Supabase's logout endpoint.
    await api.post("/api/auth/logout").catch(() => undefined);
    await api.dispose();

    const anon = await playwright.request.newContext({ baseURL });
    const unauthed = await anon.get("/api/projects");
    expect(unauthed.status(), "after logout the API rejects").toBe(401);
    await anon.dispose();
  });
});
