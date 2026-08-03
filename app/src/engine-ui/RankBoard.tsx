import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card } from '@values-cards/shared';
import { Button } from '../components/Button';

export interface RankBoardProps {
  /** Final cards, in current rank order (most important first). */
  cards: Card[];
  onReorder: (order: string[]) => void;
  onConfirm: () => void;
}

interface RankItemProps {
  card: Card;
  position: number;
}

function RankItem({ card, position }: RankItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.value,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition: transition ?? undefined }}
      className={`flex items-center gap-4 rounded-card bg-surface-raised p-4 shadow-card ${isDragging ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${card.value}, position ${position} of list`}
        aria-roledescription="sortable"
        className="flex min-h-11 min-w-11 shrink-0 cursor-grab items-center justify-center rounded-control text-xl text-ink-muted active:cursor-grabbing"
      >
        ⠿
      </button>
      <div>
        <p className="font-display font-semibold text-ink">
          {position}. {card.value}
        </p>
        {card.description ? <p className="text-sm text-ink-muted">{card.description}</p> : null}
      </div>
    </li>
  );
}

/**
 * Final round only (`rounds[last].rank === true`): drag-to-order the kept
 * cards with a pointer or the keyboard sensor alone (space to lift, arrows
 * to move, space to drop — dnd-kit defaults). A conditional phase of the
 * same sort flow, not a separate page.
 */
export function RankBoard({ cards, onReorder, onConfirm }: RankBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function titleFor(id: string): string {
    return cards.find((card) => card.value === id)?.value ?? String(id);
  }

  function positionFor(id: string): number {
    return cards.findIndex((card) => card.value === id) + 1;
  }

  const announcements: Announcements = {
    onDragStart({ active }) {
      return `Picked up ${titleFor(String(active.id))} at position ${positionFor(String(active.id))}.`;
    },
    onDragOver({ active, over }) {
      if (!over) return undefined;
      return `${titleFor(String(active.id))} moved to position ${positionFor(String(over.id))}.`;
    },
    onDragEnd({ active, over }) {
      if (!over) return `${titleFor(String(active.id))} dropped.`;
      return `${titleFor(String(active.id))} dropped at position ${positionFor(String(over.id))}.`;
    },
    onDragCancel({ active }) {
      return `Reordering ${titleFor(String(active.id))} cancelled.`;
    },
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = cards.findIndex((card) => card.value === active.id);
    const newIndex = cards.findIndex((card) => card.value === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(cards, oldIndex, newIndex).map((card) => card.value));
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-surface p-8 text-ink">
      <h1 className="font-display text-2xl font-semibold">Rank your final cards</h1>
      <p className="text-sm text-ink-muted">Drag to reorder, most important first.</p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{ announcements }}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={cards.map((card) => card.value)} strategy={verticalListSortingStrategy}>
          <ol className="flex w-full max-w-md flex-col gap-3">
            {cards.map((card, index) => (
              <RankItem key={card.value} card={card} position={index + 1} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <Button onClick={onConfirm}>Confirm order</Button>
    </main>
  );
}
