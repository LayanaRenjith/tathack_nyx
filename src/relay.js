// Instant replies from the helper, with no server of our own.
// The request gets a long random channel name. The helper's approval page posts the approval code
// (or "don't pay") to that channel through ntfy.sh, a free open-source message relay, and the
// elder's phone, listening on the same channel, unlocks the payment at once.
// Nothing about the payment is sent through the relay: only the 6-digit code, which is useless
// without this exact request, account and amount, and is still checked against the Guardian PIN.
// If the relay is unreachable, the helper sends the code on WhatsApp and it is typed or said instead.

const RELAY = 'https://ntfy.sh';

export function newChannel() {
  const a = new Uint8Array(15);
  globalThis.crypto.getRandomValues(a);
  return `sahaaya_${[...a].map((b) => b.toString(36).padStart(2, '0')).join('')}`;
}

/** Helper's phone: send the answer. */
export async function sendAnswer(channel, answer) {
  if (!channel) return false;
  try {
    const res = await fetch(`${RELAY}/${encodeURIComponent(channel)}`, { method: 'POST', body: JSON.stringify(answer) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Elder's phone: listen for the answer. Returns stop(). */
export function listenForAnswer(channel, since, onAnswer) {
  if (!channel || !globalThis.EventSource) return () => {};
  let es = null;
  try {
    es = new EventSource(`${RELAY}/${encodeURIComponent(channel)}/sse?since=${Math.floor(since / 1000)}`);
    es.addEventListener('message', (e) => {
      try {
        const msg = JSON.parse(JSON.parse(e.data).message);
        if (msg && (msg.a === 'ok' || msg.a === 'no')) onAnswer(msg);
      } catch { /* not ours */ }
    });
  } catch { /* offline: WhatsApp code still works */ }
  return () => { try { es?.close(); } catch {} };
}
