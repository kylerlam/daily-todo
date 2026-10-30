import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoStore, DEMO_STORAGE_KEY } from '../dist/demo-store.mjs';

function environment() {
  const values = new Map([['unrelated', 'keep me']]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let time = new Date('2026-10-29T23:30:00Z');
  const clock = () => time;
  return { values, storage, clock, store: createDemoStore({ storage, clock }), on: (value) => { time = new Date(value); } };
}
const code = (expected) => (error) => error.code === expected;

test('seeds fictional samples once, isolates browsers, persists and resets only its own key', () => {
  const { store, storage, values, clock } = environment();
  assert.equal(store.current().today, '2026-10-30');
  assert.equal(store.exportData().tasks.length, 4);
  assert.equal(store.day('2026-10-29').summary.completed, 1);
  assert.equal(store.day('2026-10-30').summary.completed, 1);
  const task = store.create({ title: '  Local only  ', notes: '<img src=x onerror=alert(1)>' });
  assert.equal(task.title, 'Local only');
  const reopened = createDemoStore({ storage, clock });
  assert.equal(reopened.current().tasks.find((item) => item.id === task.id).notes, task.notes);
  const detached = reopened.exportData();
  detached.tasks[0].title = 'Changed outside store';
  detached.events.length = 0;
  assert.notEqual(store.exportData().tasks[0].title, detached.tasks[0].title);
  assert.equal(environment().store.exportData().tasks.length, 4);
  store.reset();
  assert.equal(store.exportData().tasks.length, 4);
  assert.equal(values.get('unrelated'), 'keep me');
});

test('history keeps earlier titles and status dates through edits, completion, undo and discard', () => {
  const { store, on } = environment();
  const task = store.create({ title: 'Original', notes: 'Before' });
  on('2026-10-30T16:01:00Z');
  store.patch(task.id, { title: 'Updated', notes: 'After' });
  assert.equal(store.day('2026-10-30').tasks.find((item) => item.id === task.id).title, 'Original');
  const completed = store.patch(task.id, { completed: true });
  assert.equal(completed.completed_at, '2026-10-31T00:01:00.000+08:00');
  const count = store.exportData().events.length;
  store.patch(task.id, { completed: true });
  assert.equal(store.exportData().events.length, count);
  on('2026-10-31T16:01:00Z');
  store.patch(task.id, { title: 'Later edit' });
  assert.equal(store.day('2026-10-31').tasks.find((item) => item.id === task.id).title, 'Updated');
  assert.equal(store.current().tasks.some((item) => item.id === task.id), false);
  store.patch(task.id, { completed: false });
  assert.equal(store.day('2026-10-31').tasks.find((item) => item.id === task.id).completed_at, completed.completed_at);
  assert.equal(store.current().tasks.find((item) => item.id === task.id).completed, false);
  store.patch(task.id, { discarded: true });
  assert.equal(store.day('2026-11-01').tasks.find((item) => item.id === task.id).discarded, true);
  assert.equal(store.current().tasks.some((item) => item.id === task.id), false);
  assert.equal(store.month('2024-02').days.length, 29);
  for (const day of store.month('2026-10').days) assert.deepEqual(day, { date: day.date, ...store.day(day.date).summary });
});

test('invalid inputs and future completion do not alter saved data', () => {
  const { store, values } = environment();
  store.current();
  const before = values.get(DEMO_STORAGE_KEY);
  for (const [input, expected] of [
    [null, 'INVALID_BODY'], [[], 'INVALID_BODY'], [{}, 'MISSING_TITLE'], [{ title: ' ' }, 'INVALID_TITLE'],
    [{ title: 'x'.repeat(301) }, 'INVALID_TITLE'], [{ title: '\ud800' }, 'INVALID_TITLE'],
    [{ title: 'x', notes: 'x'.repeat(5001) }, 'INVALID_NOTES'], [{ title: 'x', notes: false }, 'INVALID_NOTES'],
    [{ title: 'x', day: '2026-02-30' }, 'INVALID_DATE'], [{ title: 'x', day: '2026-1-01' }, 'INVALID_DATE_FORMAT'],
    [{ title: 'x', day: null }, 'INVALID_DATE_FORMAT'],
    [{ title: 'x', extra: 1 }, 'UNKNOWN_FIELDS'],
  ]) assert.throws(() => store.create(input), code(expected));
  const future = store.current().tasks.find((task) => task.day > store.current().today);
  assert.throws(() => store.patch(future.id, { completed: true }), code('FUTURE_COMPLETION'));
  assert.throws(() => store.patch(future.id, { completed: 1 }), code('INVALID_BOOLEAN'));
  assert.throws(() => store.patch(future.id, { completed: true, discarded: false }), code('CONFLICTING_STATUS'));
  assert.throws(() => store.patch(future.id, {}), code('EMPTY_UPDATE'));
  assert.throws(() => store.patch(999, { title: 'Missing' }), code('NOT_FOUND'));
  assert.throws(() => store.day('2026-02-30'), code('INVALID_DATE'));
  assert.throws(() => store.month('2026-13'), code('INVALID_DATE'));
  assert.equal(values.get(DEMO_STORAGE_KEY), before);
});

test('corrupted or externally changed storage is rejected without deleting it, with explicit reset recovery', () => {
  const { store, values } = environment();
  const valid = store.exportData();
  for (const raw of ['{bad', '{}', JSON.stringify({ version: 1, tasks: valid.tasks, events: [] })]) {
    values.set(DEMO_STORAGE_KEY, raw);
    assert.throws(() => store.current(), code('DEMO_STORAGE_INVALID'));
    assert.equal(values.get(DEMO_STORAGE_KEY), raw);
  }
  store.reset();
  assert.equal(store.exportData().tasks.length, 4);
  const damaged = JSON.parse(values.get(DEMO_STORAGE_KEY));
  damaged.events[0].title = '<script>alert(1)</script>';
  values.set(DEMO_STORAGE_KEY, JSON.stringify(damaged));
  assert.throws(() => store.current(), code('DEMO_STORAGE_INVALID'));
});

test('blocked storage, lazy browser getter and quota errors never pretend to save', (t) => {
  const blocked = createDemoStore({ storage: { getItem() { throw new Error('blocked'); } } });
  assert.throws(() => blocked.current(), code('DEMO_STORAGE_ERROR'));
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked getter'); } });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete globalThis.localStorage; });
  const lazy = createDemoStore();
  assert.throws(() => lazy.current(), code('DEMO_STORAGE_ERROR'));
  const { storage, values, clock, store } = environment();
  store.current();
  const before = values.get(DEMO_STORAGE_KEY);
  const quota = createDemoStore({ clock, storage: { getItem: storage.getItem, setItem() { throw new Error('quota'); } } });
  assert.throws(() => quota.create({ title: 'Unsaved' }), code('DEMO_STORAGE_ERROR'));
  assert.throws(() => quota.reset(), code('DEMO_STORAGE_ERROR'));
  assert.equal(values.get(DEMO_STORAGE_KEY), before);
  assert.equal(store.current().tasks.some((item) => item.title === 'Unsaved'), false);
});

test('a backwards device clock cannot write unreadable history', () => {
  const { store, values, on } = environment();
  const task = store.create({ title: 'Keep history readable' });
  const before = values.get(DEMO_STORAGE_KEY);
  on('2026-10-29T23:29:00Z');
  assert.throws(() => store.patch(task.id, { completed: true }), code('DEMO_CLOCK_ERROR'));
  assert.equal(values.get(DEMO_STORAGE_KEY), before);
  assert.equal(store.current().tasks.find((item) => item.id === task.id).completed, false);
  on('2026-10-29T23:31:00Z');
  store.patch(task.id, { completed: true });
  assert.equal(store.current().tasks.find((item) => item.id === task.id).completed, true);
});
