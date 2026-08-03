import { describe, expect, it } from 'vitest';
import { env, runInDurableObject } from 'cloudflare:test';
import type { SessionState } from '@values-cards/shared';
import { connect, createSession, join } from './test-helpers';
import type { Env } from './session';

const testEnv = env as Env;

function stubFor(code: string) {
  return testEnv.Session.get(testEnv.Session.idFromName(code));
}

async function storedState(code: string): Promise<SessionState | undefined> {
  return runInDurableObject(stubFor(code), (_instance, state) => state.storage.get<SessionState>('state'));
}

/** Invariant 5 (PRD §6.5): replaying the same intentId is a no-op. */
describe('idempotency', () => {
  it('re-sending the same intentId N times changes state once and broadcasts once', async () => {
    const { code } = await createSession();
    const socket = await connect(code);
    const { participantId, participantToken } = await join(socket, 'Facilitator');
    const before = await storedState(code);

    const intentId = crypto.randomUUID();
    const message = {
      type: 'reportProgress',
      intentId,
      participantId,
      token: participantToken,
      round: 1,
      sorted: 5,
      kept: 3,
      done: false,
    };

    // Send the same intentId 3 times in a row.
    socket.send(message);
    socket.send(message);
    socket.send(message);

    // Only the first send produces a broadcast.
    const firstPatch = await socket.next();
    expect(firstPatch).toMatchObject({ type: 'patch' });

    const after = await storedState(code);
    expect(after).not.toEqual(before);
    expect(after?.participants[participantId]?.progress).toEqual({ round: 1, sorted: 5, kept: 3, done: false });

    // A 4th replay, sent after the fact, still changes nothing and broadcasts nothing.
    socket.send(message);
    const race = await Promise.race([
      socket.next().then(() => 'message'),
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 100)),
    ]);
    expect(race).toBe('timeout');
    expect(socket.received).toBe(3); // welcome, state (join), patch (first reportProgress) — no more
    expect(await storedState(code)).toEqual(after);
  });
});
