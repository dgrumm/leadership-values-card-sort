/**
 * HMAC-SHA256 credentials, signed with the Worker's `SESSION_TOKEN_SECRET`.
 *
 * - `creatorToken` = sign(`creator:${code}`) — minted at `POST /api/session`.
 * - `participantToken` = `${participantId}.${sign(`${code}:${participantId}`)}` —
 *   minted on a successful `join`, verified on every subsequent intent.
 */
const encoder = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return toBase64Url(signature);
}

export async function mintCreatorToken(secret: string, code: string): Promise<string> {
  return sign(secret, `creator:${code}`);
}

export async function mintParticipantToken(secret: string, code: string, participantId: string): Promise<string> {
  const signature = await sign(secret, `${code}:${participantId}`);
  return `${participantId}.${signature}`;
}

/** Returns the participantId iff `token` is a valid, unmodified participantToken for this code. */
export async function verifyParticipantToken(secret: string, code: string, token: string): Promise<string | null> {
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const participantId = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = await sign(secret, `${code}:${participantId}`);
  return expected === signature ? participantId : null;
}
