async function fetchExport(format) {
  const response = await fetch(`/api/export?format=${encodeURIComponent(format)}`, { cache: "no-store" });
  if (!response.ok) {
    let body = {};
    try { body = await response.json(); } catch { /* HTTP errors may have no JSON body. */ }
    const error = new Error("Export failed. Please try again.");
    error.code = body?.code || (response.status === 401 ? "AUTH_REQUIRED" : "EXPORT_FAILED");
    error.status = response.status;
    throw error;
  }
  return response.blob();
}

export async function saveExport({
  format = "yml",
  filename = `daily-todo.${format === "json" ? "json" : "yml"}`,
  mime = format === "json" ? "application/json" : "application/yaml",
  description = format === "json" ? "JSON data" : "YAML data",
} = {}) {
  const handle = await window.showSaveFilePicker({
    id: "daily-todo-export",
    suggestedName: filename,
    types: [{
      description,
      accept: { [mime.split(";")[0].trim()]: [format === "json" ? ".json" : ".yml"] },
    }],
  });
  const blob = await fetchExport(format);
  const writer = await handle.createWritable();
  try {
    await writer.write(blob);
    await writer.close();
  } catch (error) {
    try { await writer.abort(); } catch { /* Preserve the original write error. */ }
    throw error;
  }
}

export async function downloadExport({
  format = "yml",
  filename = `daily-todo.${format === "json" ? "json" : "yml"}`,
} = {}) {
  const blob = await fetchExport(format);
  const url = URL.createObjectURL(blob);
  const download = document.createElement("a");
  try {
    download.href = url;
    download.download = filename;
    document.body.append(download);
    download.click();
  } finally {
    download.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
