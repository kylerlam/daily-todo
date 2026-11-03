import { downloadExport, saveExport } from './export-file.mjs';
import { applyTranslations, formatDate, t } from './i18n.mjs';
import { requireLogin, redirectToLogin, errorMessage } from './auth.mjs';
import { initSettings } from './settings.mjs';
import { applyTheme } from './theme.mjs';
import { bindTaskReorder } from './task-reorder.mjs';
import { bindNotesChecklist, checklistPrefix } from './notes-checklist.mjs';

applyTheme();

const $ = (selector) => document.querySelector(selector);
const icons = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  list: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  export: '<path d="M12 16V3m-4 4 4-4 4 4M4 14v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"/>',
  left: '<path d="m14 7-5 5 5 5"/>',
  right: '<path d="m10 7 5 5-5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
};
function icon(name) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[name] + '</svg>';
}
document.querySelectorAll('[data-icon]').forEach((node) => node.replaceWith(svgElement(node.dataset.icon)));
function svgElement(name) {
  const template = document.createElement('template');
  template.innerHTML = icon(name);
  return template.content.firstElementChild;
}
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function localToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function dateValue(value) {
  return new Date(value + 'T12:00:00Z');
}
function dateText(value, options) {
  return formatDate(value, options);
}
function isoDate(date) {
  return date.toISOString().slice(0, 10);
}
function shiftMonth(month, delta) {
  const date = dateValue(month + '-01');
  date.setUTCMonth(date.getUTCMonth() + delta);
  return isoDate(date).slice(0, 7);
}
const state = { today: localToday(), selected: localToday(), month: localToday().slice(0, 7), view: 'calendar', current: null, day: null, days: [], busy: false };
let requestId = 0;
let editingTask = null;
let formSaving = false;
let deletingTask = null;
let toastTimer;

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, { ...options, headers: options.body ? { 'Content-Type': 'application/json' } : {}, cache: 'no-store' });
  } catch {
    throw new Error(t('networkError'));
  }
  const body = await response.json();
  if (!response.ok) {
    if (body.code === 'AUTH_REQUIRED') redirectToLogin();
    const key = 'errors.' + body.code;
    const message = t(key);
    const error = new Error(message === key ? t('saveFailed') : message);
    error.code = body.code;
    throw error;
  }
  return body;
}
function toast(message, error = false) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.toggle('error', error);
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, error ? 6000 : 2600);
}
function showError(message, retryAction = load) {
  const banner = $('#page-error');
  banner.replaceChildren(document.createTextNode(message));
  const retry = node('button', '', t('reconnect'));
  retry.addEventListener('click', retryAction);
  banner.append(retry);
  banner.hidden = false;
}
async function load() {
  const version = ++requestId;
  const date = state.selected, month = state.month;
  try {
    const [current, day, monthly] = await Promise.all([
      api('/api/tasks'), api('/api/day?date=' + date), api('/api/month?month=' + month),
    ]);
    if (version !== requestId) return;
    const previousToday = state.today;
    state.today = current.today;
    if (previousToday !== state.today && state.selected === previousToday) {
      state.selected = state.today;
      state.month = state.today.slice(0, 7);
      if (state.view === 'calendar') history.replaceState(null, '', '#calendar/' + state.selected);
      return load();
    }
    state.current = current;
    state.day = day;
    state.days = monthly.days;
    $('#page-error').hidden = true;
    render();
  } catch (error) {
    if (version === requestId) showError(error.message);
  }
}
function renderCalendar() {
  $('#month-label').textContent = dateText(state.month + '-01', { year: 'numeric', month: 'long' });
  $('#month-input').value = state.month;
  $('#previous-month').disabled = state.month === '1900-01';
  $('#next-month').disabled = state.month === '9998-12';
  const first = dateValue(state.month + '-01');
  const offset = (first.getUTCDay() + 6) % 7;
  const nextFirst = dateValue(shiftMonth(state.month, 1) + '-01');
  const length = Math.round((nextFirst - first) / 86400000);
  const count = Math.ceil((offset + length) / 7) * 7;
  const summaries = new Map(state.days.map((day) => [day.date, day]));
  const grid = $('#calendar-grid');
  grid.replaceChildren();
  for (let index = 0; index < count; index++) {
    const date = new Date(first);
    date.setUTCDate(1 - offset + index);
    const value = isoDate(date);
    const summary = summaries.get(value);
    const button = node('button', 'calendar-day');
    button.type = 'button';
    button.classList.toggle('outside', value.slice(0, 7) !== state.month);
    button.classList.toggle('selected', value === state.selected);
    button.classList.toggle('is-today', value === state.today);
    button.setAttribute('aria-pressed', String(value === state.selected));
    button.setAttribute('aria-label', t(summary?.total ? 'calendarDaySummary' : 'calendarDayEmpty', {
      date: dateText(value, { year: 'numeric', month: 'long', day: 'numeric' }), completed: summary?.completed, pending: summary?.pending,
    }));
    if (value === state.today) button.setAttribute('aria-current', 'date');
    button.append(node('span', 'day-number', date.getUTCDate()));
    const dots = node('span', 'day-indicators');
    dots.setAttribute('aria-hidden', 'true');
    if (value < state.today && summary?.pending) {
      dots.append(node('i', 'activity-dot overdue-dot'));
    } else {
      if (summary?.completed) dots.append(node('i', 'activity-dot done-dot'));
      if (summary?.pending) dots.append(node('i', 'activity-dot pending-dot'));
    }
    button.append(dots);
    button.addEventListener('click', () => selectDate(value));
    grid.append(button);
  }
}
function selectDate(date) {
  if (date.slice(0, 4) < '1900' || date.slice(0, 4) > '9998') return;
  state.selected = date;
  if (state.month !== date.slice(0, 7)) state.days = [];
  state.month = date.slice(0, 7);
  history.replaceState(null, '', '#calendar/' + date);
  state.day = null;
  renderCalendar();
  renderDay();
  load();
}
function taskSort(a, b) {
  return a.day.localeCompare(b.day) || Number(a.completed || a.discarded) - Number(b.completed || b.discarded) ||
    (a.position || Number.MAX_SAFE_INTEGER) - (b.position || Number.MAX_SAFE_INTEGER) || a.id - b.id;
}
function makeTaskRow(task) {
  const readOnly = task.discarded || (task.completed && task.day < state.today && task.completed_at?.slice(0, 10) !== state.today);
  const row = node('article', 'task-row');
  row.dataset.taskId = task.id;
  row.classList.toggle('completed', task.completed);
  row.classList.toggle('discarded', task.discarded);
  const check = node('button', 'task-check');
  check.type = 'button';
  check.setAttribute('role', 'checkbox');
  check.setAttribute('aria-checked', String(task.completed));
  check.setAttribute('aria-label', t(task.completed ? 'undoTaskLabel' : 'completeTaskLabel', { title: task.title }));
  check.disabled = readOnly || state.busy;
  if (task.completed) check.append(svgElement('check'));
  if (task.discarded) check.append(svgElement('close'));
  check.addEventListener('click', () => mutateTask(task.id, { completed: !task.completed, created_at: task.created_at }, task.completed ? 'taskRestored' : 'taskCompleted'));
  const copy = node('div', 'task-copy');
  copy.append(node('p', 'task-title', task.title));
  if (task.notes) copy.append(makeTaskNotes(task, readOnly));
  if (task.discarded) copy.append(node('span', 'task-meta', t('taskDiscardedMeta')));
  row.append(check, copy);
  const actions = node('div', 'row-actions');
  const menuButton = node('button', 'icon-button row-menu-button');
  menuButton.type = 'button';
  menuButton.append(svgElement('more'));
  menuButton.setAttribute('aria-label', t('taskMoreLabel', { title: task.title }));
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.disabled = state.busy;
  const menu = node('div', 'task-menu');
  menu.hidden = true;
  if (!readOnly) {
    const edit = node('button', '', t('editTask'));
    edit.type = 'button';
    edit.addEventListener('click', () => { menu.hidden = true; openForm(task); });
    menu.append(edit);
  }
  const remove = node('button', '', t('deleteTask'));
  remove.type = 'button';
  remove.addEventListener('click', () => {
    menu.hidden = true;
    deletingTask = task;
    $('#delete-task-name').textContent = task.title;
    $('#delete-dialog').showModal();
  });
  menu.append(remove);
  if (!task.completed && !task.discarded) {
    bindTaskReorder(row, menuButton, task, async (beforeId) => {
      const view = state.view;
      const hadFocus = document.activeElement === menuButton;
      await mutateTask(task.id, { before_id: beforeId, created_at: task.created_at }, 'taskReordered');
      if (hadFocus && view === state.view && document.activeElement === document.body) {
        $(`#${view}-view .task-row[data-task-id="${task.id}"] .row-menu-button`)?.focus({ preventScroll: true });
      }
    });
  }
  menuButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const wasHidden = menu.hidden;
    closeMenus();
    menu.hidden = !wasHidden;
    menuButton.setAttribute('aria-expanded', String(wasHidden));
    if (wasHidden) menu.firstElementChild.focus();
  });
  actions.append(menuButton, menu);
  row.append(actions);
  return row;
}
function makeTaskNotes(task, readOnly) {
  const lines = task.notes.split('\n');
  if (!lines.some((line) => checklistPrefix.test(line))) return node('p', 'task-notes', task.notes);
  const notes = node('div', 'task-notes');
  lines.forEach((line, index) => {
    if (!checklistPrefix.test(line)) {
      notes.append(node('div', 'task-note-line', line));
      return;
    }
    const label = node('label', 'task-note-check');
    const checkbox = node('input');
    const text = line.slice(2);
    checkbox.type = 'checkbox';
    checkbox.checked = line.startsWith('☑');
    checkbox.disabled = readOnly || state.busy;
    if (!text.trim()) checkbox.setAttribute('aria-label', t('checklistItem'));
    checkbox.addEventListener('change', () => {
      lines[index] = (checkbox.checked ? '☑' : '☐') + line.slice(1);
      mutateTask(task.id, {
        notes: lines.join('\n'), notes_revision: task.notes_revision, created_at: task.created_at,
      }, 'taskSaved');
    });
    label.append(checkbox, node('span', '', text));
    notes.append(label);
  });
  return notes;
}
function emptyState(container, past = false) {
  const empty = node('div', 'empty-state');
  empty.append(svgElement('list'));
  empty.append(node('h3', '', t(past ? 'emptyPastTitle' : 'emptyCurrentTitle')));
  empty.append(node('p', '', t(past ? 'emptyPastDescription' : 'emptyCurrentDescription')));
  const action = node('button', 'button', t(past ? 'backToToday' : 'newTask'));
  action.addEventListener('click', () => past ? selectDate(state.today) : openForm());
  empty.append(action);
  container.replaceChildren(empty);
}
function renderDay() {
  $('#day-title').textContent = dateText(state.selected, { month: 'long', day: 'numeric', weekday: 'long' });
  const list = $('#day-list');
  list.replaceChildren();
  if (!state.day || state.day.date !== state.selected) {
    $('#day-summary').textContent = t('dayLoading');
    $('#day-progress').style.width = '0%';
    $('.progress-track').setAttribute('aria-valuenow', '0');
    return;
  }
  const summary = state.day.summary;
  $('#day-summary').textContent = t('daySummary', { completed: summary.completed, total: summary.completed + summary.pending }) + (summary.total > summary.completed + summary.pending ? t('dayDiscardedSummary', { count: summary.total - summary.completed - summary.pending }) : '');
  const percent = summary.completed + summary.pending ? Math.round(summary.completed / (summary.completed + summary.pending) * 100) : 0;
  $('#day-progress').style.width = percent + '%';
  $('.progress-track').setAttribute('aria-valuenow', percent);
  const past = state.selected < state.today;
  $('#day-footer').textContent = t(past ? 'dayFooterPast' : state.selected > state.today ? 'dayFooterFuture' : 'dayFooterToday');
  if (!state.day.tasks.length) return emptyState(list, past);
  [...state.day.tasks].sort(taskSort).forEach((task) => list.append(makeTaskRow(task)));
}
function renderTasks() {
  if (!state.current) return;
  const tasks = state.current.tasks;
  $('#tasks-summary').textContent = t('tasksSummary', state.current.summary);
  const list = $('#all-task-list');
  list.replaceChildren();
  if (!tasks.length) return emptyState(list);
  const sortedTasks = [...tasks].sort((a, b) =>
    Number(b.day === state.today) - Number(a.day === state.today) || taskSort(a, b));
  let group;
  for (const task of sortedTasks) {
    if (group?.dataset.day !== task.day) {
      group = node('section', 'task-date-group');
      group.dataset.day = task.day;
      const label = task.day === state.today ? t('today') : dateText(task.day, { year: 'numeric', month: 'long', day: 'numeric' });
      const heading = node('h3', 'task-date-heading', label);
      heading.id = 'tasks-date-' + task.day;
      group.setAttribute('aria-labelledby', heading.id);
      group.append(heading);
      list.append(group);
    }
    group.append(makeTaskRow(task));
  }
}
function render() {
  const calendar = state.view === 'calendar';
  $('#calendar-view').hidden = !calendar;
  $('#tasks-view').hidden = calendar;
  $('#page-title').textContent = t(calendar ? 'calendarTitle' : 'tasksTitle');
  $('#page-subtitle').textContent = t(calendar ? 'calendarSubtitle' : 'tasksSubtitle');
  document.querySelectorAll('[data-view]').forEach((link) => {
    link.classList.toggle('active', link.dataset.view === state.view);
    if (link.dataset.view === state.view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const pending = state.current?.summary.pending || 0;
  $('#pending-count').hidden = !pending;
  $('#pending-count').textContent = pending;
  renderCalendar();
  renderDay();
  renderTasks();
}
function route() {
  const parts = location.hash.slice(1).split('/');
  state.view = parts[0] === 'tasks' ? 'tasks' : 'calendar';
  if (state.view === 'calendar' && /^\d{4}-\d{2}-\d{2}$/.test(parts[1] || '') && Number.isFinite(dateValue(parts[1]).valueOf()) && parts[1].slice(0, 4) >= '1900' && parts[1].slice(0, 4) <= '9998') {
    state.selected = parts[1];
    state.month = parts[1].slice(0, 7);
  }
  render();
  load();
}
async function mutateTask(id, changes, messageKey, method = 'PATCH') {
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    await api('/api/tasks/' + id, { method, body: JSON.stringify(changes) });
    await load();
    toast(t(messageKey));
  } catch (error) {
    if (error.code === 'TASK_CHANGED') await load();
    toast(error.message, true);
  } finally {
    state.busy = false;
    render();
  }
}
function openForm(task = null) {
  if (formSaving) return;
  editingTask = task;
  updateTaskDialog();
  $('#task-title').value = task?.title || '';
  $('#task-notes').value = task?.notes || '';
  $('#task-day').value = task?.day || (state.view === 'calendar' && state.selected > state.today ? state.selected : state.today);
  $('#task-day').min = task ? '1900-01-01' : state.today;
  $('#task-day').disabled = Boolean(task?.completed);
  $('#form-error').hidden = true;
  $('#save-task').disabled = false;
  $('#task-dialog').showModal();
  refreshNotesChecklist();
  $('#task-title').focus();
}
function updateTaskDialog() {
  $('#dialog-title').textContent = t(editingTask ? 'editTask' : 'newTask');
  $('#date-hint').textContent = t(editingTask?.completed ? 'completedDateHint' : editingTask ? 'editDateHint' : 'newDateHint');
}
function setFormSaving(saving) {
  formSaving = saving;
  for (const selector of ['#new-task', '#save-task', '#close-dialog', '#cancel-dialog']) $(selector).disabled = saving;
  $('#task-title').readOnly = saving;
  $('#task-notes').readOnly = saving;
  $('#insert-checklist-item').disabled = saving;
  $('#clear-notes').disabled = saving;
  $('#task-day').disabled = saving || Boolean(editingTask?.completed);
  refreshNotesChecklist();
}
function closeMenus() {
  document.querySelectorAll('.task-menu').forEach((menu) => { menu.hidden = true; });
  document.querySelectorAll('.row-menu-button').forEach((button) => button.setAttribute('aria-expanded', 'false'));
}
const notesEditor = $('#task-notes');
const refreshNotesChecklist = bindNotesChecklist(notesEditor, $('#notes-checklist'), () => t('checklistItem'));
function notesLineStart() {
  return notesEditor.value.slice(0, notesEditor.selectionStart).lastIndexOf('\n') + 1;
}
function replaceNotesRange(text, start, end) {
  if (notesEditor.value.length - (end - start) + text.length > notesEditor.maxLength) return false;
  notesEditor.setRangeText(text, start, end, 'end');
  refreshNotesChecklist();
  return true;
}
$('#insert-checklist-item').addEventListener('click', () => {
  const start = notesLineStart();
  const line = notesEditor.value.slice(start).split('\n', 1)[0];
  const caret = notesEditor.selectionStart;
  if (!checklistPrefix.test(line)) {
    const end = notesEditor.selectionEnd;
    const direction = notesEditor.selectionDirection;
    if (replaceNotesRange('☐ ', start, start)) notesEditor.setSelectionRange(caret + 2, end + 2, direction);
  } else if (!line.slice(2).trim()) {
    notesEditor.setSelectionRange(start + 2, start + 2);
  } else if (caret <= start + 2) {
    if (replaceNotesRange('☐ \n', start, start)) notesEditor.setSelectionRange(start + 2, start + 2);
  } else {
    replaceNotesRange('\n☐ ', caret, caret);
  }
  notesEditor.focus();
});
$('#clear-notes').addEventListener('click', () => {
  replaceNotesRange('', 0, notesEditor.value.length);
  notesEditor.focus();
});
notesEditor.addEventListener('beforeinput', (event) => {
  if (event.isComposing || !event.cancelable || !['insertLineBreak', 'insertParagraph'].includes(event.inputType)) return;
  const start = notesLineStart();
  const line = notesEditor.value.slice(start).split('\n', 1)[0];
  const end = start + line.length;
  if (!checklistPrefix.test(line) || notesEditor.selectionStart < start + 2 || notesEditor.selectionEnd > end) return;
  event.preventDefault();
  if (line.slice(2).trim()) replaceNotesRange('\n☐ ', notesEditor.selectionStart, notesEditor.selectionEnd);
  else replaceNotesRange('', start, end);
});
$('#task-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (formSaving) return;
  const targetTask = editingTask;
  const title = $('#task-title').value.trim();
  if (!title) { $('#task-title').focus(); return; }
  $('#form-error').hidden = true;
  const changes = { title, notes: $('#task-notes').value };
  if (targetTask) {
    changes.created_at = targetTask.created_at;
    if (changes.notes === targetTask.notes.replace(/\r\n?/g, '\n')) delete changes.notes;
    else changes.notes_revision = targetTask.notes_revision;
  }
  const day = $('#task-day').value;
  if (!targetTask || (!targetTask.completed && day !== targetTask.day)) changes.day = day;
  setFormSaving(true);
  try {
    const task = await api(targetTask ? '/api/tasks/' + targetTask.id : '/api/tasks', { method: targetTask ? 'PATCH' : 'POST', body: JSON.stringify(changes) });
    $('#task-dialog').close();
    if (state.view === 'calendar' && !targetTask) {
      state.selected = task.day > state.today ? task.day : state.today;
      state.month = state.selected.slice(0, 7);
      history.replaceState(null, '', '#calendar/' + state.selected);
    }
    await load();
    toast(t(targetTask ? 'taskSaved' : 'taskAdded'));
  } catch (error) {
    $('#form-error').textContent = error.message;
    $('#form-error').hidden = false;
  } finally { setFormSaving(false); }
});
$('#quick-add').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('#quick-title');
  const title = input.value.trim();
  if (!title || state.busy) return;
  state.busy = true;
  const button = $('#quick-add button');
  button.disabled = true;
  input.disabled = true;
  try {
    await api('/api/tasks', { method: 'POST', body: JSON.stringify({ title }) });
    input.value = '';
    await load();
  } catch (error) { toast(error.message, true); }
  finally { state.busy = false; input.disabled = false; button.disabled = false; render(); input.focus(); }
});
$('#new-task').addEventListener('click', () => openForm());
$('#close-dialog').addEventListener('click', () => $('#task-dialog').close());
$('#cancel-dialog').addEventListener('click', () => $('#task-dialog').close());
$('#task-dialog').addEventListener('cancel', (event) => { if (formSaving) event.preventDefault(); });
$('#keep-task').addEventListener('click', () => $('#delete-dialog').close());
$('#confirm-delete').addEventListener('click', () => {
  $('#delete-dialog').close();
  if (deletingTask) mutateTask(deletingTask.id, { created_at: deletingTask.created_at }, 'taskDeleted', 'DELETE');
});
$('#previous-month').addEventListener('click', () => selectDate(shiftMonth(state.month, -1) + '-01'));
$('#next-month').addEventListener('click', () => selectDate(shiftMonth(state.month, 1) + '-01'));
$('#month-input').addEventListener('change', (event) => {
  const month = event.target.value;
  if (/^\d{4}-\d{2}$/.test(month) && month >= '1900-01' && month <= '9998-12') selectDate(month + '-01');
});
$('#month-input').addEventListener('click', (event) => {
  if (typeof event.target.showPicker === 'function') event.target.showPicker();
});
$('#today').addEventListener('click', () => selectDate(state.today));
document.addEventListener('click', closeMenus);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenus(); });
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
setInterval(() => { if (!document.hidden && !state.busy && !$('#task-dialog').open && !$('#delete-dialog').open && !$('#export-dialog').open) load(); }, 60000);
let exportSaving = false;
function exportOptions() {
  const format = $('#export-format').value;
  return { format, filename: 'tdl-' + state.today + '.' + format, mime: format === 'json' ? 'application/json' : 'application/yaml', description: t('exportFileType', { format: format === 'json' ? 'JSON' : 'YAML' }) };
}
function canChooseExportLocation() {
  return window.isSecureContext && typeof window.showSaveFilePicker === 'function';
}
function updateExportDialog() {
  const options = exportOptions();
  $('#export-filename').textContent = t('exportFilename', { filename: options.filename });
  $('#save-export').textContent = canChooseExportLocation() ? t('chooseSaveLocation') : t('downloadFormat', { format: options.format.toUpperCase() });
  $('#export-hint').textContent = canChooseExportLocation()
    ? t('exportPickerHint')
    : t('exportDownloadHint');
}
function openExport() {
  if (exportSaving) return;
  $('#export-format').value = 'yml';
  $('#export-error').hidden = true;
  updateExportDialog();
  $('#export-dialog').showModal();
}
function setExportSaving(saving) {
  exportSaving = saving;
  for (const selector of ['#save-export', '#cancel-export', '#close-export', '#export-format']) $(selector).disabled = saving;
}
$('#save-export').addEventListener('click', async () => {
  if (exportSaving) return;
  const options = exportOptions();
  const chooseLocation = canChooseExportLocation();
  $('#export-error').hidden = true;
  setExportSaving(true);
  try {
    if (chooseLocation) await saveExport(options);
    else await downloadExport(options);
    toast(t(chooseLocation ? 'exportSaved' : 'exportDownloadStarted'));
    $('#export-dialog').close();
  } catch (error) {
    if (error.code === 'AUTH_REQUIRED' || error.status === 401) {
      redirectToLogin();
    } else if (error.name === 'AbortError') {
      toast(t('exportCancelled'));
    } else {
      $('#export-error').textContent = t('exportFailed');
      $('#export-error').hidden = false;
    }
  } finally {
    setExportSaving(false);
  }
});
$('#open-export').addEventListener('click', openExport);
$('#close-export').addEventListener('click', () => $('#export-dialog').close());
$('#cancel-export').addEventListener('click', () => $('#export-dialog').close());
$('#export-dialog').addEventListener('cancel', (event) => { if (exportSaving) event.preventDefault(); });
$('#export-format').addEventListener('change', updateExportDialog);
const mobileExport = node('button', 'mobile-export');
const mobileExportLabel = node('span', '', t('exportData'));
mobileExportLabel.dataset.i18n = 'exportData';
mobileExport.append(svgElement('export'), mobileExportLabel);
mobileExport.type = 'button';
mobileExport.addEventListener('click', openExport);
$('main').append(mobileExport);
window.addEventListener('localechange', () => {
  applyTranslations(document);
  render();
  if ($('#task-dialog').open) updateTaskDialog();
  if ($('#export-dialog').open) updateExportDialog();
});
window.addEventListener('dataimported', () => load());
applyTranslations(document);
try {
  const user = await requireLogin();
  if (user) {
    initSettings(user);
    route();
  }
} catch (error) {
  showError(errorMessage(error), () => location.reload());
}
