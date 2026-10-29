import { applyTranslations, getLocale, setLocale, t } from './i18n.mjs';
import { THEMES, getTheme, setTheme, applyTheme } from './theme.mjs';
import { authRequest, errorMessage, redirectToLogin } from './auth.mjs';

export function initSettings(user = null) {
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
    <section class="account-section" aria-labelledby="account-heading" hidden>
      <div class="account-section-heading"><h3 id="account-heading" data-i18n="account">Account</h3><button class="button sign-out-button" type="button" id="sign-out" data-i18n="signOut">Sign out</button></div>
      <p class="field-hint" data-i18n="accountChangeHint">Changing your username or password signs out every device. Sign in again with your new credentials.</p>
      <form id="account-form">
        <label class="field"><span data-i18n="username">Username</span><input id="account-username" name="username" autocomplete="username" required minlength="2" maxlength="64"></label>
        <label class="field"><span data-i18n="currentPassword">Current password</span><input id="account-current-password" name="current_password" type="password" autocomplete="current-password" required maxlength="256"></label>
        <label class="field"><span data-i18n="newPassword">New password</span><input id="account-new-password" name="new_password" type="password" autocomplete="new-password" minlength="8" maxlength="256"></label>
        <p class="field-hint" data-i18n="newPasswordHint">At least 8 characters. Leave empty to keep your current password.</p>
        <p class="form-error" id="account-error" role="alert" hidden></p>
        <div class="dialog-actions"><button class="button primary" type="submit" id="save-account" data-i18n="saveAccount">Save account</button></div>
      </form>
    </section>`;
  document.body.append(dialog);
  const select = dialog.querySelector('#language-select');
  const errorBox = dialog.querySelector('#account-error');
  const saveButton = dialog.querySelector('#save-account');
  const closeButton = dialog.querySelector('#close-settings');
  let busy = false;

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
    errorBox.hidden = true;
    if (user) {
      dialog.querySelector('.account-section').hidden = false;
      dialog.querySelector('#account-username').value = user.username;
      dialog.querySelector('#account-current-password').value = '';
      dialog.querySelector('#account-new-password').value = '';
    }
    dialog.showModal();
  });
  closeButton.addEventListener('click', () => { if (!busy) dialog.close(); });
  dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
  select.addEventListener('change', () => setLocale(select.value));
  window.addEventListener('localechange', refresh);
  window.addEventListener('themechange', () => {
    dialog.querySelectorAll('[data-theme-choice]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === getTheme())));
  });
  function setBusy(value) {
    busy = value;
    closeButton.disabled = value;
    dialog.querySelector('#sign-out').disabled = value;
    saveButton.disabled = value;
    dialog.querySelectorAll('#account-form input').forEach((input) => { input.readOnly = value; });
    saveButton.textContent = t(value ? 'saving' : 'saveAccount');
  }
  dialog.querySelector('#sign-out').addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    try {
      await authRequest('/api/auth/logout', { method: 'POST', body: '{}' });
      redirectToLogin();
    } catch (error) {
      errorBox.textContent = errorMessage(error);
      errorBox.hidden = false;
      setBusy(false);
    }
  });
  dialog.querySelector('#account-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const body = {
      username: dialog.querySelector('#account-username').value.trim(),
      current_password: dialog.querySelector('#account-current-password').value,
    };
    const password = dialog.querySelector('#account-new-password').value;
    if (password) body.new_password = password;
    errorBox.hidden = true;
    setBusy(true);
    try {
      await authRequest('/api/account', { method: 'PATCH', body: JSON.stringify(body) });
      redirectToLogin(true);
    } catch (error) {
      if (error.code === 'AUTH_REQUIRED') { redirectToLogin(); return; }
      errorBox.textContent = errorMessage(error);
      errorBox.hidden = false;
      setBusy(false);
    }
  });
  refresh();
  return dialog;
}
