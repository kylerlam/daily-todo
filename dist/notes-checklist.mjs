export const checklistPrefix = /^[☐☑] /;

// Mirror the textarea's wrapping and scroll position to place native controls over the markers.
export function bindNotesChecklist(editor, overlay, emptyLabel) {
  const mirror = overlay.firstElementChild;

  function syncPosition() {
    overlay.style.width = `${editor.clientWidth}px`;
    overlay.style.height = `${editor.clientHeight}px`;
    mirror.style.transform = `translateY(${-editor.scrollTop}px)`;
  }

  function refresh() {
    const lines = editor.value.split('\n');
    mirror.replaceChildren();
    if (!lines.some((line) => checklistPrefix.test(line))) return;

    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const line of lines) {
      const row = document.createElement('div');
      row.className = 'notes-checklist-line';
      const text = document.createElement('span');
      text.textContent = line;
      text.setAttribute('aria-hidden', 'true');
      row.append(text);
      if (checklistPrefix.test(line)) {
        const marker = offset;
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = line.startsWith('☑');
        box.disabled = editor.readOnly;
        box.setAttribute('aria-label', line.slice(2).trim() || emptyLabel());
        box.addEventListener('change', () => {
          const symbol = box.checked ? '☑' : '☐';
          editor.setRangeText(symbol, marker, marker + 1, 'preserve');
          text.textContent = symbol + line.slice(1);
          syncPosition();
        });
        row.append(box);
      }
      fragment.append(row);
      offset += line.length + 1;
    }
    mirror.append(fragment);
    syncPosition();
  }

  overlay.addEventListener('focusin', (event) => {
    const viewport = overlay.getBoundingClientRect();
    const box = event.target.getBoundingClientRect();
    if (box.top < viewport.top) editor.scrollTop += box.top - viewport.top;
    else if (box.bottom > viewport.bottom) editor.scrollTop += box.bottom - viewport.bottom;
    syncPosition();
  });
  editor.addEventListener('input', refresh);
  editor.addEventListener('scroll', syncPosition);
  new ResizeObserver(syncPosition).observe(editor);
  return refresh;
}
