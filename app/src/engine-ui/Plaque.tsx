import type { Card } from '@values-cards/shared';
import { Avatar } from '../components/Avatar';
import { plaqueLayout } from './plaque-layout';

export interface PlaqueProps {
  name: string;
  avatarHue: number;
  gameTitle: string;
  cards: Card[];
  ranked: boolean;
}

/**
 * One revealed result, rendered as a portable artifact: participant name + avatar,
 * game title, that round's cards (order badges when ranked). Flexbox only, no
 * grid/filters (architecture §12) — 04.1's satori export reads the same
 * `plaque-layout.ts` data to render the identical artifact, so nothing here may use
 * a CSS feature satori can't render. Purely presentational: the wall (02.3) owns
 * spotlight affordances and round switching around this component, not inside it.
 */
export function Plaque({ name, avatarHue, gameTitle, cards, ranked }: PlaqueProps) {
  return (
    <div
      className="flex flex-col rounded-card bg-surface-raised shadow-card"
      style={{ width: plaqueLayout.width, padding: plaqueLayout.padding, gap: plaqueLayout.gap }}
    >
      <div className="flex items-center" style={{ gap: plaqueLayout.headerGap }}>
        <Avatar name={name} hue={avatarHue} />
        <div className="flex flex-col">
          <p className="font-display font-semibold text-ink" style={{ fontSize: plaqueLayout.nameSize }}>
            {name}
          </p>
          <p className="text-ink-muted" style={{ fontSize: plaqueLayout.titleSize }}>
            {gameTitle}
          </p>
        </div>
      </div>
      <div role="list" className="flex flex-wrap" style={{ gap: plaqueLayout.cardGap }}>
        {cards.map((card, index) => (
          <div
            key={card.value}
            role="listitem"
            className="flex flex-col items-center justify-center gap-1 rounded-control bg-accent-subtle text-center"
            style={{ width: plaqueLayout.cardWidth, height: plaqueLayout.cardHeight, padding: plaqueLayout.cardGap }}
          >
            {ranked ? (
              <span
                aria-hidden="true"
                className="flex items-center justify-center rounded-full bg-accent font-semibold text-on-accent"
                style={{ width: plaqueLayout.badgeSize, height: plaqueLayout.badgeSize, fontSize: plaqueLayout.titleSize }}
              >
                {index + 1}
              </span>
            ) : null}
            <p className="font-display font-semibold text-ink" style={{ fontSize: plaqueLayout.titleSize }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
