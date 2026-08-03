import { beforeEach, describe, expect, it } from 'vitest';
import type { GameConfig } from '@values-cards/shared';
import { createSortStore } from './createSortStore';

function deckConfig(count: number): GameConfig {
  return {
    title: 'Test',
    deck: {
      name: 'Deck',
      cards: Array.from({ length: count }, (_, i) => ({ value: `Card ${i}`, description: `Desc ${i}` })),
    },
    rounds: [{ name: 'Round 1', keep: 3, rank: false }],
    theme: { variant: 'default' },
    facilitated: false,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('createSortStore', () => {
  it('initializes the queue from the shuffled deck, kept/discarded empty', () => {
    const store = createSortStore('CODE1', 'p1', deckConfig(5));
    const state = store.getState();
    expect(state.round).toBe(1);
    expect(state.kept).toEqual([]);
    expect(state.discarded).toEqual([]);
    expect(state.queue).toHaveLength(5);
    expect(new Set(state.queue)).toEqual(new Set(['Card 0', 'Card 1', 'Card 2', 'Card 3', 'Card 4']));
  });

  it('shuffle is deterministic per participant+round and differs between participants', () => {
    const a1 = createSortStore('CODE1', 'participant-a', deckConfig(20)).getState().queue;
    const a2 = createSortStore('CODE2', 'participant-a', deckConfig(20)).getState().queue;
    const b1 = createSortStore('CODE1', 'participant-b', deckConfig(20)).getState().queue;
    expect(a1).toEqual(a2); // same participant+round -> same order, regardless of session
    expect(a1).not.toEqual(b1); // different participant -> different order
  });

  it('keep moves the head of the queue into kept and records lastAction', () => {
    const store = createSortStore('CODE1', 'p1', deckConfig(3));
    const first = store.getState().queue[0] as string;
    store.getState().keep(first);
    const state = store.getState();
    expect(state.kept).toEqual([first]);
    expect(state.queue).not.toContain(first);
    expect(state.lastAction).toEqual({ type: 'keep', cardId: first });
  });

  it('discard moves the head of the queue into discarded', () => {
    const store = createSortStore('CODE1', 'p1', deckConfig(3));
    const first = store.getState().queue[0] as string;
    store.getState().discard(first);
    const state = store.getState();
    expect(state.discarded).toEqual([first]);
    expect(state.queue).not.toContain(first);
  });

  it('ignores keep/discard for a card that is not the current head', () => {
    const store = createSortStore('CODE1', 'p1', deckConfig(3));
    const notHead = store.getState().queue[1] as string;
    store.getState().keep(notHead);
    expect(store.getState().kept).toEqual([]);
  });

  it('undo reverses a keep back to the front of the queue', () => {
    const store = createSortStore('CODE1', 'p1', deckConfig(3));
    const first = store.getState().queue[0] as string;
    store.getState().keep(first);
    store.getState().undo();
    const state = store.getState();
    expect(state.kept).toEqual([]);
    expect(state.queue[0]).toBe(first);
    expect(state.lastAction).toBeUndefined();
  });

  it('undo reverses a discard back to the front of the queue', () => {
    const store = createSortStore('CODE1', 'p1', deckConfig(3));
    const first = store.getState().queue[0] as string;
    store.getState().discard(first);
    store.getState().undo();
    const state = store.getState();
    expect(state.discarded).toEqual([]);
    expect(state.queue[0]).toBe(first);
  });

  it('undo is single-level: a second undo is a no-op', () => {
    const store = createSortStore('CODE1', 'p1', deckConfig(3));
    const [first, second] = store.getState().queue as [string, string];
    store.getState().keep(first);
    store.getState().keep(second);
    store.getState().undo();
    const afterOneUndo = store.getState();
    expect(afterOneUndo.kept).toEqual([first]);
    expect(afterOneUndo.queue[0]).toBe(second);

    store.getState().undo();
    const afterSecondUndo = store.getState();
    expect(afterSecondUndo).toEqual(afterOneUndo);
  });

  it('demote returns a kept card to the back of the queue', () => {
    const store = createSortStore('CODE1', 'p1', deckConfig(3));
    const [first, secondCard] = store.getState().queue as [string, string];
    store.getState().keep(first);
    store.getState().keep(secondCard);
    store.getState().demote(first);
    const state = store.getState();
    expect(state.kept).toEqual([secondCard]);
    expect(state.queue[state.queue.length - 1]).toBe(first);
  });

  it('undo reverses a demote back into kept at its original index', () => {
    const store = createSortStore('CODE1', 'p1', deckConfig(3));
    const [first, secondCard] = store.getState().queue as [string, string];
    store.getState().keep(first);
    store.getState().keep(secondCard);
    store.getState().demote(first);
    store.getState().undo();
    const state = store.getState();
    expect(state.kept).toEqual([first, secondCard]);
    expect(state.queue).not.toContain(first);
  });

  it('persists progress under the vc:<code>:<participantId>:sort localStorage key', () => {
    const store = createSortStore('ABC123', 'participant-x', deckConfig(3));
    const first = store.getState().queue[0] as string;
    store.getState().keep(first);
    const raw = localStorage.getItem('vc:ABC123:participant-x:sort');
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string) as { state: { kept: string[] } };
    expect(persisted.state.kept).toEqual([first]);
  });

  it('restores exact progress from localStorage on re-creation (refresh)', () => {
    const config = deckConfig(5);
    const first = createSortStore('ABC123', 'participant-x', config);
    const firstCard = first.getState().queue[0] as string;
    first.getState().keep(firstCard);
    const secondCard = first.getState().queue[0] as string;
    first.getState().discard(secondCard);

    const rehydrated = createSortStore('ABC123', 'participant-x', config);
    const state = rehydrated.getState();
    expect(state.kept).toEqual([firstCard]);
    expect(state.discarded).toEqual([secondCard]);
    expect(state.queue[0]).toBe(first.getState().queue[0]);
  });
});
