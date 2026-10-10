// Tremor-tolerant amount keypad.
// - A key counts where the finger LIFTS, not where it first lands (tremor drift on touch-down).
// - Repeat presses inside the debounce window are ignored (double taps from tremor).
// - Presses shorter than minHoldMs are ignored (accidental brushes).
// The filtering logic is pure (createTapFilter) so it can be unit tested and reused.

export function createTapFilter({ debounceMs = 600, minHoldMs = 60 } = {}) {
  let lastAcceptedAt = -Infinity;
  return function accept({ downAt, upAt, key, pointerType = 'touch' }) {
    if (key == null) return false;              // lifted off outside every key
    // Brush filter is for fingers; a mouse or stylus click is always deliberate.
    if (pointerType === 'touch' && upAt - downAt < minHoldMs) return false;
    if (upAt - lastAcceptedAt < debounceMs) return false; // tremor double tap
    lastAcceptedAt = upAt;
    return true;
  };
}

/** A finger that travelled further than a tremor would is a swipe or scroll, not a key press. */
export const SWIPE_PX = 28;
export function isSwipe(start, end) {
  return Math.hypot((end.clientX ?? end.x) - start.x, (end.clientY ?? end.y) - start.y) > SWIPE_PX;
}

export function applyKey(value, key, maxDigits = 7) {
  if (key === 'back') return value.slice(0, -1);
  if (key === 'clear') return '';
  if (!/^\d$/.test(key)) return value;
  if (value === '' && key === '0') return value;
  if (value.length >= maxDigits) return value;
  return value + key;
}

/**
 * Mount the keypad into `container`. Calls onChange(value) after every accepted key.
 * `tolerant` = false gives a normal keypad, for the before/after error-rate comparison.
 */
export function mountKeypad(container, { onChange, onKey, tolerant = true, ariaLabels = { back: 'Delete last digit', clear: 'Clear amount' } } = {}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];
  const labels = { back: '⌫', clear: 'C' };
  container.innerHTML = '';
  container.classList.add('keypad');
  keys.forEach((k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'key';
    b.dataset.key = k;
    b.textContent = labels[k] || k;
    b.setAttribute('aria-label', ariaLabels[k] || k);
    container.appendChild(b);
  });

  let value = '';
  const filter = tolerant ? createTapFilter() : () => true;
  let down = null; // { at, x, y } of the finger currently on the keypad

  const keyAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('.key')?.dataset.key ?? null;

  // The keypad must never stop the page from scrolling: it covers half the screen on a phone.
  // The browser takes over a finger that starts to scroll (pointercancel), and a finger that
  // moved a long way is treated as a swipe, not a key, so swiping never types a digit.
  container.addEventListener('pointerdown', (e) => {
    down = { at: performance.now(), x: e.clientX, y: e.clientY };
  });
  container.addEventListener('pointercancel', () => { down = null; });
  container.addEventListener('pointerup', (e) => {
    if (!down) return;
    const start = down;
    down = null;
    if (isSwipe(start, e)) return;
    const key = tolerant ? keyAt(e.clientX, e.clientY) : e.target.closest('.key')?.dataset.key;
    if (!filter({ downAt: start.at, upAt: performance.now(), key, pointerType: e.pointerType })) return;
    value = applyKey(value, key);
    onKey?.(key);
    onChange?.(value);
  });
  // Keyboard/switch access and screen readers (TalkBack double-tap fires click without pointer events).
  container.addEventListener('click', (e) => {
    if (e.pointerType) return;
    const key = e.target.closest('.key')?.dataset.key;
    if (!key) return;
    value = applyKey(value, key);
    onKey?.(key);
    onChange?.(value);
  });

  return {
    get value() { return value; },
    set(v) { value = String(v ?? ''); onChange?.(value); },
  };
}
