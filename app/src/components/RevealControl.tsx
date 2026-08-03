import { useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

/** Global (not per-session) — the explainer is about what reveal *means*, seen once per browser. */
const EXPLAINER_SEEN_KEY = 'vc:reveal-explainer-seen';

function hasSeenRevealExplainer(): boolean {
  return localStorage.getItem(EXPLAINER_SEEN_KEY) === '1';
}

function markRevealExplainerSeen(): void {
  localStorage.setItem(EXPLAINER_SEEN_KEY, '1');
}

export interface RevealControlProps {
  round: number;
  roundName: string;
  ranked: boolean;
  revealed: boolean;
  dismissed: boolean;
  onDismiss: () => void;
  onReveal: () => void;
  onUnreveal: () => void;
}

/**
 * The reveal prompt/explainer/revealed-state control shown on the round-complete
 * interstitial and the result screen (02.2). Building the snapshot from local sort
 * state and dispatching the intent is the caller's job — this owns only the UI and
 * the one-time explainer gate.
 */
export function RevealControl({
  round,
  roundName,
  ranked,
  revealed,
  dismissed,
  onDismiss,
  onReveal,
  onUnreveal,
}: RevealControlProps) {
  const [explainerOpen, setExplainerOpen] = useState(false);

  function startReveal() {
    if (hasSeenRevealExplainer()) {
      onReveal();
    } else {
      setExplainerOpen(true);
    }
  }

  function confirmExplainer() {
    markRevealExplainerSeen();
    setExplainerOpen(false);
    onReveal();
  }

  if (revealed) {
    return (
      <div className="flex items-center gap-3">
        <p role="status">Shared ✓</p>
        <Button variant="secondary" size="sm" onClick={onUnreveal}>
          Un-reveal
        </Button>
      </div>
    );
  }

  return (
    <>
      {dismissed ? null : (
        <div className="flex items-center gap-3">
          <p className="text-ink-muted">Share your {roundName} result?</p>
          <Button size="sm" onClick={startReveal}>
            Reveal
          </Button>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Not now
          </Button>
        </div>
      )}
      <Modal open={explainerOpen} onClose={() => setExplainerOpen(false)} title="Sharing your result">
        <div className="flex flex-col gap-4">
          <p className="text-ink-muted">
            Revealing round {round} shares your kept cards{ranked ? ' and their order' : ''} and your name
            with the group. Nothing else — cards you haven&apos;t kept, and any round you don&apos;t reveal,
            stay on this device.
          </p>
          <Button onClick={confirmExplainer}>Got it, share</Button>
        </div>
      </Modal>
    </>
  );
}
