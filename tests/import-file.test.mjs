import assert from 'node:assert/strict';
import test from 'node:test';
import { importData, MAX_IMPORT_BYTES, readImportFile } from '../dist/import-file.mjs';

function file(name, content) {
  const bytes = new TextEncoder().encode(content);
  return { name, size: bytes.byteLength, arrayBuffer: async () => bytes.buffer };
}

test('selecting an exported file only reads UTF-8 text and never sends an import', async (t) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('reading a file must not upload it'));
  const content = '"title": "读书 · café"\n';
  for (const name of ['daily.yml', 'daily.YAML', 'daily.json']) assert.equal(await readImportFile(file(name, content)), content);
});

test('unsupported files and files over 10 MiB are rejected before reading', async () => {
  const unreadable = { arrayBuffer: async () => assert.fail('invalid files must not be read') };
  await assert.rejects(readImportFile({ ...unreadable, name: 'other.txt', size: 1 }), { code: 'IMPORT_FILE_TYPE' });
  await assert.rejects(readImportFile({ ...unreadable, name: 'daily.yml', size: MAX_IMPORT_BYTES + 1 }), { code: 'IMPORT_FILE_TOO_LARGE' });
});

test('invalid UTF-8 and local read errors have specific errors', async () => {
  await assert.rejects(readImportFile({ name: 'daily.yml', size: 2, arrayBuffer: async () => Uint8Array.from([0xc3, 0x28]).buffer }), { code: 'IMPORT_FILE_ENCODING' });
  await assert.rejects(readImportFile({ name: 'daily.yml', size: 1, arrayBuffer: async () => { throw new Error('Access denied'); } }), { code: 'IMPORT_FILE_READ' });
});

test('explicit import sends the selected content once with the expected API contract', async (t) => {
  const content = '"title": "A \\"quoted\\" task"\n';
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    calls++;
    assert.equal(path, '/api/import');
    assert.deepEqual(options, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
    });
    return { ok: true, json: async () => ({ imported_tasks: 2, skipped_tasks: 1 }) };
  });
  assert.deepEqual(await importData(content), { imported_tasks: 2, skipped_tasks: 1 });
  assert.equal(calls, 1);
});

for (const [status, code] of [[400, 'INVALID_IMPORT'], [413, 'IMPORT_TOO_LARGE'], [409, 'IMPORT_CONFLICT'], [401, 'AUTH_REQUIRED']]) {
  test(`import preserves ${code} from the server`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status, json: async () => ({ code }) }));
    await assert.rejects(importData('export'), (error) => error.code === code && error.status === status);
  });
}

test('an unauthorized non-JSON response still requires sign-in', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 401, json: async () => { throw new SyntaxError('Not JSON'); } }));
  await assert.rejects(importData('export'), { code: 'AUTH_REQUIRED', status: 401 });
});

test('network failures and invalid success payloads cannot be reported as a successful import', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Offline'); });
  await assert.rejects(importData('export'), { code: 'IMPORT_NETWORK_ERROR' });
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ imported_tasks: -1, skipped_tasks: 0 }) }));
  await assert.rejects(importData('export'), { code: 'IMPORT_FAILED' });
});
