import assert from 'node:assert/strict';
import test from 'node:test';

let moduleId = 0;
async function loadI18n(t, stored, storageError = false) {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalWindow = globalThis.window;
  const originalCustomEvent = globalThis.CustomEvent;
  const values = new Map(stored === undefined ? [] : [['daily-todo-language', stored]]);
  const events = [];
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => { if (storageError) throw new Error('Storage unavailable'); return values.get(key) ?? null; },
    setItem: (key, value) => { if (storageError) throw new Error('Storage unavailable'); values.set(key, value); },
  } });
  globalThis.window = { dispatchEvent: (event) => events.push(event) };
  globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail; } };
  t.after(() => {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalCustomEvent === undefined) delete globalThis.CustomEvent;
    else globalThis.CustomEvent = originalCustomEvent;
  });
  const module = await import('../dist/i18n.mjs?test=' + ++moduleId);
  return { ...module, values, events };
}

test('all four dictionaries have complete matching keys and placeholders', async (t) => {
  const { supportedLocales, messages } = await loadI18n(t);
  assert.deepEqual(supportedLocales, ['en', 'es', 'zh-CN', 'zh-TW']);
  const keys = Object.keys(messages.en).sort();
  assert.ok(keys.length > 150);
  const placeholders = (value) => [...new Set(value.match(/\{\w+\}/g) || [])].sort();
  for (const language of supportedLocales) {
    assert.deepEqual(Object.keys(messages[language]).sort(), keys, language);
    for (const key of keys) {
      assert.equal(typeof messages[language][key], 'string', language + ':' + key);
      assert.ok(messages[language][key].length, language + ':' + key);
      assert.deepEqual(placeholders(messages[language][key]), placeholders(messages.en[key]), language + ':' + key);
    }
  }
});

test('defaults to English and persists only supported language values', async (t) => {
  const { getLocale, setLocale, t: translate, values, events } = await loadI18n(t);
  assert.equal(getLocale(), 'en');
  assert.equal(translate('newTask'), 'New task');
  assert.equal(setLocale('es'), 'es');
  assert.equal(values.get('daily-todo-language'), 'es');
  assert.equal(translate('newTask'), 'Nueva tarea');
  assert.equal(events[0].type, 'localechange');
  assert.deepEqual(events[0].detail, { locale: 'es' });
  assert.equal(setLocale('unsupported'), 'en');
  assert.equal(values.get('daily-todo-language'), 'en');
  assert.equal(translate('unknown.key'), 'unknown.key');
});

test('loads a persisted supported locale', async (t) => {
  const { getLocale, t: translate } = await loadI18n(t, 'zh-TW');
  assert.equal(getLocale(), 'zh-TW');
  assert.equal(translate('saveTask'), '儲存待辦');
});

test('an invalid persisted locale falls back to English', async (t) => {
  const { getLocale } = await loadI18n(t, 'fr');
  assert.equal(getLocale(), 'en');
});

test('blocked browser storage still allows an in-memory language change', async (t) => {
  const { getLocale, setLocale } = await loadI18n(t, undefined, true);
  assert.equal(getLocale(), 'en');
  assert.equal(setLocale('zh-CN'), 'zh-CN');
  assert.equal(getLocale(), 'zh-CN');
});

test('interpolation preserves user text without HTML processing or recursive replacement', async (t) => {
  const { setLocale, t: translate } = await loadI18n(t);
  setLocale('es');
  assert.equal(translate('taskMoreLabel', { title: '<script>{title}</script>' }), 'Más acciones: <script>{title}</script>');
  assert.equal(translate('daySummary', { completed: 0, total: 3 }), 'Completadas 0 / 3');
});

test('date formatting follows each language and keeps the selected calendar date', async (t) => {
  const { setLocale, formatDate } = await loadI18n(t);
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  const expected = {
    en: /Friday, October 30, 2026/,
    es: /viernes, 30 de octubre de 2026/,
    'zh-CN': /2026年10月30日星期五/,
    'zh-TW': /2026年10月30日\s*星期五/,
  };
  for (const [language, pattern] of Object.entries(expected)) {
    setLocale(language);
    assert.match(formatDate('2026-10-30', options), pattern, language);
    assert.equal(formatDate('2026-10-30', { day: 'numeric', timeZone: 'Pacific/Kiritimati' }), language.startsWith('zh') ? '30日' : '30');
  }
});

test('static translations update text and accessible attributes without replacing an icon button', async (t) => {
  const { setLocale, applyTranslations } = await loadI18n(t);
  function element(attributes = {}) {
    return {
      textContent: '',
      hasAttribute: (key) => Object.hasOwn(attributes, key),
      getAttribute: (key) => attributes[key],
      setAttribute: (key, value) => { attributes[key] = value; },
      attributes,
    };
  }
  const label = element({ 'data-i18n': 'exportData' });
  const input = element({ 'data-i18n-placeholder': 'quickAddPlaceholder', 'data-i18n-aria-label': 'quickAddLabel', 'data-i18n-title': 'newTask' });
  const title = element({ 'data-i18n': 'documentTitle' });
  const button = { children: ['svg', label] };
  const document = { documentElement: { lang: 'en' }, querySelectorAll: () => [label, input, title] };
  setLocale('zh-TW');
  applyTranslations(document);
  assert.equal(label.textContent, '匯出資料');
  assert.equal(input.attributes.placeholder, '寫下一件想做的事…');
  assert.equal(input.attributes['aria-label'], '快速新增待辦');
  assert.equal(input.attributes.title, '新增待辦');
  assert.equal(title.textContent, '日常 · 待辦與日曆');
  assert.equal(document.documentElement.lang, 'zh-TW');
  assert.deepEqual(button.children, ['svg', label]);
});
