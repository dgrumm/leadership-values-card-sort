import { useMemo } from 'react';
import { GameConfigSchema, type Card, type GameConfig } from '@values-cards/shared';
import { Button } from '../components/Button';
import { GameCard } from '../components/GameCard';
import { RankBoard } from '../engine-ui/RankBoard';
import { SortRound } from '../engine-ui/SortRound';
import { TrimGrid } from '../engine-ui/TrimGrid';
import { createSortStore, getPhase } from '../stores/createSortStore';

// Placeholder session identity until 01.2 (client session layer) wires a
// real join flow. The sort loop itself is fully local and config-driven —
// this route just needs *some* session code + participant id + config to
// demonstrate it.
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
            <GameCard title={card.value} description={card.description} size="md" />
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
