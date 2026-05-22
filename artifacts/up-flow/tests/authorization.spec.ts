import { test, expect } from "@playwright/test";
import { SEEDED, apiAs, uniq } from "./helpers";

/**
 * Critical authorization checks — these are the ones that would let a user
 * see or mutate another workspace's data if the workspace scoping ever
 * regressed.
 */
test.describe("Up Flow authorization (API)", () => {
  test("auth me returns active workspace role fields", async ({ baseURL }) => {
    const admin = await apiAs(baseURL!, SEEDED.admin.email);
    const me = await (await admin.get("/api/auth/me")).json();
    expect(me.currentWorkspaceId).toBeTruthy();
    expect(["owner", "admin", "member"]).toContain(me.currentRole);
    expect(typeof me.isSuperAdmin).toBe("boolean");
    await admin.dispose();
  });

  test("non-admin members cannot manage custom fields", async ({ baseURL }) => {
    const admin = await apiAs(baseURL!, SEEDED.admin.email);
    const space = await (
      await admin.post("/api/spaces", { data: { name: uniq("AuthSpace") } })
    ).json();
    expect(space.id).toBeTruthy();
    const project = await (
      await admin.post("/api/projects", {
        data: { name: uniq("AuthProject"), space_id: space.id },
      })
    ).json();
    expect(project.id).toBeTruthy();

    const member = await apiAs(baseURL!, SEEDED.member.email);

    // Sarah CAN read field defs (membership grants read).
    const list = await member.get(`/api/projects/${project.id}/custom-fields`);
    expect(list.ok(), `member can read field list: ${list.status()}`).toBeTruthy();

    // Sarah CANNOT create one.
    const denied = await member.post(
      `/api/projects/${project.id}/custom-fields`,
      { data: { name: "Should fail", type: "text" } },
    );
    expect(
      denied.status(),
      `non-admin POST custom-fields must 403, got ${denied.status()}`,
    ).toBe(403);

    await admin.dispose();
    await member.dispose();
  });

  test("non-member cannot see another workspace's project", async ({ baseURL }) => {
    const admin = await apiAs(baseURL!, SEEDED.admin.email);

    const isolated = await (
      await admin.post("/api/workspaces", { data: { name: uniq("Isolated") } })
    ).json();
    expect(isolated.id).toBeTruthy();

    const switchRes = await admin.post("/api/workspaces/switch", {
      data: { workspace_id: isolated.id },
    });
    expect(switchRes.ok(), `switch to isolated: ${switchRes.status()}`).toBeTruthy();

    const secretProject = await (
      await admin.post("/api/projects", { data: { name: uniq("Secret") } })
    ).json();
    expect(secretProject.id, `project created: ${JSON.stringify(secretProject)}`).toBeTruthy();
    expect(secretProject.workspace_id).toBe(isolated.id);

    // Sarah's project list (in her default ws) must NOT include it.
    const member = await apiAs(baseURL!, SEEDED.member.email);
    const list = await (await member.get("/api/projects")).json();
    const items = list.items ?? list;
    expect(
      items.some((p: { id: string }) => p.id === secretProject.id),
      "isolated project must be hidden from non-members",
    ).toBeFalsy();

    // Direct fetch by id must also be forbidden.
    const direct = await member.get(`/api/projects/${secretProject.id}`);
    expect(
      [403, 404].includes(direct.status()),
      `direct GET must be 403/404, got ${direct.status()}`,
    ).toBeTruthy();

    await admin.dispose();
    await member.dispose();
  });

  test("non-member cannot see another workspace's folder container", async ({
    baseURL,
  }) => {
    const admin = await apiAs(baseURL!, SEEDED.admin.email);

    const isolated = await (
      await admin.post("/api/workspaces", { data: { name: uniq("FolderWS") } })
    ).json();
    expect(isolated.id).toBeTruthy();

    const switchRes = await admin.post("/api/workspaces/switch", {
      data: { workspace_id: isolated.id },
    });
    expect(switchRes.ok(), `switch to isolated: ${switchRes.status()}`).toBeTruthy();

    const space = await (
      await admin.post("/api/spaces", { data: { name: uniq("PrivateSpace") } })
    ).json();
    const folder = await (
      await admin.post("/api/folders", {
        data: { name: uniq("PrivateFolder"), space_id: space.id },
      })
    ).json();
    expect(folder.id).toBeTruthy();

    const member = await apiAs(baseURL!, SEEDED.member.email);
    const direct = await member.get(`/api/folders/${folder.id}`);
    expect(direct.status(), `folder GET must be hidden, got ${direct.status()}`).toBe(404);

    await admin.dispose();
    await member.dispose();
  });

  test("non-member cannot access another workspace's calendar event", async ({
    baseURL,
  }) => {
    const admin = await apiAs(baseURL!, SEEDED.admin.email);

    const isolated = await (
      await admin.post("/api/workspaces", { data: { name: uniq("CalendarWS") } })
    ).json();
    expect(isolated.id).toBeTruthy();

    const switchRes = await admin.post("/api/workspaces/switch", {
      data: { workspace_id: isolated.id },
    });
    expect(switchRes.ok(), `switch to isolated: ${switchRes.status()}`).toBeTruthy();

    const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const event = await (
      await admin.post("/api/calendar/events", {
        data: {
          title: uniq("PrivateEvent"),
          starts_at: startsAt,
          timezone: "America/Sao_Paulo",
        },
      })
    ).json();
    expect(event.id).toBeTruthy();

    const member = await apiAs(baseURL!, SEEDED.member.email);
    const direct = await member.get(`/api/calendar/events/${event.id}`);
    expect(direct.status(), `event GET must be hidden, got ${direct.status()}`).toBe(404);

    await admin.dispose();
    await member.dispose();
  });
});
