import { applyTranslations, t } from './i18n.mjs';
import { initSettings } from './settings.mjs';
import { applyTheme } from './theme.mjs';
import { authRequest, errorMessage, nextPage } from './auth.mjs';
import { initPasswordFields } from './password-field.mjs';

applyTheme();
applyTranslations(document);
initSettings();
const form = document.querySelector('#login-form');
const button = document.querySelector('#sign-in');
const errorBox = document.querySelector('#login-error');
const notice = document.querySelector('#login-notice');
const passwordFields = initPasswordFields(form);
const credentials = document.querySelector('.initial-credentials');
const defaultUsername = document.querySelector('#default-username');
const defaultPassword = document.querySelector('#default-password');
let submitting = false;

async function loadDefaultCredentials() {
  credentials.hidden = true;
  if (!defaultUsername || !defaultPassword) return;
  defaultUsername.textContent = '';
  defaultPassword.textContent = '';
  try {
    const status = await authRequest('/api/auth/status');
    if (status.show_default_credentials === true) {
      defaultUsername.textContent = 'admin';
      defaultPassword.textContent = 'admin123';
      credentials.hidden = false;
    }
  } catch { /* Default credentials stay hidden when account status is unavailable. */ }
}

function refresh() {
  applyTranslations(document);
  button.textContent = t(submitting ? 'signingIn' : 'signIn');
  if (new URLSearchParams(location.search).get('updated') === '1') {
    notice.textContent = t('accountUpdated');
    notice.hidden = false;
  }
}
window.addEventListener('localechange', refresh);
refresh();
loadDefaultCredentials();
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitting) return;
  submitting = true;
  passwordFields.setDisabled(true);
  button.disabled = true;
  button.textContent = t('signingIn');
  errorBox.hidden = true;
  const username = document.querySelector('#login-username');
  const password = document.querySelector('#login-password');
  const body = JSON.stringify({ username: username.value.trim(), password: password.value });
  username.readOnly = password.readOnly = true;
  try {
    await authRequest('/api/auth/login', { method: 'POST', body });
    password.value = '';
    location.replace(nextPage());
  } catch (error) {
    errorBox.textContent = errorMessage(error);
    errorBox.hidden = false;
    password.value = '';
    password.focus();
  } finally {
    submitting = false;
    passwordFields.setDisabled(false);
    username.readOnly = password.readOnly = false;
    button.disabled = false;
    button.textContent = t('signIn');
  }
});
