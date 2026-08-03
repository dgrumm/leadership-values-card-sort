import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { ConnectionPill } from '../session/ConnectionPill';
import { intents } from '../session/intents';
import { loadToken, saveCurrentCode } from '../session/tokens';
import { useSession } from '../session/useSession';
import { Lobby } from './lobby';

const CODE_PATTERN = /^[A-Z0-9]{6}$/;
const CREATOR_TOKEN_KEY = (code: string) => `vc:${code}:creatorToken`;

export interface JoinProps {
  /** Pre-filled from `/join/:code`. */
  code?: string;
}

/** Code + display-name join form. A same-browser revisit with a stored token skips
 *  straight to resuming — no form, no name prompt (PRD invariant 4, membership half). */
export function Join({ code: initialCode }: JoinProps) {
  const [code, setCode] = useState((initialCode ?? '').toUpperCase());
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const resuming = CODE_PATTERN.test(code) && loadToken(code) !== null;

  async function quickCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error('create failed');
      const created = (await response.json()) as { code: string; creatorToken: string };
      sessionStorage.setItem(CREATOR_TOKEN_KEY(created.code), created.creatorToken);
      setCode(created.code);
    } catch {
      setCreateError('Could not create a session. Try again.');
    } finally {
      setCreating(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!CODE_PATTERN.test(code) || name.trim().length === 0) return;
    setSubmitted(true);
  }

  if (resuming || submitted) {
    return <JoiningSession code={code} name={name} />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface p-8 text-ink">
      <h1 className="font-display text-3xl font-semibold">Join a game</h1>
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-semibold" htmlFor="session-code">
          Session code
          <input
            id="session-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={6}
            required
            className="rounded-control border border-ink-muted bg-surface-raised px-4 py-2 text-lg uppercase tracking-widest text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold" htmlFor="display-name">
          Display name
          <input
            id="display-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="rounded-control border border-ink-muted bg-surface-raised px-4 py-2 text-ink"
          />
        </label>
        <Button type="submit">Join</Button>
      </form>
      {createError ? (
        <p role="alert" className="text-danger">
          {createError}
        </p>
      ) : null}
      {import.meta.env.DEV ? (
        <Button variant="ghost" size="sm" onClick={quickCreate} disabled={creating}>
          {creating ? 'Creating…' : 'Dev: quick create session'}
        </Button>
      ) : null}
    </main>
  );
}

function JoiningSession({ code, name }: { code: string; name: string }) {
  const { state, connection, send } = useSession(code);
  const alreadyJoined = loadToken(code) !== null;
  const sentJoinRef = useRef(false);

  useEffect(() => {
    if (alreadyJoined) return; // the hook sends `rejoin` itself once its socket opens
    if (connection !== 'live') return;
    if (sentJoinRef.current) return;
    sentJoinRef.current = true;
    const creatorToken = sessionStorage.getItem(CREATOR_TOKEN_KEY(code)) ?? undefined;
    send(intents.join(name), creatorToken);
  }, [connection, code, name, alreadyJoined, send]);

  useEffect(() => {
    const token = loadToken(code);
    // Gating on `connection === 'live'` (not just `state` presence) matters: 'live' is the
    // same transition that just flushed the offline intent queue (useSession.ts), and
    // `ws.send()` only hands a frame to the network stack — it doesn't block until the
    // frame is actually transmitted. Navigating away too soon after a flush can tear the
    // page down mid-transmission and silently drop it (spec 02.1's e2e/reconnect.spec.ts
    // caught this losing a queued `reportProgress`); a short delay gives the browser time
    // to actually get the flushed frame(s) onto the wire before the document unloads.
    // TODO: the delay becomes unnecessary once a client-side router replaces the full
    // document navigation here — there's no teardown to race then.
    if (!token || !state || connection !== 'live') return;
    // 02.1 owns the pre-start participant experience and places the lobby in `routes/Sort`'s
    // pre-start state, so a joined participant hands off to /sort immediately and waits
    // there. 03.1's `routes/lobby` remains the *creator's* lobby on /create.
    if (state.participants[token.participantId]) {
      // `/sort` reads this to resume the real joined session (02.1) instead of its
      // standalone local demo — see routes/Sort.tsx.
      saveCurrentCode(code);
      setTimeout(() => window.location.assign('/sort'), 100);
    }
  }, [state, code, connection]);

  const token = loadToken(code);
  if (state && token && state.participants[token.participantId]) {
    return (
      <>
        <ConnectionPill connection={connection} />
        <Lobby code={code} state={state} participantId={token.participantId} send={send} />
      </>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface p-8 text-ink">
      <ConnectionPill connection={connection} />
      <h1 className="font-display text-2xl font-semibold">Joining {code}…</h1>
      {alreadyJoined ? <p className="text-ink-muted">Resuming your session.</p> : null}
    </main>
  );
}
