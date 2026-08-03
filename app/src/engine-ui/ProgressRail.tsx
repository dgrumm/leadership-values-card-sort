export interface ProgressRailProps {
  roundName: string;
  position: number;
  total: number;
}

/** Round name + position in deck, e.g. "Round 1 · 12 of 40". */
export function ProgressRail({ roundName, position, total }: ProgressRailProps) {
  return (
    <p className="text-sm font-semibold text-ink">
      {roundName} · {position} of {total}
    </p>
  );
}
