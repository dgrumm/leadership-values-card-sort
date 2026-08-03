/**
 * "Start a session" is a dev-only stand-in for the real create flow (03.1): it calls
 * `POST /api/session` with the classic template, stashes the minted `creatorToken`
 * for the join form to pick up, then hands off to `/join/:code`.
 */
async function startSession(event: React.MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  try {
    const response = await fetch('/api/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    if (!response.ok) return;
    const { code, creatorToken } = (await response.json()) as { code: string; creatorToken: string };
    sessionStorage.setItem(`vc:${code}:creatorToken`, creatorToken);
    window.location.assign(`/join/${code}`);
  } catch {
    // Dev-only convenience ahead of 03.1's real create flow — fail silently, the
    // "Start a session" link still degrades to the join form via its href.
  }
}

export function Landing() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-surface text-ink">
      <h1 className="text-5xl font-bold tracking-tight">Values Cards</h1>
      <p className="text-ink-muted">Sort what matters. Keep what counts.</p>
      <nav aria-label="Get started" className="flex gap-4">
        <a
          href="/join"
          onClick={startSession}
          className="rounded-lg bg-accent px-6 py-3 font-semibold text-on-accent"
        >
          Start a session
        </a>
        <a
          href="/join"
          className="rounded-lg border border-ink-muted px-6 py-3 font-semibold text-ink"
        >
          Join a session
        </a>
      </nav>
    </main>
  );
}
