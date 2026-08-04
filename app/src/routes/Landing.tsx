export function Landing() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 text-ink">
      <h1 className="text-5xl font-bold tracking-tight">Values Cards</h1>
      <p className="text-ink-muted">Sort what matters. Keep what counts.</p>
      <nav aria-label="Get started" className="flex gap-4">
        <a
          href="/create"
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
