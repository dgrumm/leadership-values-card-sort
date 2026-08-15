import { describe, expect, it } from 'vitest';
import { env, runInDurableObject } from 'cloudflare:test';
import type { GameConfig, SessionState } from '@values-cards/shared';
import { connect, createSession, join } from './test-helpers';
import type { Env } from './session';

const testEnv = env as Env;

function stubFor(code: string) {
  return testEnv.Session.get(testEnv.Session.idFromName(code));
}

async function storedState(code: string): Promise<SessionState | undefined> {
  return runInDurableObject(stubFor(code), (_instance, state) => state.storage.get<SessionState>('state'));
}

/** One round, keep exactly 3, ranked — small enough to reveal by hand. */
const CONFIG: GameConfig = {
  title: 'Reveal test',
  deck: {
    name: 'Mini',
    source: 'bundled',
    cards: [
      { value: 'A', description: 'a' },
      { value: 'B', description: 'b' },
      { value: 'C', description: 'c' },
      { value: 'D', description: 'd' },
      { value: 'E', description: 'e' },
    ],
  },
  rounds: [{ name: 'Round 1', keep: 3, rank: true }],
  theme: { variant: 'default' },
  facilitated: false,
};

function snapshotOf(values: string[], ranked = true) {
  return {
    cards: values.map((value) => ({ value, description: value.toLowerCase() })),
    ranked,
    revealedAt: Date.now(),
  };
}

async function setup() {
  const { code, creatorToken } = await createSession(CONFIG);
  const socket = await connect(code);
  const { participantId, participantToken } = await join(socket, 'Facilitator', crypto.randomUUID(), creatorToken);
  return { code, socket, participantId, participantToken };
}

describe('Invariant 2 (write-once reveal, delete-not-edit unreveal)', () => {
  it('rejects a second reveal for the same (participant, round) and leaves state byte-identical', async () => {
    const { code, socket, participantId, participantToken } = await setup();

    socket.send({
      type: 'reveal',
      intentId: crypto.randomUUID(),
      participantId,
      token: participantToken,
      round: 1,
      snapshot: snapshotOf(['A', 'B', 'C']),
    });
    await socket.next(); // accepted patch
    const afterFirst = await storedState(code);

    socket.send({
      type: 'reveal',
      intentId: crypto.randomUUID(),
      participantId,
      token: participantToken,
      round: 1,
      snapshot: snapshotOf(['D', 'E', 'A']), // a different snapshot — must not overwrite
    });
    const rejection = await socket.next();
    expect(rejection).toMatchObject({ type: 'error', code: 'ALREADY_REVEALED' });

    const afterSecond = await storedState(code);
    expect(afterSecond).toEqual(afterFirst); // byte-identical: the rejected reveal changed nothing
  });

  it('unreveal deletes the snapshot key entirely, not just its value', async () => {
    const { code, socket, participantId, participantToken } = await setup();

    socket.send({
      type: 'reveal',
      intentId: crypto.randomUUID(),
      participantId,
      token: participantToken,
      round: 1,
      snapshot: snapshotOf(['A', 'B', 'C']),
    });
    await socket.next();
    expect((await storedState(code))?.reveals[participantId]?.[1]).toBeDefined();

    socket.send({ type: 'unreveal', intentId: crypto.randomUUID(), participantId, token: participantToken, round: 1 });
    await socket.next();

    const state = await storedState(code);
    // Deleted, not blanked: the round key must be absent from the per-participant map,
    // not present with an empty/null value.
    expect(state?.reveals[participantId] ?? {}).not.toHaveProperty('1');
    expect(Object.keys(state?.reveals[participantId] ?? {})).toHaveLength(0);
  });

  it('reveal -> unreveal -> reveal yields the fresh snapshot, not the original', async () => {
    const { code, socket, participantId, participantToken } = await setup();

    socket.send({
      type: 'reveal',
      intentId: crypto.randomUUID(),
      participantId,
      token: participantToken,
      round: 1,
      snapshot: snapshotOf(['A', 'B', 'C']),
    });
    await socket.next();

    socket.send({ type: 'unreveal', intentId: crypto.randomUUID(), participantId, token: participantToken, round: 1 });
    await socket.next();

    const freshSnapshot = snapshotOf(['C', 'D', 'E']);
    socket.send({
      type: 'reveal',
      intentId: crypto.randomUUID(),
      participantId,
      token: participantToken,
      round: 1,
      snapshot: freshSnapshot,
    });
    await socket.next();

    const state = await storedState(code);
    expect(state?.reveals[participantId]?.[1]).toEqual(freshSnapshot);
  });
});

describe('Invariant 3 (server-side keep-count enforcement on reveal)', () => {
  it('rejects N-1 cards with a typed KEEP_COUNT_MISMATCH', async () => {
    const { socket, participantId, participantToken } = await setup();
    socket.send({
      type: 'reveal',
      intentId: crypto.randomUUID(),
      participantId,
      token: participantToken,
      round: 1,
      snapshot: snapshotOf(['A', 'B']), // round keeps 3, this has 2
    });
    expect(await socket.next()).toMatchObject({ type: 'error', code: 'KEEP_COUNT_MISMATCH' });
  });

  it('rejects N+1 cards with a typed KEEP_COUNT_MISMATCH', async () => {
    const { socket, participantId, participantToken } = await setup();
    socket.send({
      type: 'reveal',
      intentId: crypto.randomUUID(),
      participantId,
      token: participantToken,
      round: 1,
      snapshot: snapshotOf(['A', 'B', 'C', 'D']), // round keeps 3, this has 4
    });
    expect(await socket.next()).toMatchObject({ type: 'error', code: 'KEEP_COUNT_MISMATCH' });
  });

  it('rejects a card not in this session\'s deck with a typed UNKNOWN_CARD, even at the right count', async () => {
    const { socket, participantId, participantToken } = await setup();
    socket.send({
      type: 'reveal',
      intentId: crypto.randomUUID(),
      participantId,
      token: participantToken,
      round: 1,
      snapshot: snapshotOf(['A', 'B', 'Zeta']), // 3 cards, but "Zeta" isn't in the deck
    });
    expect(await socket.next()).toMatchObject({ type: 'error', code: 'UNKNOWN_CARD' });
  });

  it('accepts exactly N matching, in-deck cards', async () => {
    const { code, socket, participantId, participantToken } = await setup();
    socket.send({
      type: 'reveal',
      intentId: crypto.randomUUID(),
      participantId,
      token: participantToken,
      round: 1,
      snapshot: snapshotOf(['A', 'B', 'C']),
    });
    const accepted = await socket.next();
    expect(accepted.type).toBe('patch');

    const state = await storedState(code);
    expect(state?.reveals[participantId]?.[1]?.cards.map((c: { value: string }) => c.value)).toEqual(['A', 'B', 'C']);
  });
});

describe('Invariant 1 (no card data server-side before an explicit reveal)', () => {
  it('a second, unrelated participant\'s state has no reveals bucket until they reveal', async () => {
    const { code, participantId: p1 } = await setup();
    const socket2 = await connect(code);
    const { participantId: p2 } = await join(socket2, 'Second');

    const state = await storedState(code);
    expect(state?.reveals[p1]).toBeUndefined();
    expect(state?.reveals[p2]).toBeUndefined();
  });
});
