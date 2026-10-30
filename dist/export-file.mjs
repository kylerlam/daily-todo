export async function saveExport({
  getBlob,
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
  const blob = await getBlob();
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
  getBlob,
  format = "yml",
  filename = `daily-todo.${format === "json" ? "json" : "yml"}`,
} = {}) {
  const blob = await getBlob();
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
