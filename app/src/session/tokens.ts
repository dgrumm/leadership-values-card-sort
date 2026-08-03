/**
 * Rejoin credentials (spec 01.2). Keyed by session code so a revisit of `/join/:code`
 * in the same browser silently resumes — no name prompt, no re-issued identity.
 * Clearing storage is equivalent to never having joined.
 */
export interface StoredToken {
  participantId: string;
  participantToken: string;
}

function storageKey(code: string): string {
  return `vc:${code}:token`;
}

export function loadToken(code: string): StoredToken | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey(code));
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as StoredToken).participantId === 'string' &&
      typeof (parsed as StoredToken).participantToken === 'string'
    ) {
      return parsed as StoredToken;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveToken(code: string, token: StoredToken): void {
  localStorage.setItem(storageKey(code), JSON.stringify(token));
}

export function clearToken(code: string): void {
  localStorage.removeItem(storageKey(code));
}
