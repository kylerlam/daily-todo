import { applyTranslations, t } from './i18n.mjs';
import { initSettings } from './settings.mjs';
import { applyTheme } from './theme.mjs';
import { authRequest, errorMessage, nextPage } from './auth.mjs';

applyTheme();
applyTranslations(document);
initSettings();
const form = document.querySelector('#login-form');
const button = document.querySelector('#sign-in');
const errorBox = document.querySelector('#login-error');
const notice = document.querySelector('#login-notice');
let submitting = false;

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
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitting) return;
  submitting = true;
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
    username.readOnly = password.readOnly = false;
    button.disabled = false;
    button.textContent = t('signIn');
  }
});
