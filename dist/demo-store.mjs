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
  exact(data, ['version', 'sample_date', 'tasks', 'events']);
  if (data.version !== 2 || !Array.isArray(data.tasks) || !Array.isArray(data.events)) fail('DEMO_STORAGE_INVALID');
  validDate(data.sample_date);
  const tasks = new Map();
  const latest = new Map();
  let taskId = 0, eventId = 0;
  for (const task of data.tasks) {
    exact(task, ['id', 'title', 'notes', 'created_at', 'day', 'position']);
    identifier(task.id);
    if (task.id <= taskId) fail('DEMO_STORAGE_INVALID');
    taskId = task.id;
    time(task.created_at);
    validDate(task.day);
    if (task.position !== 0) identifier(task.position);
    tasks.set(task.id, task);
  }
  for (const event of data.events) {
    const keys = ['id', 'task_id', 'kind', 'at', 'effective_date', 'state_at', 'title', 'notes'];
    const moved = Object.hasOwn(event, 'previous_day');
    if (moved) keys.push('previous_day');
    exact(event, keys);
    identifier(event.id);
    identifier(event.task_id);
    const task = tasks.get(event.task_id);
    if (event.id <= eventId || !task || !['todo', 'complete', 'discard'].includes(event.kind)) fail('DEMO_STORAGE_INVALID');
    eventId = event.id;
    time(event.at);
    time(event.state_at);
    validDate(event.effective_date);
    if (event.effective_date !== event.at.slice(0, 10) || event.state_at > event.at) fail('DEMO_STORAGE_INVALID');
    const previous = latest.get(event.task_id);
    if (moved) {
      if (previous?.kind !== 'todo') fail('DEMO_STORAGE_INVALID');
      validDate(event.previous_day);
    }
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
    position: task.position, notes_revision: task.notes,
    completed: event.kind === 'complete', completed_at: event.kind === 'complete' ? event.state_at : null, discarded: event.kind === 'discard' };
}

function tasksByDay(data) {
  const latest = new Map(data.events.map((event) => [event.task_id, event]));
  return data.tasks.map((task) => taskView(task, latest.get(task.id))).sort((a, b) =>
    a.day.localeCompare(b.day) || Number(a.position === 0) - Number(b.position === 0) || a.position - b.position || a.id - b.id);
}

function envelope(date, today, tasks) {
  return { date, today, tasks, summary: { total: tasks.length,
    completed: tasks.filter((task) => task.completed).length,
    pending: tasks.filter((task) => !task.completed && !task.discarded).length } };
}

function dayPayload(tasks, selected, today) {
  return envelope(selected, today, tasks.filter((task) => task.day === selected));
}

function appendEvent(data, task, kind, at, stateAt = at, previousDay) {
  const event = { id: (data.events.at(-1)?.id || 0) + 1, task_id: task.id, kind, at,
    effective_date: at.slice(0, 10), state_at: stateAt, title: task.title, notes: task.notes };
  if (previousDay) event.previous_day = previousDay;
  data.events.push(event);
}

