import { useEffect, useMemo, useState } from 'react';
import type { GameConfig } from '@values-cards/shared';
import type { SortStoreHook } from '../stores/createSortStore';
import { CardStack } from './CardStack';
import { KeptTray } from './KeptTray';
import { ProgressRail } from './ProgressRail';

export interface SortRoundProps {
  config: GameConfig;
  useSortStore: SortStoreHook;
}

/**
 * Config-driven sort screen: renders whichever round `config.rounds` and the
 * store's `round` point to. Owns only the active-sorting phase — once the
 * queue empties, the caller (routes/Sort, 01.4) reads the store's phase and
 * swaps this out for the round-complete/trim/rank/result screen instead, so
 * this renders nothing itself in that instant.
 */
export function SortRound({ config, useSortStore }: SortRoundProps) {
  const state = useSortStore();
  const roundCfg = config.rounds[state.round - 1];
  if (!roundCfg) {
    throw new Error(`no round ${state.round} configured`);
  }

  const cardsById = useMemo(
    () => new Map(config.deck.cards.map((card) => [card.value, card])),
    [config],
  );
  const total = config.deck.cards.length;
  const currentId = state.queue[0];
  const currentCard = currentId ? cardsById.get(currentId) : undefined;
  const nextCard = state.queue[1] ? cardsById.get(state.queue[1]) : undefined;
  const keptCards = state.kept.map((id) => cardsById.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
  const position = state.kept.length + state.discarded.length + 1;

  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    const action = state.lastAction;
    if (!action || action.type === 'demote') return;
    const card = cardsById.get(action.cardId);
    if (!card) return;
    const verb = action.type === 'keep' ? 'Kept' : 'Discarded';
    const countSuffix =
      action.type === 'keep'
        ? roundCfg.keep === 'any'
          ? `, ${state.kept.length} kept`
          : `, ${state.kept.length} of ${roundCfg.keep}`
        : '';
    setAnnouncement(`${verb} ${card.value}${countSuffix}`);
  }, [state.lastAction, cardsById, roundCfg.keep, state.kept.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'u' || (event.key === 'z' && (event.ctrlKey || event.metaKey))) {
        event.preventDefault();
        useSortStore.getState().undo();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [useSortStore]);

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-6 text-ink">
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
      <div className="flex flex-col items-center gap-1">
        <ProgressRail roundName={roundCfg.name} position={Math.min(position, total)} total={total} />
        {/* ponytail: a plain running total, not an animated discard-stack visual — nothing in the
            acceptance criteria requires the motion, and the count is what's load-bearing. */}
        <p className="text-xs text-ink-muted">{state.totalDiscarded + state.discarded.length} set aside</p>
      </div>
      {currentCard ? (
        <CardStack
          card={currentCard}
          nextCard={nextCard}
          // Nothing sorted this round yet = the participant has not begun, so the
          // deck opens face-down. Anything sorted means this is a resume and the
          // active card comes back face-up (invariant 4).
          resumed={state.kept.length + state.discarded.length > 0}
          remaining={state.queue.length}
          onKeep={() => useSortStore.getState().keep(currentCard.value)}
          onDiscard={() => useSortStore.getState().discard(currentCard.value)}
        />
      ) : null}
      <KeptTray
        cards={keptCards}
        limit={roundCfg.keep}
        onDemote={(cardId) => useSortStore.getState().demote(cardId)}
      />
    </main>
  );
}
