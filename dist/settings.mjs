import { applyTranslations, getLocale, setLocale, t } from './i18n.mjs';
import { THEMES, getTheme, setTheme, applyTheme } from './theme.mjs';

export function initSettings() {
  applyTheme();
  const dialog = document.createElement('dialog');
  dialog.id = 'settings-dialog';
  dialog.className = 'settings-dialog';
  dialog.setAttribute('aria-labelledby', 'settings-title');
  dialog.innerHTML = `
    <div class="dialog-heading"><h2 id="settings-title" data-i18n="settings">Settings</h2><button class="icon-button" id="close-settings" type="button" aria-label="Close settings" data-i18n-aria-label="closeSettings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div>
    <section class="preferences-section" aria-labelledby="appearance-heading">
      <h3 id="appearance-heading" data-i18n="appearance">Appearance</h3>
      <label class="field language-field"><span data-i18n="language">Language</span><select id="language-select"><option value="en">English</option><option value="es">Español</option><option value="zh-CN">简体中文</option><option value="zh-TW">繁體中文</option></select></label>
      <h4 data-i18n="freshThemes">Fresh &amp; minimal</h4><div class="theme-grid" id="fresh-themes"></div>
      <h4 data-i18n="glassTheme">Glass</h4><div class="theme-grid glass-theme-grid" id="glass-themes"></div>
      <h4 data-i18n="gradientThemes">Gradients</h4><div class="theme-grid" id="gradient-themes"></div>
    </section>
    <p class="field-hint" data-i18n="demoNoAccount">Demo mode has no account or password.</p>`;
  document.body.append(dialog);
  const select = dialog.querySelector('#language-select');
  const closeButton = dialog.querySelector('#close-settings');

  function renderThemes() {
    for (const id of ['fresh-themes', 'glass-themes', 'gradient-themes']) dialog.querySelector('#' + id).replaceChildren();
    THEMES.forEach((theme, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'theme-option';
      button.dataset.themeChoice = theme.id;
      button.setAttribute('aria-pressed', String(getTheme() === theme.id));
      const swatch = document.createElement('span');
      swatch.className = 'theme-swatch';
      swatch.style.setProperty('--theme-preview', theme.preview);
      swatch.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'theme-label';
      label.textContent = t(theme.nameKey);
      button.append(swatch, label);
      button.addEventListener('click', () => setTheme(theme.id));
      const group = index < 5 ? 'fresh-themes' : index === 5 ? 'glass-themes' : 'gradient-themes';
      dialog.querySelector('#' + group).append(button);
    });
  }
  function refresh() {
    applyTranslations(dialog);
    select.value = getLocale();
    renderThemes();
  }
  document.querySelector('#open-settings')?.addEventListener('click', () => {
    refresh();
    dialog.showModal();
  });
  closeButton.addEventListener('click', () => dialog.close());
  select.addEventListener('change', () => setLocale(select.value));
  window.addEventListener('localechange', refresh);
  window.addEventListener('themechange', () => {
    dialog.querySelectorAll('[data-theme-choice]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === getTheme())));
  });
  refresh();
  return dialog;
}
