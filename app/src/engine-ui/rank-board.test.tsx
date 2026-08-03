import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Card } from '@values-cards/shared';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RankBoard } from './RankBoard';

// jsdom has no PointerEvent constructor, so @testing-library falls back to a
// plain Event that drops clientX/clientY/pointerId/isPrimary — dnd-kit's
// PointerSensor silently bails without them. Polyfill just enough of the
// real interface for a drag gesture to register.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    isPrimary: boolean;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.isPrimary = params.isPrimary ?? true;
    }
  }
  // @ts-expect-error jsdom doesn't implement PointerEvent at all.
  globalThis.PointerEvent = PointerEventPolyfill;
}

afterEach(cleanup);

const CARDS: Card[] = [
  { value: 'Courage', description: 'Acting despite fear' },
  { value: 'Curiosity', description: 'Seeking to understand' },
  { value: 'Integrity', description: 'Consistency of values and action' },
];

const ITEM_HEIGHT = 88;

// dnd-kit measures every sortable item's DOMRect to place the drag preview
// and resolve collisions. jsdom never lays anything out, so every element
// reports a zero-size rect by default — stub one that stacks each <li> by
// its live DOM position, which is exactly what a real vertical list looks
// like to dnd-kit's collision detection.
function stackListRects() {
  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function stubbedRect(this: Element) {
    const items: Element[] = Array.from(document.querySelectorAll('li'));
    const li: Element = this.closest('li') ?? this;
    const index = items.indexOf(li);
    const top = Math.max(index, 0) * ITEM_HEIGHT;
    return {
      x: 0,
      y: top,
      top,
      bottom: top + ITEM_HEIGHT,
      left: 0,
      right: 400,
      width: 400,
      height: ITEM_HEIGHT,
      toJSON() {
        return this;
      },
    } as DOMRect;
  };
  return () => {
    Element.prototype.getBoundingClientRect = original;
  };
}

function RankBoardFixture({ onConfirm = vi.fn() }: { onConfirm?: () => void }) {
  const [order, setOrder] = useState(CARDS);
  return (
    <RankBoard
      cards={order}
      onReorder={(ids) => setOrder(ids.map((id) => order.find((card) => card.value === id) as Card))}
      onConfirm={onConfirm}
    />
  );
}

describe('RankBoard', () => {
  let restoreRects: () => void;
  beforeEach(() => {
    restoreRects = stackListRects();
  });
  afterEach(() => restoreRects());

  it('renders cards in the given order with a 1-based position label', () => {
    render(<RankBoardFixture />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('1. Courage'),
      expect.stringContaining('2. Curiosity'),
      expect.stringContaining('3. Integrity'),
    ]);
  });

  it('reorders by keyboard sensor alone: space lifts, arrow moves, space drops', async () => {
    render(<RankBoardFixture />);
    const handle = screen.getByRole('button', { name: /Reorder Courage/ });
    handle.focus();
    await userEvent.keyboard('[Space]');
    await userEvent.keyboard('[ArrowDown]');
    await userEvent.keyboard('[Space]');

    const items = screen.getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('Curiosity');
    expect(items[1]?.textContent).toContain('Courage');
  });

  it('reorders by pointer drag', async () => {
    render(<RankBoardFixture />);
    const handle = screen.getByRole('button', { name: /Reorder Courage/ });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 10, clientY: 60 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 10, clientY: 130 });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 10, clientY: 130 });

    const items = screen.getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('Curiosity');
    expect(items[1]?.textContent).toContain('Courage');

    // dnd-kit swallows the synthetic click that trails a pointer drag by
    // stopping its propagation for 50ms after pointerup (browsers fire that
    // click regardless of drag) — let that window pass so it doesn't eat a
    // later test's real click in this same jsdom document.
    await new Promise((resolve) => setTimeout(resolve, 60));
  });

  it('final order lands with Confirm', () => {
    const onConfirm = vi.fn();
    render(<RankBoardFixture onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm order' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
