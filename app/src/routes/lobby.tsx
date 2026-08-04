import { useState } from 'react';
import { validateConfig, type GameConfig, type Intent, type SessionState } from '@values-cards/shared';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { intents } from '../session/intents';
import { Designer } from './create/designer';

export interface LobbyProps {
  code: string;
  state: SessionState;
  participantId: string;
  send: (intent: Intent) => void;
}

/**
 * The shared waiting room for everyone in `phase: 'lobby'` — creator and joiners
 * alike (spec 03.1). Shows the code/share link and roster to all; only the
 * facilitator gets the reopen-designer and start-game controls, and both
 * disappear the instant the server locks config (tenet: server-enforced, UI
 * reflects it, never re-derives it).
 */
export function Lobby({ code, state, participantId, send }: LobbyProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<GameConfig>(state.config);
  const [copied, setCopied] = useState(false);

  const self = state.participants[participantId];
  const isFacilitator = self?.role === 'facilitator';
  const shareLink = `${window.location.origin}/join/${code}`;

  function openEditor() {
    setDraft(state.config);
    setEditing(true);
  }

  function saveEditor() {
    send(intents.updateConfig(participantId, draft));
    setEditing(false);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const draftValid = validateConfig(draft).ok;

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 p-8 text-ink">
      <div className="glass-panel-strong flex w-full max-w-md flex-col items-center gap-8 rounded-sheet p-8">
        <h1 className="font-display text-2xl font-semibold">{state.config.title}</h1>

        <section className="flex flex-col items-center gap-3">
          <p className="font-display text-5xl font-bold tracking-widest">{code}</p>
          <div className="flex items-center gap-2">
            <input readOnly value={shareLink} aria-label="Share link" className="rounded-control border border-ink-muted glass-panel-strong px-3 py-2 text-sm text-ink" />
            <Button type="button" variant="secondary" size="sm" onClick={copyLink}>
              Copy link
            </Button>
          </div>
          {copied ? <Toast message="Link copied" variant="success" /> : null}
        </section>

        <section className="w-full text-center">
          <h2 className="mb-2 font-display text-lg font-semibold">Game</h2>
          <p className="text-sm text-ink-muted">
            {state.config.deck.name} ({state.config.deck.cards.length} cards) ·{' '}
            {state.config.rounds.map((round) => round.name).join(' → ')}
          </p>
        </section>

        <section className="w-full">
          <h2 className="mb-2 font-display text-lg font-semibold">Players</h2>
          <ul className="flex flex-col gap-2">
            {Object.entries(state.participants).map(([id, participant]) => (
              <li key={id} className="flex items-center justify-between rounded-control border border-ink-muted glass-panel-strong px-3 py-2">
                <span>{participant.name}</span>
                <span className="text-sm text-ink-muted">{participant.role === 'facilitator' ? 'Facilitator' : 'Participant'}</span>
              </li>
            ))}
          </ul>
        </section>

        {state.phase !== 'lobby' ? <p className="text-ink-muted">Config is locked — the game has started.</p> : null}

        {isFacilitator && state.phase === 'lobby' ? (
          <div className="flex gap-4">
            <Button type="button" variant="secondary" onClick={openEditor}>
              Edit game
            </Button>
            <Button type="button" onClick={() => send(intents.startGame(participantId))}>
              Start game
            </Button>
          </div>
        ) : null}
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit game">
        <div className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto">
          <Designer
            config={draft}
            onTitleChange={(title) => setDraft({ ...draft, title })}
            onDeckChange={(deck) => setDraft({ ...draft, deck })}
            onRoundsChange={(rounds) => setDraft({ ...draft, rounds })}
            onFacilitatedChange={(facilitated) => setDraft({ ...draft, facilitated })}
          />
          <Button type="button" onClick={saveEditor} disabled={!draftValid}>
            Save changes
          </Button>
        </div>
      </Modal>
    </main>
  );
}
