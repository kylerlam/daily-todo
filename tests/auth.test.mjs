import test from "node:test";
import assert from "node:assert/strict";
import { authRequest, nextPage } from "../dist/auth.mjs";

const NEXT_KEY = "daily-todo-next";
function browserStorage(t) {
  const values = new Map();
  const globals = {
    location: { origin: "https://todo.example:9443" },
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
    },
  };
  for (const [key, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else delete globalThis[key];
    });
  }
  return values;
}

test("login returns to a same-origin path, query, and calendar hash once", (t) => {
  const stored = browserStorage(t);
  assert.equal(nextPage(), "/");
  for (const destination of ["/", "/#calendar/2026-10-31", "/index.html?view=calendar#tasks"]) {
    stored.set(NEXT_KEY, destination);
    assert.equal(nextPage(), destination);
    assert.equal(stored.has(NEXT_KEY), false);
    assert.equal(nextPage(), "/");
  }
});

test("login rejects outside hosts, protocol-relative paths, and backslash host changes", (t) => {
  const stored = browserStorage(t);
  for (const destination of [
    "https://evil.example/collect",
    "//evil.example/collect",
    "///evil.example/collect",
    String.raw`/\evil.example/collect`,
    String.raw`\evil.example/collect`,
    "javascript:alert(1)",
  ]) {
    stored.set(NEXT_KEY, destination);
    assert.equal(nextPage(), "/", destination);
    assert.equal(stored.has(NEXT_KEY), false);
  }
});

test("login does not redirect back into a login-page loop", (t) => {
  const stored = browserStorage(t);
  for (const destination of ["/login.html", "/login.html?updated=1#form", "/nested/login.html", "/tasks/../login.html"]) {
    stored.set(NEXT_KEY, destination);
    assert.equal(nextPage(), "/", destination);
    assert.equal(stored.has(NEXT_KEY), false);
  }
});

test("blocked session storage still permits a safe default return", (t) => {
  browserStorage(t);
  globalThis.sessionStorage.getItem = () => { throw new Error("Storage blocked"); };
  assert.equal(nextPage(), "/");
});

test("authenticated requests use same-origin credentials and return successful data", async (t) => {
  const user = { username: "admin" };
  t.mock.method(globalThis, "fetch", async (path, options) => {
    assert.equal(path, "/api/auth/login");
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.cache, "no-store");
    assert.equal(options.method, "POST");
    assert.deepEqual(options.headers, { "Content-Type": "application/json" });
    assert.equal(options.body, '{"username":"admin","password":"example-password"}');
    return { ok: true, json: async () => ({ user }) };
  });
  assert.deepEqual(await authRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: "example-password" }),
  }), { user });
});

test("HTTP auth failures preserve the server error code and status", async (t) => {
  const failures = [
    { status: 401, code: "AUTH_REQUIRED", error: "Sign in to continue." },
    { status: 403, code: "CSRF_REJECTED", error: "Request rejected." },
    { status: 429, code: "RATE_LIMITED", error: "Try again later." },
  ];
  t.mock.method(globalThis, "fetch", async () => {
    const failure = failures.shift();
    return { ok: false, status: failure.status, json: async () => failure };
  });
  for (const [status, code, message] of [
    [401, "AUTH_REQUIRED", "Sign in to continue."],
    [403, "CSRF_REJECTED", "Request rejected."],
    [429, "RATE_LIMITED", "Try again later."],
  ]) {
    await assert.rejects(authRequest("/api/account"), (error) =>
      error instanceof Error && error.status === status && error.code === code && error.message === message);
  }
});

test("network failures report a useful connection error without a false HTTP status", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Network unavailable"); });
  await assert.rejects(authRequest("/api/auth/status"), (error) =>
    /Cannot connect/.test(error.message) && error.status === undefined && error.code === undefined);
});
