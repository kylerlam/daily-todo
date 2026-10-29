import assert from "node:assert/strict";
import test from "node:test";
import { downloadExport, saveExport } from "../dist/export-file.mjs";

function mockBrowser(t, picker, fetch) {
  const originalWindow = globalThis.window;
  globalThis.window = { showSaveFilePicker: picker };
  t.after(() => {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  });
  t.mock.method(globalThis, "fetch", fetch);
}

test("opens the picker before fetching and writes the downloaded blob before closing", async (t) => {
  const calls = [];
  const blob = new Blob(['"title": "中文任务"\n'], { type: "application/yaml" });
  let pickerOptions;
  mockBrowser(t, (options) => {
    calls.push("picker");
    pickerOptions = options;
    return Promise.resolve({ createWritable: async () => {
      calls.push("createWritable");
      return {
        write: async (value) => { calls.push("write"); assert.equal(value, blob); },
        close: async () => { calls.push("close"); },
        abort: async () => assert.fail("a successful save must not abort"),
      };
    } });
  }, async (url, options) => {
    calls.push("fetch");
    assert.equal(url, "/api/export?format=yml");
    assert.deepEqual(options, { cache: "no-store" });
    return { ok: true, blob: async () => { calls.push("blob"); return blob; } };
  });
  const result = saveExport({ filename: "todo-2026-10-30.yml", mime: "application/yaml; charset=utf-8", description: "Datos YAML" });
  assert.deepEqual(calls, ["picker"]);
  await result;
  assert.deepEqual(calls, ["picker", "fetch", "blob", "createWritable", "write", "close"]);
  assert.deepEqual(pickerOptions, {
    id: "daily-todo-export",
    suggestedName: "todo-2026-10-30.yml",
    types: [{ description: "Datos YAML", accept: { "application/yaml": [".yml"] } }],
  });
});

test("picker cancellation throws the original AbortError without fetching", async (t) => {
  const error = new DOMException("cancelled", "AbortError");
  mockBrowser(t, async () => { throw error; }, async () => assert.fail("cancel must not fetch"));
  await assert.rejects(saveExport(), (actual) => actual === error);
});

test("HTTP failure never opens a writable file and reports an English error", async (t) => {
  let pickerOptions;
  mockBrowser(t, async (options) => {
    pickerOptions = options;
    return { createWritable: async () => assert.fail("HTTP failure must not touch the file") };
  }, async (url) => {
    assert.equal(url, "/api/export?format=json");
    return { ok: false, blob: async () => assert.fail("must not read an HTTP error as an export") };
  });
  await assert.rejects(saveExport({ format: "json" }), /Export failed/);
  assert.equal(pickerOptions.suggestedName, "daily-todo.json");
  assert.deepEqual(pickerOptions.types[0].accept, { "application/json": [".json"] });
});

test("a write failure aborts and preserves the original error even if abort fails", async (t) => {
  const error = new Error("disk full");
  const calls = [];
  mockBrowser(t, async () => ({ createWritable: async () => ({
    write: async () => { calls.push("write"); throw error; },
    close: async () => assert.fail("a failed write must not close"),
    abort: async () => { calls.push("abort"); throw new Error("cleanup failed"); },
  }) }), async () => ({ ok: true, blob: async () => new Blob(["export"]) }));
  await assert.rejects(saveExport(), (actual) => actual === error);
  assert.deepEqual(calls, ["write", "abort"]);
});

test("a close failure also aborts without replacing its error", async (t) => {
  const error = new Error("close failed");
  const calls = [];
  mockBrowser(t, async () => ({ createWritable: async () => ({
    write: async () => { calls.push("write"); },
    close: async () => { calls.push("close"); throw error; },
    abort: async () => { calls.push("abort"); },
  }) }), async () => ({ ok: true, blob: async () => new Blob(["export"]) }));
  await assert.rejects(saveExport(), (actual) => actual === error);
  assert.deepEqual(calls, ["write", "close", "abort"]);
});

for (const [name, exportFile] of [["picker save", saveExport], ["browser download", downloadExport]]) {
  test(`${name} preserves an expired-session error without writing or downloading a file`, async (t) => {
    mockBrowser(t, async () => ({ createWritable: async () => assert.fail("401 must not open a file") }), async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Sign in to continue.", code: "AUTH_REQUIRED" }),
      blob: async () => assert.fail("401 must not be saved as an export"),
    }));
    t.mock.method(URL, "createObjectURL", () => assert.fail("401 must not create a download"));
    await assert.rejects(exportFile(), (error) => error.code === "AUTH_REQUIRED" && error.status === 401);
  });
}

test("a non-JSON unauthorized response still reports an expired session", async (t) => {
  mockBrowser(t, null, async () => ({ ok: false, status: 401, json: async () => { throw new SyntaxError("Not JSON"); } }));
  await assert.rejects(downloadExport(), (error) => error.code === "AUTH_REQUIRED" && error.status === 401);
});

test("browser download fetches a successful export before creating a download and releases its URL", async (t) => {
  const calls = [];
  const blob = new Blob(["history"], { type: "application/json" });
  mockBrowser(t, () => assert.fail("fallback must not open a picker"), async (url, options) => {
    calls.push("fetch");
    assert.equal(url, "/api/export?format=json");
    assert.deepEqual(options, { cache: "no-store" });
    return { ok: true, blob: async () => { calls.push("blob"); return blob; } };
  });
  const download = {
    click: () => { calls.push("click"); },
    remove: () => { calls.push("remove"); },
  };
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement: (tag) => { calls.push("element"); assert.equal(tag, "a"); return download; },
    body: { append: (element) => { calls.push("append"); assert.equal(element, download); } },
  };
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  });
  t.mock.method(URL, "createObjectURL", (value) => { calls.push("url"); assert.equal(value, blob); return "blob:test-export"; });
  t.mock.method(URL, "revokeObjectURL", (url) => { calls.push("revoke"); assert.equal(url, "blob:test-export"); });
  let cleanup;
  t.mock.method(globalThis, "setTimeout", (callback, delay) => { calls.push("timer"); cleanup = callback; assert.equal(delay, 1000); });
  await downloadExport({ format: "json", filename: "tdl-2026-10-30.json" });
  assert.deepEqual(calls, ["fetch", "blob", "url", "element", "append", "click", "remove", "timer"]);
  assert.equal(download.href, "blob:test-export");
  assert.equal(download.download, "tdl-2026-10-30.json");
  cleanup();
  assert.equal(calls.at(-1), "revoke");
});

test("browser download reports server failures without creating an error file", async (t) => {
  mockBrowser(t, null, async () => ({ ok: false, status: 500, json: async () => ({ code: "STORAGE_ERROR" }) }));
  t.mock.method(URL, "createObjectURL", () => assert.fail("HTTP failure must not create a download"));
  await assert.rejects(downloadExport(), (error) => error.code === "STORAGE_ERROR" && error.status === 500);
});
