import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("notifications use the server broadcast endpoint and the Prisma table name", () => {
  const serverNotifications = read("src/lib/supabase-server.ts");
  const header = read("src/components/layout/header.tsx");

  assert.match(serverNotifications, /\.httpSend\("new_notification", \{\}\)/);
  assert.match(serverNotifications, /supabase:broadcast-notification/);
  assert.match(header, /table: "Notification"/);
});
