export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

function importError(code) {
  const error = new Error('The import could not be completed.');
  error.code = code;
  return error;
}

export async function readImportFile(file) {
  if (!file || !/\.(yml|yaml|json)$/i.test(file.name)) throw importError('IMPORT_FILE_TYPE');
  if (file.size > MAX_IMPORT_BYTES) throw importError('IMPORT_FILE_TOO_LARGE');
  let buffer;
  try { buffer = await file.arrayBuffer(); } catch { throw importError('IMPORT_FILE_READ'); }
  if (buffer.byteLength > MAX_IMPORT_BYTES) throw importError('IMPORT_FILE_TOO_LARGE');
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch { throw importError('IMPORT_FILE_ENCODING'); }
}

export async function importData(content) {
  if (typeof content !== 'string') throw importError('INVALID_IMPORT');
  if (new TextEncoder().encode(content).byteLength > MAX_IMPORT_BYTES) throw importError('IMPORT_FILE_TOO_LARGE');
  let response;
  try {
    response = await fetch('/api/import', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
    });
  } catch { throw importError('IMPORT_NETWORK_ERROR'); }
  let body;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const error = importError(body?.code || (response.status === 401 ? 'AUTH_REQUIRED' : 'INVALID_IMPORT'));
    error.status = response.status;
    throw error;
  }
  if (!Number.isInteger(body?.imported_tasks) || body.imported_tasks < 0 || !Number.isInteger(body?.skipped_tasks) || body.skipped_tasks < 0) {
    throw importError('IMPORT_FAILED');
  }
  return body;
}
