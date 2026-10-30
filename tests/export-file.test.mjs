import assert from "node:assert/strict";
import test from "node:test";
import { downloadExport, saveExport } from "../dist/export-file.mjs";

function mockBrowser(t, picker) {
  const originalWindow = globalThis.window;
  globalThis.window = { showSaveFilePicker: picker };
  t.after(() => {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  });
  t.mock.method(globalThis, "fetch", () => assert.fail("demo exports must not use the network"));
}

test("opens the picker before reading local data and writes its blob before closing", async (t) => {
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
  });
  const result = saveExport({
    getBlob: async () => { calls.push("blob"); return blob; },
    filename: "todo-2026-10-30.yml", mime: "application/yaml; charset=utf-8", description: "Datos YAML",
  });
  assert.deepEqual(calls, ["picker"]);
  await result;
  assert.deepEqual(calls, ["picker", "blob", "createWritable", "write", "close"]);
  assert.deepEqual(pickerOptions, {
    id: "daily-todo-export",
    suggestedName: "todo-2026-10-30.yml",
    types: [{ description: "Datos YAML", accept: { "application/yaml": [".yml"] } }],
  });
});

test("picker cancellation throws the original AbortError without reading local data", async (t) => {
  const error = new DOMException("cancelled", "AbortError");
  mockBrowser(t, async () => { throw error; });
  await assert.rejects(saveExport({ getBlob: () => assert.fail("cancel must not read data") }), (actual) => actual === error);
});

for (const [name, exportFile] of [["picker save", saveExport], ["browser download", downloadExport]]) {
  test(`${name} preserves local storage failures without writing or downloading a file`, async (t) => {
    const error = new Error("local storage unavailable");
    error.code = "DEMO_STORAGE_ERROR";
    mockBrowser(t, async () => ({ createWritable: async () => assert.fail("read failure must not open a file") }));
    t.mock.method(URL, "createObjectURL", () => assert.fail("read failure must not create a download"));
    await assert.rejects(exportFile({ getBlob: async () => { throw error; } }), (actual) => actual === error);
  });
}

test("a write failure aborts and preserves the original error even if abort fails", async (t) => {
  const error = new Error("disk full");
  const calls = [];
  mockBrowser(t, async () => ({ createWritable: async () => ({
    write: async () => { calls.push("write"); throw error; },
    close: async () => assert.fail("a failed write must not close"),
    abort: async () => { calls.push("abort"); throw new Error("cleanup failed"); },
  }) }));
  await assert.rejects(saveExport({ getBlob: async () => new Blob(["export"]) }), (actual) => actual === error);
  assert.deepEqual(calls, ["write", "abort"]);
});

test("a close failure also aborts without replacing its error", async (t) => {
  const error = new Error("close failed");
  const calls = [];
  mockBrowser(t, async () => ({ createWritable: async () => ({
    write: async () => { calls.push("write"); },
    close: async () => { calls.push("close"); throw error; },
    abort: async () => { calls.push("abort"); },
  }) }));
  await assert.rejects(saveExport({ getBlob: async () => new Blob(["export"]) }), (actual) => actual === error);
  assert.deepEqual(calls, ["write", "close", "abort"]);
});

test("browser download reads local data before downloading and releases its URL", async (t) => {
  const calls = [];
  const blob = new Blob(["history"], { type: "application/json" });
  mockBrowser(t, () => assert.fail("fallback must not open a picker"));
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
  await downloadExport({
    getBlob: async () => { calls.push("blob"); return blob; },
    format: "json", filename: "tdl-2026-10-30.json",
  });
  assert.deepEqual(calls, ["blob", "url", "element", "append", "click", "remove", "timer"]);
  assert.equal(download.href, "blob:test-export");
  assert.equal(download.download, "tdl-2026-10-30.json");
  cleanup();
  assert.equal(calls.at(-1), "revoke");
});
