import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

let importId = 0;
async function environment(t, saved) {
  const storage = new Map(saved === undefined ? [] : [["daily-todo-theme", saved]]);
  const meta = { content: "", setAttribute(name, value) { this[name] = value; } };
  const document = {
    documentElement: { dataset: {} },
    querySelector: () => meta,
  };
  const window = new EventTarget();
  const globals = { localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  }, document, window };
  for (const [key, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else delete globalThis[key];
    });
  }
  const module = await import("../dist/theme.mjs?test=" + importId++);
  return { module, storage, meta, document, window };
}

test("the registry contains exactly the requested ten themes in order", async (t) => {
  const { module } = await environment(t);
  assert.deepEqual(module.THEMES.map(({ id }) => id), [
    "white", "mint", "sky", "lavender", "peach", "glass", "aurora", "sunset", "ocean", "twilight",
  ]);
  assert.equal(new Set(module.THEMES.map(({ id }) => id)).size, 10);
  for (const theme of module.THEMES) {
    assert.equal(theme.nameKey, "themes." + theme.id);
    assert.match(theme.preview, /^linear-gradient\(/);
  }
  const css = await readFile(new URL("../dist/themes.css", import.meta.url), "utf8");
  const definedThemes = new Set([...css.matchAll(/data-theme="([^"]+)"/g)].map((match) => match[1]));
  assert.deepEqual(definedThemes, new Set(module.THEMES.map(({ id }) => id)));
});

test("a fresh page defaults to white and invalid stored values fall back safely", async (t) => {
  const { module, storage } = await environment(t);
  assert.equal(module.getTheme(), "white");
  for (const saved of ["", "not-a-theme", "{broken", "../../glass"]) {
    storage.set("daily-todo-theme", saved);
    assert.equal(module.getTheme(), "white");
  }
});

test("a persisted theme applies to the document and browser theme color", async (t) => {
  const { module, document, meta } = await environment(t, "glass");
  assert.equal(module.applyTheme(), "glass");
  assert.equal(document.documentElement.dataset.theme, "glass");
  assert.equal(meta.content, "#dcecf4");
});

test("changing themes persists, updates the page, and emits the selected theme", async (t) => {
  const { module, storage, document, window, meta } = await environment(t);
  const changes = [];
  window.addEventListener("themechange", (event) => changes.push(event.detail.theme));
  assert.equal(module.setTheme("ocean"), "ocean");
  assert.equal(module.getTheme(), "ocean");
  assert.equal(storage.get("daily-todo-theme"), "ocean");
  assert.equal(document.documentElement.dataset.theme, "ocean");
  assert.equal(meta.content, "#d5e9ee");
  assert.deepEqual(changes, ["ocean"]);
  assert.equal(module.setTheme("unsupported"), "white");
  assert.equal(storage.get("daily-todo-theme"), "white");
  assert.deepEqual(changes, ["ocean", "white"]);
});

test("blocked browser storage does not prevent using a theme in the current page", async (t) => {
  const { module, document } = await environment(t);
  globalThis.localStorage = {
    getItem() { throw new Error("Storage is unavailable"); },
    setItem() { throw new Error("Storage is unavailable"); },
  };
  assert.equal(module.getTheme(), "white");
  assert.equal(module.setTheme("mint"), "mint");
  assert.equal(module.getTheme(), "mint");
  assert.equal(document.documentElement.dataset.theme, "mint");
});
