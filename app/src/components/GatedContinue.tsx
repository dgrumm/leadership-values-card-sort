import type { SessionState } from '@values-cards/shared';
import { Button } from './Button';

export interface GatedContinueProps {
  gate: SessionState['gate'];
  /** The round the participant is about to advance into. */
  nextRound: number;
  onContinue: () => void;
}

/**
 * The round-complete interstitial's Continue button, blocked while the facilitator's
 * `gate` hasn't opened `nextRound` yet (spec 02.1; the gate control itself is 03.4).
 */
export function GatedContinue({ gate, nextRound, onContinue }: GatedContinueProps) {
  const blocked = gate !== null && nextRound > gate.openRound;

  return (
    <div className="flex flex-col items-center gap-2">
      {blocked ? <p role="status">Waiting for Round {nextRound} to open</p> : null}
      <Button onClick={onContinue} disabled={blocked}>
        Continue
      </Button>
    </div>
  );
}
