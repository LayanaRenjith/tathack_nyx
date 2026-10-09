// App lock: the phone's own fingerprint or face (WebAuthn platform authenticator), or a 4-digit code.
// This protects Sahaaya on the phone. It does not replace the UPI PIN, which stays inside the UPI app.

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const random = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** True when this phone and browser can unlock with fingerprint or face (needs HTTPS or localhost). */
export async function biometricAvailable() {
  try {
    return Boolean(globalThis.PublicKeyCredential
      && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Register the phone's fingerprint or face for this user. Returns the credential id to store. */
export async function registerBiometric(userName) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: random(32),
      rp: { name: 'Sahaaya' },
      user: { id: random(16), name: userName || 'sahaaya-user', displayName: userName || 'Sahaaya' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000,
    },
  });
  return b64(cred.rawId);
}

/** Ask the phone to verify the user with fingerprint or face. Resolves true on success. */
export async function verifyBiometric(credId) {
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: random(32),
        allowCredentials: [{ type: 'public-key', id: unb64(credId) }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return Boolean(res);
  } catch {
    return false;
  }
}

/** Salted SHA-256 of a 4-digit code. The code itself is never stored. */
export async function hashCode(code, salt) {
  const data = new TextEncoder().encode(`${salt}:${code}`);
  return b64(await globalThis.crypto.subtle.digest('SHA-256', data));
}

export function newSalt() {
  return b64(random(12));
}

export async function checkCode(code, { codeHash, salt }) {
  if (!/^\d{4}$/.test(code || '') || !codeHash) return false;
  return (await hashCode(code, salt)) === codeHash;
}
