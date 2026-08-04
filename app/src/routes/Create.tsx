import { useEffect, useRef, useState } from 'react';
import { validateConfig, type Deck, type GameConfig } from '@values-cards/shared';
import { CLASSIC_TEMPLATE } from '@values-cards/decks/templates.js';
import { Button } from '../components/Button';
import { ConnectionPill } from '../session/ConnectionPill';
import { intents } from '../session/intents';
import { loadToken, saveCurrentCode } from '../session/tokens';
import { useSession } from '../session/useSession';
import { Designer } from './create/designer';
import { Lobby } from './lobby';

const CREATOR_TOKEN_KEY = (code: string) => `vc:${code}:creator`;

/** Landing's "Start a game" (PRD §4.1): template-first, with the full designer behind
 *  "Customize". Replaces the 01.2 dev-only quick-create stand-in. */
export function Create() {
  const [config, setConfig] = useState<GameConfig>(CLASSIC_TEMPLATE);
  const [titleTouched, setTitleTouched] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ code: string; creatorToken: string } | null>(null);

  const result = validateConfig(config);
  const canCreate = result.ok && name.trim().length > 0 && !creating;

  function handleDeckChange(deck: Deck) {
    setConfig((previous) => ({ ...previous, deck, title: titleTouched ? previous.title : `${deck.name} Sort` }));
  }

  async function createGame() {
    setCreating(true);
    setCreateError(null);
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      if (!response.ok) throw new Error('create failed');
      const body = (await response.json()) as { code: string; creatorToken: string };
      localStorage.setItem(CREATOR_TOKEN_KEY(body.code), body.creatorToken);
      setCreated(body);
    } catch {
      setCreateError('Could not create a game. Try again.');
    } finally {
      setCreating(false);
    }
  }

  if (created) {
    return <CreateLobby code={created.code} creatorToken={created.creatorToken} name={name.trim()} />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-8 text-ink">
      <h1 className="font-display text-3xl font-semibold">Start a game</h1>

      <label className="flex w-full max-w-sm flex-col gap-1 text-sm font-semibold" htmlFor="creator-name">
        Your name
        <input
          id="creator-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded-control border border-ink-muted bg-surface-raised px-3 py-2 text-ink"
        />
      </label>

      {!customizing ? (
        <section className="flex w-full max-w-sm flex-col gap-3 rounded-control border border-ink-muted bg-surface-raised p-4">
          <h2 className="font-display text-xl font-semibold">{config.title}</h2>
          <p className="text-sm text-ink-muted">
            {config.deck.name} ({config.deck.cards.length} cards) · {config.rounds.map((round) => round.name).join(' → ')}
          </p>
          <Button type="button" variant="secondary" onClick={() => setCustomizing(true)}>
            Customize
          </Button>
        </section>
      ) : (
        <div className="w-full max-w-sm">
          <Designer
            config={config}
            onTitleChange={(title) => {
              setTitleTouched(true);
              setConfig((previous) => ({ ...previous, title }));
            }}
            onDeckChange={handleDeckChange}
            onRoundsChange={(rounds) => setConfig((previous) => ({ ...previous, rounds }))}
            onFacilitatedChange={(facilitated) => setConfig((previous) => ({ ...previous, facilitated }))}
          />
        </div>
      )}

      {createError ? (
        <p role="alert" className="text-danger">
          {createError}
        </p>
      ) : null}

      {/* Surface WHY the button is disabled — a silently-dead "Create game" with no
          explanation read as a broken button (the empty-name case in particular). */}
      {!result.ok ? (
        <p className="text-sm text-danger">{result.errors[0]?.message ?? 'Fix the game settings to continue.'}</p>
      ) : name.trim().length === 0 ? (
        <p className="text-sm text-ink-muted">Enter your name to create the game.</p>
      ) : null}

      <Button type="button" onClick={createGame} disabled={!canCreate}>
        {creating ? 'Creating…' : 'Create game'}
      </Button>
    </main>
  );
}

/** Joins the freshly created session as its facilitator, then hands off to the shared
 *  `Lobby` — mirrors `Join.tsx`'s `JoiningSession`, the only other place a socket join
 *  happens, rather than a second connect-and-join implementation. */
function CreateLobby({ code, creatorToken, name }: { code: string; creatorToken: string; name: string }) {
  const { state, connection, send } = useSession(code);
  const sentJoinRef = useRef(false);

  useEffect(() => {
    if (connection !== 'live') return;
    if (sentJoinRef.current) return;
    sentJoinRef.current = true;
    send(intents.join(name), creatorToken);
  }, [connection, name, send, creatorToken]);

  useEffect(() => {
    const token = loadToken(code);
    // Mirror Join.tsx's hand-off exactly: `/sort` decides real-session vs. local demo by
    // `loadCurrentCode()`, so the creator MUST record the code here too — without it the
    // facilitator dropped into the standalone demo sort, disconnected from its own session.
    // Gate on `connection === 'live'` and defer so the just-sent `startGame` flushes before
    // the full-document navigation tears the socket down.
    if (!token || !state || connection !== 'live') return;
    if (state.phase === 'active') {
      saveCurrentCode(code);
      setTimeout(() => window.location.assign('/sort'), 100);
    }
  }, [state, code, connection]);

  const token = loadToken(code);
  if (!state || !token || !state.participants[token.participantId]) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-ink">
        <ConnectionPill connection={connection} />
        <h1 className="font-display text-2xl font-semibold">Creating your game…</h1>
      </main>
    );
  }

  return (
    <>
      <ConnectionPill connection={connection} />
      <Lobby code={code} state={state} participantId={token.participantId} send={send} />
    </>
  );
}
