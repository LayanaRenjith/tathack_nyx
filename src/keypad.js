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
export function mountKeypad(container, { onChange, onKey, tolerant = true } = {}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];
  const labels = { back: '⌫', clear: 'C' };
  const ariaLabels = { back: 'Delete last digit', clear: 'Clear amount' };
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
  let downAt = 0;

  const keyAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('.key')?.dataset.key ?? null;

  container.addEventListener('pointerdown', (e) => {
    downAt = performance.now();
    if (tolerant) e.preventDefault();
  });
  container.addEventListener('pointerup', (e) => {
    const key = tolerant ? keyAt(e.clientX, e.clientY) : e.target.closest('.key')?.dataset.key;
    if (!filter({ downAt, upAt: performance.now(), key, pointerType: e.pointerType })) return;
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
