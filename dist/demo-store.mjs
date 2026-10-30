export const DEMO_STORAGE_KEY = 'daily-todo-demo-v1';

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('INVALID_DATE_FORMAT');
  const parsed = new Date(value + 'T12:00:00Z');
  if (value < '0001-01-01' || !Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) fail('INVALID_DATE');
  return value;
}

function fields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_BODY');
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail('UNKNOWN_FIELDS');
  for (const [key, limit] of [['title', 300], ['notes', 5000]]) {
    if (!Object.hasOwn(value, key)) continue;
    const text = value[key];
    if (typeof text !== 'string' || [...text].length > limit || (key === 'title' && !text.trim()) ||
      [...text].some((character) => character.codePointAt(0) >= 0xd800 && character.codePointAt(0) <= 0xdfff)) fail('INVALID_' + key.toUpperCase());
  }
  for (const key of ['completed', 'discarded']) {
    if (Object.hasOwn(value, key) && typeof value[key] !== 'boolean') fail('INVALID_BOOLEAN');
  }
}

function timestamp(value) {
  return new Date(new Date(value).valueOf() + 8 * 60 * 60 * 1000).toISOString().replace('Z', '+08:00');
}

function validateStored(data) {
  const exact = (value, names) => {
    fields(value, names);
    if (Object.keys(value).length !== names.length) fail('DEMO_STORAGE_INVALID');
  };
  const identifier = (value) => { if (!Number.isSafeInteger(value) || value < 1) fail('DEMO_STORAGE_INVALID'); };
  const time = (value) => { if (typeof value !== 'string' || timestamp(value) !== value) fail('DEMO_STORAGE_INVALID'); };
  exact(data, ['version', 'tasks', 'events']);
  if (data.version !== 1 || !Array.isArray(data.tasks) || !Array.isArray(data.events)) fail('DEMO_STORAGE_INVALID');
  const tasks = new Map();
  const latest = new Map();
  let taskId = 0, eventId = 0;
  for (const task of data.tasks) {
    exact(task, ['id', 'title', 'notes', 'created_at', 'day']);
    identifier(task.id);
    if (task.id <= taskId) fail('DEMO_STORAGE_INVALID');
    taskId = task.id;
    time(task.created_at);
    validDate(task.day);
    tasks.set(task.id, task);
  }
  for (const event of data.events) {
    exact(event, ['id', 'task_id', 'kind', 'at', 'effective_date', 'state_at', 'title', 'notes']);
    identifier(event.id);
    identifier(event.task_id);
    const task = tasks.get(event.task_id);
    if (event.id <= eventId || !task || !['todo', 'complete', 'discard'].includes(event.kind)) fail('DEMO_STORAGE_INVALID');
    eventId = event.id;
    time(event.at);
    time(event.state_at);
    validDate(event.effective_date);
    if (event.effective_date !== event.at.slice(0, 10) || event.state_at > event.at ||
      (event.kind === 'complete' && task.day > event.effective_date)) fail('DEMO_STORAGE_INVALID');
    const previous = latest.get(event.task_id);
    if (previous) {
      if (event.at < previous.at || event.state_at !== (event.kind === previous.kind ? previous.state_at : event.at)) fail('DEMO_STORAGE_INVALID');
    } else if (event.kind !== 'todo' || event.at !== task.created_at || event.state_at !== event.at) fail('DEMO_STORAGE_INVALID');
    latest.set(event.task_id, event);
  }
  for (const task of data.tasks) {
    const event = latest.get(task.id);
    if (!event || event.title !== task.title || event.notes !== task.notes) fail('DEMO_STORAGE_INVALID');
  }
  return data;
}

function taskView(task, event) {
  return { id: task.id, title: event.title, notes: event.notes, created_at: task.created_at, day: task.day,
    completed: event.kind === 'complete', completed_at: event.kind === 'complete' ? event.state_at : null, discarded: event.kind === 'discard' };
}

function envelope(date, today, tasks) {
  return { date, today, tasks, summary: { total: tasks.length,
    completed: tasks.filter((task) => task.completed).length,
    pending: tasks.filter((task) => !task.completed && !task.discarded).length } };
}

function dayPayload(data, selected, today) {
  const latest = new Map();
  for (const event of data.events) if (event.effective_date <= selected) latest.set(event.task_id, event);
  const tasks = data.tasks.filter((task) => {
    const event = latest.get(task.id);
    return task.day <= selected && event && (event.kind === 'todo' || event.state_at.slice(0, 10) === selected);
  }).map((task) => taskView(task, latest.get(task.id)));
  return envelope(selected, today, tasks);
}

function appendEvent(data, task, kind, at, stateAt = at) {
  data.events.push({ id: (data.events.at(-1)?.id || 0) + 1, task_id: task.id, kind, at,
    effective_date: at.slice(0, 10), state_at: stateAt, title: task.title, notes: task.notes });
}

