import assert from "node:assert/strict";
import { test } from "node:test";
import {
  establishPasswordRecoverySession,
  type PasswordRecoveryAuthClient,
} from "../../src/lib/supabase/recovery";

function fakeClient(overrides: Partial<PasswordRecoveryAuthClient["auth"]> = {}) {
  const calls = {
    code: [] as string[],
    sessions: [] as Array<{ access_token: string; refresh_token: string }>,
  };

  const client: PasswordRecoveryAuthClient = {
    auth: {
      async exchangeCodeForSession(code) {
        calls.code.push(code);
        return { error: null };
      },
      async setSession(session) {
        calls.sessions.push(session);
        return { error: null };
      },
      ...overrides,
    },
  };

  return { client, calls };
}

test("accepts a PKCE recovery code", async () => {
  const { client, calls } = fakeClient();

  const result = await establishPasswordRecoverySession(client, {
    search: "?code=recovery-code",
    hash: "",
  });

  assert.equal(result, "ready");
  assert.deepEqual(calls.code, ["recovery-code"]);
  assert.deepEqual(calls.sessions, []);
});

test("accepts an implicit recovery session", async () => {
  const { client, calls } = fakeClient();

  const result = await establishPasswordRecoverySession(client, {
    search: "",
    hash: "#access_token=access&refresh_token=refresh&type=recovery",
  });

  assert.equal(result, "ready");
  assert.deepEqual(calls.sessions, [
    { access_token: "access", refresh_token: "refresh" },
  ]);
});

test("rejects missing or non-recovery credentials", async () => {
  const { client, calls } = fakeClient();

  const result = await establishPasswordRecoverySession(client, {
    search: "",
    hash: "#access_token=access&refresh_token=refresh&type=signup",
  });

  assert.equal(result, "invalid");
  assert.deepEqual(calls.code, []);
  assert.deepEqual(calls.sessions, []);
});

test("rejects Supabase exchange failures", async () => {
  const { client } = fakeClient({
    async exchangeCodeForSession() {
      return { error: new Error("expired") };
    },
  });

  const result = await establishPasswordRecoverySession(client, {
    search: "?code=expired-code",
    hash: "",
  });

  assert.equal(result, "invalid");
});
