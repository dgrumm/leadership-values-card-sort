import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { clearToken, loadToken, saveToken } from './tokens';

afterEach(() => {
  localStorage.clear();
});

describe('token storage', () => {
  it('round-trips a token under a code-scoped key', () => {
    saveToken('ABC123', { participantId: 'p-1', participantToken: 'tok-1' });
    expect(loadToken('ABC123')).toEqual({ participantId: 'p-1', participantToken: 'tok-1' });
    expect(localStorage.getItem('vc:ABC123:token')).not.toBeNull();
  });

  it('isolates tokens per session code', () => {
    saveToken('AAA111', { participantId: 'p-a', participantToken: 'tok-a' });
    saveToken('BBB222', { participantId: 'p-b', participantToken: 'tok-b' });
    expect(loadToken('AAA111')?.participantId).toBe('p-a');
    expect(loadToken('BBB222')?.participantId).toBe('p-b');
  });

  it('returns null when nothing is stored', () => {
    expect(loadToken('NONE00')).toBeNull();
  });

  it('clearing removes the token — a subsequent load is a normal join', () => {
    saveToken('ABC123', { participantId: 'p-1', participantToken: 'tok-1' });
    clearToken('ABC123');
    expect(loadToken('ABC123')).toBeNull();
  });

  it('treats malformed stored JSON as absent rather than throwing', () => {
    localStorage.setItem('vc:BAD000:token', 'not json');
    expect(loadToken('BAD000')).toBeNull();
  });
});

// Built at runtime, not a literal, so this test file itself never self-matches the scan below.
const SECRET_NAME = ['SESSION', 'TOKEN', 'SECRET'].join('_');

describe('no server secret ever referenced from app/src (CI-level assertion)', () => {
  it(`grep: ${SECRET_NAME} never appears under app/src`, () => {
    const appSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const selfPath = fileURLToPath(import.meta.url);
    const offenders: string[] = [];
    walk(appSrc, selfPath, offenders);
    expect(offenders).toEqual([]);
  });
});

function walk(dir: string, selfPath: string, offenders: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(full, selfPath, offenders);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry) || full === selfPath) continue;
    const contents = readFileSync(full, 'utf8');
    if (contents.includes(SECRET_NAME)) {
      offenders.push(full);
    }
  }
}