function examples(now) {
  const today = now.slice(0, 10);
  const offset = (days) => new Date(new Date(today + 'T12:00:00Z').valueOf() + days * 86400000).toISOString().slice(0, 10);
  const data = { version: 1, tasks: [], events: [] };
  for (const [title, notes, day, at, completed] of [
    ['Plan a weekend walk', 'A fictional task carried over from an earlier day.', offset(-2), offset(-2) + 'T09:00:00.000+08:00', false],
    ['Read a chapter', 'An example completion in yesterday’s history.', offset(-1), offset(-1) + 'T09:00:00.000+08:00', true],
    ['Water the plants', 'An example task completed today.', today, now, true],
    ['Try a new recipe', 'A fictional task scheduled for tomorrow.', offset(1), now, false],
  ]) {
    const task = { id: data.tasks.length + 1, title, notes, created_at: at, day };
    data.tasks.push(task);
    appendEvent(data, task, 'todo', at);
    if (completed) appendEvent(data, task, 'complete', at);
  }
  return data;
}

export function createDemoStore({ storage, clock = () => new Date() } = {}) {
  const now = () => timestamp(clock());
  function access(action) {
    try { return action(storage === undefined ? globalThis.localStorage : storage); }
    catch { fail('DEMO_STORAGE_ERROR'); }
  }
  function save(data) {
    access((target) => target.setItem(DEMO_STORAGE_KEY, JSON.stringify(data)));
  }
  function read() {
    const raw = access((target) => target.getItem(DEMO_STORAGE_KEY));
    if (raw === null) {
      const data = examples(now());
      save(data);
      return data;
    }
    try { return validateStored(JSON.parse(raw)); }
    catch { fail('DEMO_STORAGE_INVALID'); }
  }
  function current() {
    const data = read(), today = now().slice(0, 10);
    const latest = new Map(data.events.map((event) => [event.task_id, event]));
    const tasks = data.tasks.filter((task) => {
      const event = latest.get(task.id);
      return event.kind === 'todo' || (event.kind === 'complete' && event.state_at.slice(0, 10) === today);
    }).map((task) => taskView(task, latest.get(task.id)));
    return envelope(today, today, tasks);
  }
  return {
    current,
    day(selected) { return dayPayload(read(), validDate(selected), now().slice(0, 10)); },
    month(month) {
      if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) fail('INVALID_MONTH_FORMAT');
      validDate(month + '-01');
      const data = read(), today = now().slice(0, 10), days = [];
      const length = new Date(new Date(month + '-01T12:00:00Z').valueOf() + 31 * 86400000);
      length.setUTCDate(0);
      for (let number = 1; number <= length.getUTCDate(); number++) {
        const date = month + '-' + String(number).padStart(2, '0');
        days.push({ date, ...dayPayload(data, date, today).summary });
      }
      return { month, days };
    },
    create(data) {
      fields(data, ['title', 'notes', 'day']);
      if (!Object.hasOwn(data, 'title')) fail('MISSING_TITLE');
      const at = now(), day = validDate(Object.hasOwn(data, 'day') ? data.day : at.slice(0, 10));
      const saved = read();
      const task = { id: (saved.tasks.at(-1)?.id || 0) + 1, title: data.title.trim(), notes: data.notes ?? '', created_at: at, day };
      saved.tasks.push(task);
      appendEvent(saved, task, 'todo', at);
      save(saved);
      return taskView(task, saved.events.at(-1));
    },
    patch(id, changes) {
      fields(changes, ['title', 'notes', 'completed', 'discarded']);
      if (!Object.keys(changes).length) fail('EMPTY_UPDATE');
      if (Object.hasOwn(changes, 'completed') && Object.hasOwn(changes, 'discarded')) fail('CONFLICTING_STATUS');
      const data = read(), task = data.tasks.find((item) => item.id === id);
      if (!task) fail('NOT_FOUND');
      const previous = data.events.findLast((event) => event.task_id === id), at = now();
      const title = (changes.title ?? task.title).trim(), notes = changes.notes ?? task.notes;
      let kind = previous.kind;
      if (Object.hasOwn(changes, 'completed')) kind = changes.completed ? 'complete' : 'todo';
      if (Object.hasOwn(changes, 'discarded')) kind = changes.discarded ? 'discard' : 'todo';
      if (kind === 'complete' && task.day > at.slice(0, 10)) fail('FUTURE_COMPLETION');
      if (title === task.title && notes === task.notes && kind === previous.kind) return taskView(task, previous);
      if (at < previous.at) fail('DEMO_CLOCK_ERROR');
      task.title = title;
      task.notes = notes;
      appendEvent(data, task, kind, at, kind === previous.kind ? previous.state_at : at);
      save(data);
      return taskView(task, data.events.at(-1));
    },
    exportData() {
      const data = read();
      return { format: 'tdl-export', version: 1, timezone: 'Asia/Hong_Kong', exported_at: now(), tasks: data.tasks, events: data.events };
    },
    reset() { save(examples(now())); return current(); },
  };
}
