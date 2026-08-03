import { describe, expect, it } from 'vitest';
import { SELF, env, evictDurableObject, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
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

describe('POST /api/session', () => {
  it('returns a unique 6-char code and a creatorToken; the DO serves state over WebSocket', async () => {
    const { code, creatorToken } = await createSession();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(creatorToken.length).toBeGreaterThan(0);

    const socket = await connect(code);
    const { participantId } = await join(socket, 'Facilitator', crypto.randomUUID(), creatorToken);
    expect(participantId).toMatch(/^[0-9a-f-]{36}$/);

    const state = await storedState(code);
    expect(state?.code).toBe(code);
    expect(state?.participants[participantId]?.role).toBe('facilitator');
  });
});

describe('facilitator role is owned by creatorToken, not join order', () => {
  it('gives the creator the facilitator role even when a participant joins first', async () => {
    const { code, creatorToken } = await createSession();

    const racer = await connect(code);
    const first = await join(racer, 'Fast Participant');

    const creator = await connect(code);
    const second = await join(creator, 'Real Creator', crypto.randomUUID(), creatorToken);

    const state = await storedState(code);
    expect(state?.participants[first.participantId]?.role).toBe('participant');
    expect(state?.participants[second.participantId]?.role).toBe('facilitator');
  });

  it('ignores a client-supplied isCreator flag and a forged creatorToken', async () => {
    const { code } = await createSession();
    const socket = await connect(code);

    socket.send({ type: 'join', intentId: crypto.randomUUID(), name: 'Impostor', isCreator: true });
    const welcome = (await socket.next()) as { participantId: string };
    await socket.next();

    const forger = await connect(code);
    const forged = await join(forger, 'Forger', crypto.randomUUID(), 'not-a-real-hmac');

    const state = await storedState(code);
    expect(state?.participants[welcome.participantId]?.role).toBe('participant');
    expect(state?.participants[forged.participantId]?.role).toBe('participant');
  });
});

describe('join / tokens', () => {
  it('rejects a tampered participantToken with error{code: "auth"}', async () => {
    const { code } = await createSession();
    const socket = await connect(code);
    await join(socket, 'Facilitator');

    socket.send({ type: 'startGame', intentId: crypto.randomUUID(), participantId: 'x', token: 'tampered.token' });
    const error = await socket.next();
    expect(error).toMatchObject({ type: 'error', code: 'auth' });
  });

  it('lets two participants named "Dave Smith" coexist with distinct UUIDs and avatarHues', async () => {
    const { code } = await createSession();
    const socket1 = await connect(code);
    const p1 = await join(socket1, 'Dave Smith');
    const socket2 = await connect(code);
    const p2 = await join(socket2, 'Dave Smith');

    expect(p1.participantId).not.toBe(p2.participantId);
    const state = await storedState(code);
    expect(state?.participants[p1.participantId]?.avatarHue).not.toBe(state?.participants[p2.participantId]?.avatarHue);
  });
});

describe('rejoin', () => {
  it('returns a full state snapshot, flips connected: true, and survives a simulated DO eviction + wake', async () => {
    const { code } = await createSession();
    const socket1 = await connect(code);
    const { participantId, participantToken } = await join(socket1, 'Facilitator');

    await evictDurableObject(stubFor(code));

    const socket2 = await connect(code);
    socket2.send({ type: 'rejoin', intentId: crypto.randomUUID(), participantId, token: participantToken });
    const stateEvent = await socket2.next();
    expect(stateEvent.type).toBe('state');
    const state = (stateEvent as { state: SessionState }).state;
    expect(state.participants[participantId]?.connected).toBe(true);
    expect(Object.keys(state.participants)).toHaveLength(1);
  });

  // Tenet 6 vs Invariant 5: an idempotent reconnect retry reuses its intentId, which the
  // reducer correctly treats as a no-op emitting no events. The socket must still resync.
  it('answers a replayed rejoin intentId with a full snapshot instead of hanging', async () => {
    const { code } = await createSession();
    const socket1 = await connect(code);
    const { participantId, participantToken } = await join(socket1, 'Facilitator');

    const intentId = crypto.randomUUID();
    const rejoin = { type: 'rejoin', intentId, participantId, token: participantToken };

    const socket2 = await connect(code);
    socket2.send(rejoin);
    expect((await socket2.next()).type).toBe('state');

    // Same intentId again — the reducer no-ops, but this socket still gets its snapshot.
    socket2.send(rejoin);
    const replayed = await socket2.next();
    expect(replayed.type).toBe('state');
    expect((replayed as { state: SessionState }).state.participants[participantId]?.connected).toBe(true);
  });

  it('does not send the rejoining socket a duplicate snapshot', async () => {
    const { code } = await createSession();
    const socket1 = await connect(code);
    const { participantId, participantToken } = await join(socket1, 'Facilitator');

    const socket2 = await connect(code);
    socket2.send({ type: 'rejoin', intentId: crypto.randomUUID(), participantId, token: participantToken });
    expect((await socket2.next()).type).toBe('state');

    const race = await Promise.race([
      socket2.next().then(() => 'message'),
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 100)),
    ]);
    expect(race).toBe('timeout');
    expect(socket2.received).toBe(1);
  });
});

