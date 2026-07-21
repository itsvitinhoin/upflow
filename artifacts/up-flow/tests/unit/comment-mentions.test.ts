import assert from "node:assert/strict";
import test from "node:test";

import {
  appendVisibleMention,
  extractLegacyCommentMentions,
  hasVisibleMention,
  isUuid,
  normalizeCommentBody,
} from "../../src/lib/comment-mentions";

const LUIZ_ID = "f4f179fd-b04b-4c5c-9f04-d8261bb35ff6";

test("legacy mention markup is read for delivery but stored as a readable name", () => {
  const body = `Please review @[Luiz Paulo](${LUIZ_ID})`;
  const mentions = extractLegacyCommentMentions(body);

  assert.deepEqual([...mentions.userIds], [LUIZ_ID]);
  assert.equal(normalizeCommentBody(body), "Please review @Luiz Paulo");
});

test("picker mentions require the visible name and do not match a longer name", () => {
  assert.equal(
    hasVisibleMention("Hi @Luiz Paulo, please review this.", "Luiz Paulo"),
    true,
  );
  assert.equal(hasVisibleMention("Hi @Luiz Paulinho", "Luiz Paulo"), false);
  assert.equal(hasVisibleMention("No mention here", "Luiz Paulo"), false);
});

test("the picker adds a readable @Name without an internal user ID", () => {
  assert.equal(
    appendVisibleMention("Please review", "Luiz Paulo"),
    "Please review @Luiz Paulo ",
  );
  assert.equal(appendVisibleMention("", "Luiz Paulo"), "@Luiz Paulo ");
});

test("only UUID-shaped picker recipients are accepted", () => {
  assert.equal(isUuid(LUIZ_ID), true);
  assert.equal(isUuid("not-a-user-id"), false);
});
