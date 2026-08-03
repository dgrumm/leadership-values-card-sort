/**
 * Session code generation: 6 chars, unambiguous alphabet (no 0/O/1/I), matches
 * the shared `^[A-Z0-9]{6}$` code format.
 */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let code = '';
  for (const byte of bytes) {
    code += ALPHABET[byte % ALPHABET.length];
  }
  return code;
}
