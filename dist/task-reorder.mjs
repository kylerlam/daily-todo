const holdDelay = 450;
const holdTolerance = 8;

export function bindTaskReorder(row, button, task, onMove) {
  row.dataset.reorderDay = task.day;
  button.classList.add('task-reorder-trigger');
  button.setAttribute('aria-keyshortcuts', 'Alt+ArrowUp Alt+ArrowDown');

  const groupRows = () => [...row.parentElement.children].filter((item) => item.dataset.reorderDay === task.day);
  const nextRow = (group) => group[group.indexOf(row) + 1] ?? null;
  const moveBefore = (before) => onMove(before ? Number(before.dataset.taskId) : null);
  let gesture;
  let suppressClick = false;
  let marker;

  function mark(target, className) {
    if (marker?.target === target && marker.className === className) return;
    if (marker) marker.target.classList.remove(marker.className);
    marker = target ? { target, className } : null;
    marker?.target.classList.add(className);
  }

  function finish() {
    clearTimeout(gesture.timer);
    cancelAnimationFrame(gesture.frame);
    row.classList.remove('task-reordering');
    mark(null);
    gesture = null;
  }

  function preview() {
    if (!row.isConnected) return finish();
    const center = gesture.y + gesture.offset;
    gesture.before = gesture.otherRows.find((item) => {
      const bounds = item.getBoundingClientRect();
      return center < bounds.top + bounds.height / 2;
    }) ?? null;
    if (gesture.before === gesture.originalBefore) mark(null);
    else if (gesture.before) mark(gesture.before, 'task-drop-before');
    else mark(gesture.otherRows.at(-1), 'task-drop-after');

    const edge = 48;
    const scroll = gesture.y < edge ? -10 : gesture.y > window.innerHeight - edge ? 10 : 0;
    if (scroll) {
      gesture.frame = requestAnimationFrame(() => {
        const previousY = window.scrollY;
        window.scrollBy(0, scroll);
        if (window.scrollY !== previousY) preview();
      });
    }
  }

  button.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0 || button.disabled || gesture) return;
    suppressClick = false;
    const group = groupRows();
    if (group.length < 2 || button.getAttribute('aria-expanded') === 'true') return;
    gesture = { id: event.pointerId, startX: event.clientX, startY: event.clientY, y: event.clientY };
    button.setPointerCapture(event.pointerId);
    gesture.timer = setTimeout(() => {
      if (!row.isConnected || button.disabled) return finish();
      const bounds = row.getBoundingClientRect();
      gesture.offset = bounds.top + bounds.height / 2 - gesture.startY;
      gesture.otherRows = group.filter((item) => item !== row);
      gesture.originalBefore = nextRow(group);
      gesture.before = gesture.originalBefore;
      row.classList.add('task-reordering');
      suppressClick = true;
    }, holdDelay);
  });

  button.addEventListener('pointermove', (event) => {
    if (gesture?.id !== event.pointerId) return;
    if (gesture.otherRows) {
      gesture.y = event.clientY;
      cancelAnimationFrame(gesture.frame);
      preview();
    } else if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > holdTolerance) {
      clearTimeout(gesture.timer);
      suppressClick = true;
    }
  });

  button.addEventListener('pointerup', (event) => {
    if (gesture?.id !== event.pointerId) return;
    const { before, originalBefore } = gesture;
    finish();
    if (before !== originalBefore) moveBefore(before);
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, (event) => {
      if (gesture?.id === event.pointerId) finish();
    });
  }
  button.addEventListener('contextmenu', (event) => {
    if (gesture) event.preventDefault();
  });
  button.addEventListener('click', (event) => {
    if (!suppressClick || event.detail === 0) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  button.addEventListener('keydown', (event) => {
    if (gesture && event.key === 'Escape') {
      const id = gesture.id;
      finish();
      if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
      return;
    }
    if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const group = groupRows();
    const index = group.indexOf(row);
    event.preventDefault();
    if (event.key === 'ArrowUp' && index > 0) moveBefore(group[index - 1]);
    if (event.key === 'ArrowDown' && index < group.length - 1) moveBefore(group[index + 2] ?? null);
  });
}