function examples(now) {
  const today = now.slice(0, 10);
  const offset = (days) => new Date(new Date(today + 'T12:00:00Z').valueOf() + days * 86400000).toISOString().slice(0, 10);
  const data = { version: 2, sample_date: today, tasks: [], events: [] };
  for (const [title, notes, day, completed] of [
    ['Plan a weekend walk', 'An unfinished task from yesterday.', offset(-1), false],
    ['Read a chapter', 'An example task completed today.', today, true],
    ['Make a shopping list', '☑ Check the pantry\n☐ Add fruit to the list', today, false],
    ['Try a new recipe', 'A fictional task scheduled for tomorrow.', offset(1), false],
  ]) {
    const task = { id: data.tasks.length + 1, title, notes, created_at: now, day, position: 0 };
    data.tasks.push(task);
    appendEvent(data, task, 'todo', now);
    if (completed) appendEvent(data, task, 'complete', now);
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
  function read(at = now()) {
    const raw = access((target) => target.getItem(DEMO_STORAGE_KEY));
    if (raw !== null) {
      try {
        const data = validateStored(JSON.parse(raw));
        if (data.sample_date >= at.slice(0, 10)) return data;
      } catch { /* A previous or invalid demo format starts from fresh samples. */ }
    }
    const data = examples(at);
    save(data);
    return data;
  }
  function current() {
    const at = now(), today = at.slice(0, 10);
    const tasks = tasksByDay(read(at)).filter((task) =>
      !task.discarded && (!task.completed || task.completed_at.slice(0, 10) === today));
    return envelope(today, today, tasks);
  }
  return {
    current,
    day(selected) {
      const at = now();
      return dayPayload(tasksByDay(read(at)), validDate(selected), at.slice(0, 10));
    },
    month(month) {
      if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) fail('INVALID_MONTH_FORMAT');
      validDate(month + '-01');
      const at = now(), today = at.slice(0, 10), tasks = tasksByDay(read(at)), days = [];
      const length = new Date(new Date(month + '-01T12:00:00Z').valueOf() + 31 * 86400000);
      length.setUTCDate(0);
      for (let number = 1; number <= length.getUTCDate(); number++) {
        const date = month + '-' + String(number).padStart(2, '0');
        days.push({ date, ...dayPayload(tasks, date, today).summary });
      }
      return { month, days };
    },
    create(data) {
      fields(data, ['title', 'notes', 'day']);
      if (!Object.hasOwn(data, 'title')) fail('MISSING_TITLE');
      const at = now(), day = validDate(Object.hasOwn(data, 'day') ? data.day : at.slice(0, 10));
      const saved = read(at);
      const task = { id: (saved.tasks.at(-1)?.id || 0) + 1, title: data.title.trim(), notes: data.notes ?? '', created_at: at, day, position: 0 };
      saved.tasks.push(task);
      appendEvent(saved, task, 'todo', at);
      save(saved);
      return taskView(task, saved.events.at(-1));
    },
    patch(id, changes) {
      fields(changes, ['title', 'notes', 'completed', 'discarded', 'day', 'created_at', 'notes_revision', 'before_id']);
      if (!Object.keys(changes).some((key) => key !== 'created_at' && key !== 'notes_revision')) fail('EMPTY_UPDATE');
      if (Object.hasOwn(changes, 'completed') && Object.hasOwn(changes, 'discarded')) fail('CONFLICTING_STATUS');
      const at = now(), data = read(at), task = data.tasks.find((item) => item.id === id);
      if (!task) fail('NOT_FOUND');
      if ((Object.hasOwn(changes, 'created_at') && changes.created_at !== task.created_at) ||
        (Object.hasOwn(changes, 'notes_revision') && changes.notes_revision !== task.notes)) fail('TASK_CHANGED');
      const previous = data.events.findLast((event) => event.task_id === id);
      if (Object.hasOwn(changes, 'before_id')) {
        const before = changes.before_id;
        const order = tasksByDay(data).filter((item) => item.day === task.day && !item.completed && !item.discarded).map((item) => item.id);
        if (Object.keys(changes).some((key) => key !== 'before_id' && key !== 'created_at') ||
          !order.includes(id) || (before !== null && !order.includes(before))) fail('INVALID_TASK_ORDER');
        if (id !== before) {
          order.splice(order.indexOf(id), 1);
          order.splice(before === null ? order.length : order.indexOf(before), 0, id);
          const positions = new Map(order.map((item, index) => [item, index + 1]));
          for (const item of data.tasks) if (positions.has(item.id)) item.position = positions.get(item.id);
          save(data);
        }
        return taskView(task, previous);
      }
      const title = (changes.title ?? task.title).trim(), notes = changes.notes ?? task.notes;
      const day = Object.hasOwn(changes, 'day') ? validDate(changes.day) : task.day;
      const moved = day !== task.day;
      let kind = previous.kind;
      if (moved && kind !== 'todo') fail('TASK_DATE_LOCKED');
      if (Object.hasOwn(changes, 'completed')) kind = changes.completed ? 'complete' : 'todo';
      if (Object.hasOwn(changes, 'discarded')) kind = changes.discarded ? 'discard' : 'todo';
      if (!moved && title === task.title && notes === task.notes && kind === previous.kind) return taskView(task, previous);
      if (at < previous.at) fail('DEMO_CLOCK_ERROR');
      task.title = title;
      task.notes = notes;
      const previousDay = task.day;
      if (moved) {
        task.day = day;
        task.position = 0;
      }
      appendEvent(data, task, kind, at, kind === previous.kind ? previous.state_at : at, moved ? previousDay : undefined);
      save(data);
      return taskView(task, data.events.at(-1));
    },
    delete(id, changes) {
      fields(changes, ['created_at']);
      const data = read(), task = data.tasks.find((item) => item.id === id);
      if (!task) fail('NOT_FOUND');
      if (task.created_at !== changes.created_at) fail('TASK_CHANGED');
      data.tasks = data.tasks.filter((item) => item.id !== id);
      data.events = data.events.filter((event) => event.task_id !== id);
      save(data);
    },
    exportData() {
      const at = now(), data = read(at);
      const tasks = data.tasks.map(({ position, ...task }) => position ? { ...task, position } : task);
      return { format: 'tdl-export', version: 1, timezone: 'Asia/Hong_Kong', exported_at: at, tasks, events: data.events };
    },
    reset() { save(examples(now())); return current(); },
  };
}
