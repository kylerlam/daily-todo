import assert from 'node:assert/strict';
import test from 'node:test';
import { initPasswordFields } from '../dist/password-field.mjs';
import { setLocale } from '../dist/i18n.mjs';

class Element {
  constructor() { this.listeners = new Map(); this.children = []; this.attributes = {}; this.dataset = {}; }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }
  emit(type, event = {}) { for (const callback of this.listeners.get(type) || []) callback(event); }
  dispatchEvent(event) { this.emit(event.type, event); }
  append(child) { this.children.push(child); }
  contains(child) { return this.children.includes(child); }
  setAttribute(name, value) { this.attributes[name] = value; }
}

function passwordForm(t) {
  const originalWindow = globalThis.window;
  globalThis.window = new Element();
  t.after(() => {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  });
  const document = new Element();
  document.createElement = (tag) => { assert.equal(tag, 'button'); return new Element(); };
  const input = new Element();
  input.id = 'new-password';
  input.type = 'password';
  input.value = 'unchanged secret';
  input.ownerDocument = document;
  const wrapper = new Element();
  input.parentElement = wrapper;
  wrapper.append(input);
  const form = new Element();
  form.ownerDocument = document;
  form.querySelectorAll = () => [input];
  const controller = initPasswordFields(form);
  return { input, wrapper, form, document, controller, button: wrapper.children[1], window: globalThis.window };
}

test('the eye is a keyboard-focusable non-submit toggle and preserves the password value', (t) => {
  const { input, button } = passwordForm(t);
  assert.equal(button.type, 'button');
  assert.equal(button.attributes['aria-controls'], 'new-password');
  assert.equal(button.attributes['aria-pressed'], 'false');
  button.emit('click');
  assert.equal(input.type, 'text');
  assert.equal(button.attributes['aria-pressed'], 'true');
  assert.equal(input.value, 'unchanged secret');
  button.emit('click');
  assert.equal(input.type, 'password');
  assert.equal(input.value, 'unchanged secret');
});

test('submitting or closing the form masks the value', (t) => {
  const { input, button, form } = passwordForm(t);
  for (const [target, event] of [[form, 'submit'], [form, 'close']]) {
    button.emit('click');
    target.emit(event);
    assert.equal(input.type, 'password', event);
    assert.equal(input.value, 'unchanged secret', event);
  }
});

test('saving masks the field and disables the eye without clearing the input', (t) => {
  const { input, button, controller } = passwordForm(t);
  button.emit('click');
  controller.setDisabled(true);
  assert.equal(input.type, 'password');
  assert.equal(button.disabled, true);
  controller.setDisabled(false);
  assert.equal(button.disabled, false);
  assert.equal(input.value, 'unchanged secret');
});

test('show and hide labels are localized for all four languages', (t) => {
  const { button, controller } = passwordForm(t);
  const labels = {
    en: ['Show password', 'Hide password'], es: ['Mostrar contraseña', 'Ocultar contraseña'],
    'zh-CN': ['显示密码', '隐藏密码'], 'zh-TW': ['顯示密碼', '隱藏密碼'],
  };
  for (const [locale, [show, hide]] of Object.entries(labels)) {
    setLocale(locale);
    controller.maskAll();
    assert.equal(button.attributes['aria-label'], show);
    button.emit('click');
    assert.equal(button.attributes['aria-label'], hide);
    assert.equal(button.attributes.title, hide);
  }
  setLocale('en');
});
