import { useEffect, useMemo, useRef } from 'react';
import { GameConfigSchema, type Card, type GameConfig, type SessionState } from '@values-cards/shared';
import { Button } from '../components/Button';
import { GameCard } from '../components/GameCard';
import { GatedContinue } from '../components/GatedContinue';
import { RevealControl } from '../components/RevealControl';
import { Roster } from '../components/Roster';
import { Toast } from '../components/Toast';
import { RankBoard } from '../engine-ui/RankBoard';
import { SortRound } from '../engine-ui/SortRound';
import { TrimGrid } from '../engine-ui/TrimGrid';
import { intents } from '../session/intents';
import { computeProgress, createMilestoneReporter } from '../session/milestones';
import { loadCurrentCode, loadToken } from '../session/tokens';
import { ConnectionPill } from '../session/ConnectionPill';
import type { UseSessionResult } from '../session/useSession';
import { useSession } from '../session/useSession';
import { createSortStore, getPhase, type SortStoreHook } from '../stores/createSortStore';

// Placeholder session identity for the standalone local demo below (no join, no DO) —
// this predates 01.2's real client session layer and is kept only so the existing demo
// journeys (solo-journey, sort-*, round-flow-refresh) keep exercising the sort loop
// in isolation. A real joined session (Join.tsx) takes the `SessionSort` path instead.
const SESSION_CODE = 'DEMO01';
const PARTICIPANT_ID_KEY = 'vc:demo:participantId';

// dev-12 (decks/decks/dev-12.json), two rounds: 12 -> keep 8 -> keep 3
// (ranked) — this is also the fixture the 01.4 acceptance E2E (solo-journey,
// round-flow-refresh) drives, so trim and rank are always reachable from
// this one demo route.
const DEMO_CONFIG: GameConfig = GameConfigSchema.parse({
  title: 'Demo',
  deck: {
    name: 'Dev 12',
    cards: [
      { value: 'Caffeine', description: 'The fundamental belief that productivity is directly proportional to coffee consumption' },
      { value: 'Snacks', description: 'Commitment to maintaining strategic reserves of treats for optimal team morale' },
      { value: 'Muting', description: 'The discipline to silence oneself before dogs, children, or doorbells interrupt meetings' },
      { value: 'Restraint', description: 'The wisdom to resist reply-all when someone microwaves fish in the office' },
      { value: 'Efficiency', description: 'The courage to end meetings that have veered into discussing weekend plans' },
      { value: 'Flexibility', description: 'The art of interpreting deadlines as gentle suggestions rather than fixed points' },
      { value: 'Lunch', description: 'The sacred practice of stepping away from one’s desk for actual nourishment' },
      { value: 'Emojis', description: 'The ability to convey professionalism while using the perfect amount of 👍 and 😊' },
      { value: 'Parking', description: 'The mystical force that guides one to spaces near the entrance, always' },
      { value: 'Friday', description: 'The superhuman strength to maintain focus despite the weekend’s gravitational pull' },
      { value: 'Spreadsheets', description: 'Finding enlightenment through pivot tables and conditional formatting' },
      { value: 'Cake', description: 'The moral duty to ensure equitable distribution of celebration desserts' },
    ],
  },
  rounds: [
    { name: 'Round 1', keep: 8, rank: false },
    { name: 'Round 2', keep: 3, rank: true },
  ],
  theme: { variant: 'default' },
  facilitated: false,
});

function getDemoParticipantId(): string {
  const existing = localStorage.getItem(PARTICIPANT_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(PARTICIPANT_ID_KEY, id);
  return id;
}

function cardsInOrder(ids: string[], byId: Map<string, Card>): Card[] {
  return ids.map((id) => byId.get(id)).filter((card): card is Card => !!card);
}

/**
 * Everything between "queue empty" and "final result" (01.4), driven by the
 * store's derived phase — trim and rank are conditional phases of this one
 * flow, never separate pages/routes.
 */
export function Sort() {
  const code = loadCurrentCode();
  return code ? <SessionSort code={code} /> : <DemoSort />;
}

/** A real joined session (02.1): lobby, roster, milestone reporting, gated rounds. */
function SessionSort({ code }: { code: string }) {
  const token = useMemo(() => loadToken(code), [code]);
  const { state, connection, send, error, clearError } = useSession(code);

  useEffect(() => {
    if (!token) window.location.assign(`/join/${code}`);
  }, [token, code]);

  // A rejected reveal (or any other intent) surfaces here without breaking the flow —
  // the participant stays exactly where they were (spec 02.2's "client remains functional").
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(clearError, 4000);
    return () => clearTimeout(timer);
  }, [error, clearError]);

  if (!token || !state) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface text-ink">
        <ConnectionPill connection={connection} />
        <p>Loading…</p>
      </main>
    );
  }

  const me = state.participants[token.participantId];
  if (!me) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface text-ink">
        <ConnectionPill connection={connection} />
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <>
      <ConnectionPill connection={connection} />
      {error ? (
        <div className="fixed inset-x-0 top-4 z-toast flex justify-center">
          <Toast message={error.message} variant="danger" />
        </div>
      ) : null}
      {state.phase === 'lobby' ? (
        <Lobby state={state} participantId={token.participantId} send={send} />
      ) : (
        <ActiveSort code={code} participantId={token.participantId} config={state.config} state={state} send={send} />
      )}
    </>
  );
}

