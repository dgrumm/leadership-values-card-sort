import { describe, expect, it } from 'vitest';
import { mintCreatorToken, mintParticipantToken, verifyCreatorToken, verifyParticipantToken } from './token';

const SECRET = 'test-secret-do-not-use-in-prod';
const CODE = 'ABC123';

describe('token secret guard', () => {
  // An unset SESSION_TOKEN_SECRET otherwise reaches WebCrypto as a zero-length key and
  // surfaces as "Imported HMAC key length (0)...", which says nothing about the cause.
  // This bit real manual dev: `POST /api/session` 500s with a crypto stack trace.
  it('throws an actionable error when the secret is empty rather than a crypto error', async () => {
    await expect(mintCreatorToken('', CODE)).rejects.toThrow(/SESSION_TOKEN_SECRET is not set/);
    await expect(mintParticipantToken('', CODE, 'p1')).rejects.toThrow(/\.dev\.vars/);
  });
});

describe('token round-trip', () => {
  it('mints and verifies a creator token, and rejects one for a different code', async () => {
    const token = await mintCreatorToken(SECRET, CODE);
    expect(await verifyCreatorToken(SECRET, CODE, token)).toBe(true);
    expect(await verifyCreatorToken(SECRET, 'ZZZ999', token)).toBe(false);
    expect(await verifyCreatorToken('other-secret', CODE, token)).toBe(false);
  });

  it('mints and verifies a participant token, returning the id only on a valid signature', async () => {
    const token = await mintParticipantToken(SECRET, CODE, 'participant-1');
    expect(await verifyParticipantToken(SECRET, CODE, token)).toBe('participant-1');
    expect(await verifyParticipantToken(SECRET, CODE, `${token}tampered`)).toBeNull();
    expect(await verifyParticipantToken(SECRET, CODE, 'no-dot-separator')).toBeNull();
  });
});
