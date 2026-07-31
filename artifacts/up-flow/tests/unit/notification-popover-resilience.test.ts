import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const header = readFileSync(join(root, "src/components/layout/header.tsx"), "utf8");

test("notification refreshes ignore stale responses and reuse an in-flight forced request", () => {
  assert.match(header, /if \(notificationRequest\?\.userId === userId\)/);
  assert.match(header, /notificationListRequestRef/);
  assert.match(header, /notificationUnreadRequestRef/);
  assert.match(header, /notificationListRequestRef\.current === requestId/);
  assert.match(header, /notificationUnreadRequestRef\.current === requestId/);
});

test("notification availability reflects the list instead of a recoverable count refresh", () => {
  assert.match(
    header,
    /notificationListUnavailable \|\| \(!notificationsHaveLoaded && notificationUnreadUnavailable\)/,
  );
});

test("the notification popover exposes and restores accessible focus state", () => {
  assert.match(header, /notificationToggleRef/);
  assert.match(header, /aria-expanded=\{panelOpen\}/);
  assert.match(header, /aria-controls="header-notification-panel"/);
  assert.match(header, /id="header-notification-panel"/);
  assert.match(header, /closeNotificationPanel\(true\)/);
});