function Lobby({ state, participantId, send }: { state: SessionState; participantId: string; send: UseSessionResult['send'] }) {
  const me = state.participants[participantId];
  const canStart = !state.config.facilitated || me?.role === 'facilitator';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface p-8 text-ink">
      <h1 className="font-display text-2xl font-semibold">{state.config.title}</h1>
      <p className="text-ink-muted">Waiting to start · code {state.code}</p>
      {/* 03.1 requires a joined participant to see the game's config in its lobby, and to
          see facilitator `updateConfig` edits arrive live. This is that lobby — 02.1 owns
          the pre-start participant experience, so there is one lobby, not two. */}
      <ol aria-label="Rounds" className="flex flex-col gap-1 text-center text-sm text-ink-muted">
        {state.config.rounds.map((round, index) => (
          <li key={`${index}-${round.name}`}>
            {round.name} · {round.keep === 'any' ? 'keep any' : `keep ${round.keep}`}
            {round.rank ? ' · ranked' : ''}
          </li>
        ))}
      </ol>
      <Roster participants={state.participants} selfId={participantId} />
      <Button onClick={() => send(intents.startGame(participantId))} disabled={!canStart} title={canStart ? undefined : 'Only the facilitator can start this game'}>
        Start game
      </Button>
    </main>
  );
}

function ActiveSort({
  code,
  participantId,
  config,
  state,
  send,
}: {
  code: string;
  participantId: string;
  config: GameConfig;
  state: SessionState;
  send: UseSessionResult['send'];
}) {
  const useSortStore = useMemo(() => createSortStore(code, participantId, config), [code, participantId, config]);
  const sortState = useSortStore();
  const phase = getPhase(sortState, config);
  const byId = useMemo(() => new Map(config.deck.cards.map((card) => [card.value, card])), [config]);

  // Milestones (invariant 2: counts only, never card ids/values) — debounced 500ms
  // trailing so a swipe burst collapses into one intent, flowing through 01.2's
  // offline queue like any other `send`.
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const reporter = createMilestoneReporter((progress) => {
      sendRef.current(intents.reportProgress(participantId, progress.round, progress.sorted, progress.kept, progress.done));
    });
    reporter.report(computeProgress(useSortStore.getState(), config));
    const unsubscribe = useSortStore.subscribe((next) => reporter.report(computeProgress(next, config)));
    return () => {
      unsubscribe();
      reporter.cancel();
    };
  }, [useSortStore, config, participantId]);

  return (
    <>
      <div className="fixed right-4 top-4 z-toast">
        <Roster participants={state.participants} selfId={participantId} collapsible />
      </div>
      <SortBody
        config={config}
        useSortStore={useSortStore}
        phase={phase}
        byId={byId}
        gate={state.gate}
        participantId={participantId}
        reveals={state.reveals[participantId] ?? {}}
        send={send}
      />
    </>
  );
}

function SortBody({
  config,
  useSortStore,
  phase,
  byId,
  gate,
  participantId,
  reveals,
  send,
}: {
  config: GameConfig;
  useSortStore: SortStoreHook;
  phase: ReturnType<typeof getPhase>;
  byId: Map<string, Card>;
  gate: SessionState['gate'];
  participantId: string;
  reveals: SessionState['reveals'][string];
  send: UseSessionResult['send'];
}) {
  const state = useSortStore();

  // Shared by both reveal surfaces (round-complete, result) — only which cards differ.
  function revealControlFor(roundCfg: GameConfig['rounds'][number], cards: Card[]) {
    return (
      <RevealControl
        round={state.round}
        roundName={roundCfg.name}
        ranked={roundCfg.rank}
        revealed={!!reveals[state.round]}
        dismissed={state.dismissedReveals.includes(state.round)}
        onDismiss={() => useSortStore.getState().dismissReveal(state.round)}
        onReveal={() =>
          send(intents.reveal(participantId, state.round, { cards, ranked: roundCfg.rank, revealedAt: Date.now() }))
        }
        onUnreveal={() => send(intents.unreveal(participantId, state.round))}
      />
    );
  }

  if (phase === 'sort') {
    return <SortRound config={config} useSortStore={useSortStore} />;
  }

  if (phase === 'round-complete') {
    const roundCfg = config.rounds[state.round - 1];
    const setAside = state.totalDiscarded + state.discarded.length;
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface p-8 text-center text-ink">
        <h1 className="font-display text-2xl font-semibold">{roundCfg?.name} complete</h1>
        <p className="text-ink-muted">
          {state.kept.length} kept · {setAside} set aside
        </p>
        <GatedContinue gate={gate} nextRound={state.round + 1} onContinue={() => useSortStore.getState().continueRound()} />
        {roundCfg ? revealControlFor(roundCfg, cardsInOrder(state.kept, byId)) : null}
      </main>
    );
  }

  if (phase === 'trim') {
    const roundCfg = config.rounds[state.round - 1];
    const limit = typeof roundCfg?.keep === 'number' ? roundCfg.keep : 0;
    return (
      <TrimGrid
        cards={cardsInOrder(state.kept, byId)}
        cut={state.cut}
        limit={limit}
        onToggleCut={(cardId) => useSortStore.getState().toggleCut(cardId)}
        onConfirm={() => useSortStore.getState().confirmTrim()}
      />
    );
  }

  if (phase === 'rank') {
    return (
      <RankBoard
        cards={cardsInOrder(state.ranking ?? state.kept, byId)}
        onReorder={(order) => useSortStore.getState().setRanking(order)}
        onConfirm={() => useSortStore.getState().confirmRank()}
      />
    );
  }

  // result — local-only plaque preview; wall (02.3) and export (04.1) build on this later.
  const finalRoundCfg = config.rounds[state.round - 1];
  const finalCards = cardsInOrder(state.ranking ?? state.kept, byId);
  const isRanked = finalRoundCfg?.rank === true;
  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-surface p-8 text-ink">
      <h1 className="font-display text-2xl font-semibold">{config.title}</h1>
      <p className="text-ink-muted">Your final cards</p>
      <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {finalCards.map((card, index) => (
          <li key={card.value} className="flex flex-col items-center gap-2">
            {isRanked ? <p className="text-sm font-semibold text-ink-muted">{index + 1}</p> : null}
            <GameCard title={card.value} description={card.description} />
          </li>
        ))}
      </ol>
      <div className="flex gap-4">
        {finalRoundCfg ? revealControlFor(finalRoundCfg, finalCards) : null}
        <Button variant="secondary" disabled title="Coming soon">
          Download
        </Button>
      </div>
    </main>
  );
}

