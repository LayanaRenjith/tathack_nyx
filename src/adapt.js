// "Learns as you use": notices taps that miss buttons or repeat quickly, and offers bigger buttons.
// The counting is pure so it can be tested; ui.js feeds it pointer events.

export function createTapWatcher({ missLimit = 3, doubleLimit = 2, doubleMs = 450 } = {}) {
  let misses = 0;
  let doubles = 0;
  let lastHit = { el: null, at: -Infinity };
  let offered = false;
  return {
    /** Record a tap. `hitEl` = the button tapped, or null if the tap landed on nothing interactive. */
    tap(hitEl, at) {
      if (!hitEl) misses += 1;
      else {
        if (hitEl === lastHit.el && at - lastHit.at < doubleMs) doubles += 1;
        lastHit = { el: hitEl, at };
      }
      return this.shouldOffer();
    },
    shouldOffer() {
      return !offered && (misses >= missLimit || doubles >= doubleLimit);
    },
    markOffered() { offered = true; },
    stats() { return { misses, doubles }; },
  };
}
