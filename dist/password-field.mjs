import { t } from './i18n.mjs';

const controls = new WeakMap();
const eye = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const eyeOff = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18M10.6 5.1A13 13 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.1 4.1M6.2 6.2A19 19 0 0 0 2 12s3.5 7 10 7a13 13 0 0 0 5.2-1.1M10 10a3 3 0 0 0 4 4"/></svg>';

export function initPasswordFields(root = document) {
  const fields = [...root.querySelectorAll('input[data-password-field]')].map((input) => {
    if (controls.has(input)) return controls.get(input);
    const wrapper = input.parentElement;
    const button = input.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = 'password-toggle';
    button.setAttribute('aria-controls', input.id);
    function update() {
      const visible = input.type === 'text';
      const key = visible ? 'hidePassword' : 'showPassword';
      button.setAttribute('aria-pressed', String(visible));
      button.setAttribute('aria-label', t(key));
      button.setAttribute('title', t(key));
      button.dataset.i18nAriaLabel = key;
      button.dataset.i18nTitle = key;
      button.innerHTML = visible ? eyeOff : eye;
    }
    function mask() {
      input.type = 'password';
      update();
    }
    button.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
      update();
    });
    wrapper.append(button);
    mask();
    const control = { input, button, mask };
    controls.set(input, control);
    return control;
  });
  const maskAll = () => fields.forEach((field) => field.mask());
  root.addEventListener('submit', maskAll);
  root.addEventListener('close', maskAll);
  return {
    maskAll,
    setDisabled(disabled) {
      if (disabled) maskAll();
      fields.forEach((field) => { field.button.disabled = disabled; });
    },
  };
}