/**
 * Standalone local demo (predates 01.2/02.1): no join, no DO, no roster — just the
 * config-driven sort loop for `/sort` visited directly. Byte-for-byte the previous
 * `Sort()` body, so the 01.3/01.4 acceptance journeys keep passing unchanged.
 */
function DemoSort() {
  const useSortStore = useMemo(() => {
    const participantId = getDemoParticipantId();
    return createSortStore(SESSION_CODE, participantId, DEMO_CONFIG);
  }, []);

  const state = useSortStore();
  const phase = getPhase(state, DEMO_CONFIG);
  const byId = useMemo(() => new Map(DEMO_CONFIG.deck.cards.map((card) => [card.value, card])), []);

  if (phase === 'sort') {
    return <SortRound config={DEMO_CONFIG} useSortStore={useSortStore} />;
  }

  if (phase === 'round-complete') {
    const roundCfg = DEMO_CONFIG.rounds[state.round - 1];
    const setAside = state.totalDiscarded + state.discarded.length;
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface p-8 text-center text-ink">
        <h1 className="font-display text-2xl font-semibold">{roundCfg?.name} complete</h1>
        <p className="text-ink-muted">
          {state.kept.length} kept · {setAside} set aside
        </p>
        <Button onClick={() => useSortStore.getState().continueRound()}>Continue</Button>
      </main>
    );
  }

  if (phase === 'trim') {
    const roundCfg = DEMO_CONFIG.rounds[state.round - 1];
    const limit = typeof roundCfg?.keep === 'number' ? roundCfg.keep : 0;
    return (
      <TrimGrid
        cards={cardsInOrder(state.kept, byId)}
        cut={state.cut}
        limit={limit}
        onToggleCut={(cardId) => useSortStore.getState().toggleCut(cardId)}
        onConfirm={() => useSortStore.getState().confirmTrim()}
      />
    );
  }

  if (phase === 'rank') {
    return (
      <RankBoard
        cards={cardsInOrder(state.ranking ?? state.kept, byId)}
        onReorder={(order) => useSortStore.getState().setRanking(order)}
        onConfirm={() => useSortStore.getState().confirmRank()}
      />
    );
  }

  // result — local-only plaque preview; reveal (02.2), wall (02.3) and
  // export (04.1) build on this later.
  const finalCards = cardsInOrder(state.ranking ?? state.kept, byId);
  const isRanked = DEMO_CONFIG.rounds[DEMO_CONFIG.rounds.length - 1]?.rank === true;
  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-surface p-8 text-ink">
      <h1 className="font-display text-2xl font-semibold">{DEMO_CONFIG.title}</h1>
      <p className="text-ink-muted">Your final cards</p>
      <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {finalCards.map((card, index) => (
          <li key={card.value} className="flex flex-col items-center gap-2">
            {isRanked ? <p className="text-sm font-semibold text-ink-muted">{index + 1}</p> : null}
            <GameCard title={card.value} description={card.description} />
          </li>
        ))}
      </ol>
      <div className="flex gap-4">
        <Button variant="secondary" disabled title="Coming soon">
          Reveal
        </Button>
        <Button variant="secondary" disabled title="Coming soon">
          Download
        </Button>
      </div>
    </main>
  );
}