describe('config lock', () => {
  it('accepts updateConfig in lobby and rejects it once active', async () => {
    const { code, creatorToken } = await createSession();
    const socket = await connect(code);
    const { participantId, participantToken } = await join(socket, 'Facilitator', crypto.randomUUID(), creatorToken);
    const stateAfterJoin = await storedState(code);
    const config = stateAfterJoin!.config;

    socket.send({
      type: 'updateConfig',
      intentId: crypto.randomUUID(),
      participantId,
      token: participantToken,
      config: { ...config, title: 'Renamed' },
    });
    const patch = await socket.next();
    expect(patch).toMatchObject({ type: 'patch', patch: { config: { title: 'Renamed' } } });

    socket.send({ type: 'startGame', intentId: crypto.randomUUID(), participantId, token: participantToken });
    await socket.next(); // phase patch

    socket.send({
      type: 'updateConfig',
      intentId: crypto.randomUUID(),
      participantId,
      token: participantToken,
      config: { ...config, title: 'Too late' },
    });
    const rejection = await socket.next();
    expect(rejection).toMatchObject({ type: 'error', code: 'LOCKED' });
  });
});

describe('reveal gating', () => {
  it('rejects a reveal for a round above gate.openRound', async () => {
    const { code, creatorToken } = await createSession();
    const socket = await connect(code);
    const { participantId, participantToken } = await join(socket, 'Facilitator', crypto.randomUUID(), creatorToken);

    socket.send({ type: 'setGate', intentId: crypto.randomUUID(), participantId, token: participantToken, round: 1 });
    await socket.next(); // gate patch

    socket.send({
      type: 'reveal',
      intentId: crypto.randomUUID(),
      participantId,
      token: participantToken,
      round: 2,
      snapshot: { cards: [], ranked: true, revealedAt: Date.now() },
    });
    const rejection = await socket.next();
    expect(rejection).toMatchObject({ type: 'error', code: 'GATE_CLOSED' });
  });
});

describe('privacy (Invariant 1)', () => {
  it('never stores or broadcasts card contents before a reveal', async () => {
    const { code } = await createSession();
    const socket = await connect(code);
    await join(socket, 'Facilitator');

    const state = await storedState(code);
    // Before any reveal, no participant has a reveals bucket at all — the server never
    // receives (and so never stores or broadcasts) a card choice pre-reveal.
    expect(state?.reveals).toEqual({});
  });
});

describe('expiry', () => {
  it('purges all storage at the 24h alarm; a subsequent connect gets error{code: "not_found"}', async () => {
    const { code } = await createSession();
    const socket = await connect(code);
    await join(socket, 'Facilitator');

    const ran = await runDurableObjectAlarm(stubFor(code));
    expect(ran).toBe(true);

    const socket2 = await connect(code);
    const error = await socket2.next();
    expect(error).toMatchObject({ type: 'error', code: 'not_found' });

    expect(await storedState(code)).toBeUndefined();
  });
});

describe('dev state dump route', () => {
  // The e2e privacy suite needs this route to inspect real persisted storage, but it must
  // not exist in production: with no auth beyond a 6-char code it would expose every
  // participant's UUID, display name, role and progress (and reveal snapshots from 02.2).
  // `party/vitest.config.ts` deliberately does NOT set DEV_STATE_DUMP, so this asserts the
  // production posture — only the e2e harness opts in, via playwright.config.ts.
  it('404s when DEV_STATE_DUMP is unset', async () => {
    const { code } = await createSession();
    const socket = await connect(code);
    await join(socket, 'Facilitator');

    const response = await SELF.fetch(`http://test/api/session/${code}/dump`);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('Facilitator');
  });
});
