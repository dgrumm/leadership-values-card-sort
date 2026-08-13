import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { RevealSnapshot, SessionState } from '@values-cards/shared';
import { Button } from '../../components/Button';
import { Roster } from '../../components/Roster';
import { Toast } from '../../components/Toast';
import { Plaque } from '../../engine-ui/Plaque';
import { intents } from '../../session/intents';
import { ConnectionPill } from '../../session/ConnectionPill';
import { loadToken } from '../../session/tokens';
import type { UseSessionResult } from '../../session/useSession';
import { useSession } from '../../session/useSession';
import { fadeOnlyVariants, transition, useMotionSafe } from '../../theme/motion';

export interface WallProps {
  code: string;
}

/**
 * `/wall/:code` (02.3): the shared results gallery. Reachable by every joined
 * participant — including one who has revealed nothing — via the same session
 * connection sort screens use, so reveals/un-reveals arrive live through `patch`
 * events with no extra plumbing.
 */
export function Wall({ code }: WallProps) {
  const token = useMemo(() => loadToken(code), [code]);
  const { state, connection, send, error, clearError } = useSession(code);

  useEffect(() => {
    if (!token) window.location.assign(`/join/${code}`);
  }, [token, code]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(clearError, 4000);
    return () => clearTimeout(timer);
  }, [error, clearError]);

  if (!token || !state || !state.participants[token.participantId]) {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink">
        <ConnectionPill connection={connection} />
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <>
      <ConnectionPill connection={connection} />
      {error ? (
        <div className="fixed inset-x-0 top-4 z-toast flex justify-center">
          <Toast message={error.message} variant="danger" />
        </div>
      ) : null}
      <WallBody state={state} participantId={token.participantId} send={send} />
    </>
  );
}

interface WallTileData {
  participantId: string;
  name: string;
  avatarHue: number;
  rounds: number[];
  reveals: Record<number, RevealSnapshot>;
}

function buildTiles(state: SessionState): WallTileData[] {
  return Object.entries(state.reveals)
    .filter(([, rounds]) => Object.keys(rounds).length > 0)
    .map(([participantId, rounds]) => {
      const participant = state.participants[participantId];
      return {
        participantId,
        name: participant?.name ?? 'Unknown',
        avatarHue: participant?.avatarHue ?? 0,
        rounds: Object.keys(rounds)
          .map(Number)
          .sort((a, b) => a - b),
        reveals: rounds,
      };
    });
}

/** Presentational body — kept separate from `Wall` so it's testable without a real
 *  WebSocket (mirrors routes/Sort.tsx's SortBody split). */
export function WallBody({
  state,
  participantId,
  send,
}: {
  state: SessionState;
  participantId: string;
  send: UseSessionResult['send'];
}) {
  const [projector, setProjector] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  // Per-participant round switch (which of their revealed rounds is showing) — lifted
  // here, not local to each tile, so the spotlight overlay agrees with the grid tile
  // the viewer actually clicked instead of always assuming the newest round.
  const [selectedRounds, setSelectedRounds] = useState<Record<string, number>>({});
  const me = state.participants[participantId];
  const isFacilitator = me?.role === 'facilitator';
  const concluded = state.phase === 'concluded';
  const spotlight = state.spotlight;
  const tiles = useMemo(() => buildTiles(state), [state]);
  const spotlitTile = tiles.find((tile) => tile.participantId === spotlight);
  const canRelease = !concluded && spotlight !== null && (isFacilitator || spotlight === participantId);

  function selectedRoundFor(tile: WallTileData): number {
    const newest = tile.rounds[tile.rounds.length - 1] as number;
    const stored = selectedRounds[tile.participantId];
    return stored !== undefined && tile.rounds.includes(stored) ? stored : newest;
  }

  // Announce only on an actual spotlight *change* — a ref (not effect deps) skips the
  // very first run, so mounting onto an already-spotlit (or already-clear) wall stays
  // silent instead of always announcing "released" on load.
  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (!spotlight) {
      setAnnouncement('Spotlight released');
      return;
    }
    const name = state.participants[spotlight]?.name ?? 'Someone';
    setAnnouncement(`${name}'s result is now spotlighted`);
  }, [spotlight, state.participants]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && canRelease) {
        send(intents.setSpotlight(participantId, null));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canRelease, participantId, send]);

  useEffect(() => {
    function onFullscreenChange() {
      setProjector(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  async function toggleProjector() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.().catch(() => {});
      setProjector(true);
    } else {
      await document.exitFullscreen?.().catch(() => {});
      setProjector(false);
    }
  }

  function spotlightIntentFor(tile: WallTileData) {
    return intents.setSpotlight(participantId, spotlight === tile.participantId ? null : tile.participantId);
  }

  return (
    <main
      data-projector={projector}
      className="flex min-h-screen flex-col items-center gap-8 p-6 text-ink sm:gap-10 sm:p-12"
    >
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>

      {projector ? (
        <Button variant="ghost" size="sm" className="fixed right-4 top-4 z-toast" onClick={toggleProjector}>
          Exit projector
        </Button>
      ) : (
        <div className="flex w-full max-w-5xl flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-semibold">{state.config.title} · Wall</h1>
          <div className="flex items-center gap-3">
            {concluded ? <p role="status" className="text-sm text-ink-muted">Concluded · read-only</p> : null}
            <Roster participants={state.participants} selfId={participantId} collapsible />
            <Button variant="secondary" size="sm" onClick={toggleProjector}>
              Projector mode
            </Button>
          </div>
        </div>
      )}

      {tiles.length === 0 ? (
        <p className={`panel-strong rounded-control p-4 text-ink-muted ${projector ? 'text-2xl' : ''}`}>
          No results yet — reveal your cards to add your plaque to the wall.
        </p>
      ) : (
        <div className="grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {tiles.map((tile) => (
            <WallTile
              key={tile.participantId}
              tile={tile}
              gameTitle={state.config.title}
              selected={selectedRoundFor(tile)}
              onSelectRound={(round) => setSelectedRounds((prev) => ({ ...prev, [tile.participantId]: round }))}
              dimmed={spotlight !== null && spotlight !== tile.participantId}
              canSpotlight={!concluded && (isFacilitator || tile.participantId === participantId)}
              projector={projector}
              onToggleSpotlight={() => send(spotlightIntentFor(tile))}
            />
          ))}
        </div>
      )}

      {spotlitTile ? (
        <SpotlightOverlay
          tile={spotlitTile}
          round={selectedRoundFor(spotlitTile)}
          gameTitle={state.config.title}
          canRelease={canRelease}
          onRelease={() => send(intents.setSpotlight(participantId, null))}
        />
      ) : null}
    </main>
  );
}

function WallTile({
  tile,
  gameTitle,
  selected,
  onSelectRound,
  dimmed,
  canSpotlight,
  projector,
  onToggleSpotlight,
}: {
  tile: WallTileData;
  gameTitle: string;
  selected: number;
  onSelectRound: (round: number) => void;
  dimmed: boolean;
  canSpotlight: boolean;
  projector: boolean;
  onToggleSpotlight: () => void;
}) {
  const snapshot = tile.reveals[selected];
  if (!snapshot) return null;

  return (
    <div
      className={`flex flex-col items-center gap-2 transition-opacity duration-[var(--duration-snap)] ease-out ${dimmed ? 'opacity-30' : ''}`}
    >
      <button
        type="button"
        onClick={canSpotlight ? onToggleSpotlight : undefined}
        disabled={!canSpotlight}
        aria-label={`Spotlight ${tile.name}'s round ${selected} result`}
        className="block rounded-card focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-default"
      >
        <Plaque name={tile.name} avatarHue={tile.avatarHue} gameTitle={gameTitle} cards={snapshot.cards} ranked={snapshot.ranked} />
      </button>
      {tile.rounds.length > 1 ? (
        <div role="group" aria-label={`${tile.name}'s revealed rounds`} className="flex gap-2">
          {tile.rounds.map((round) => (
            <button
              key={round}
              type="button"
              onClick={() => onSelectRound(round)}
              aria-pressed={round === selected}
              className={`min-h-11 min-w-11 rounded-control px-3 font-semibold ${projector ? 'text-lg' : 'text-sm'} ${
                round === selected ? 'bg-accent text-on-accent' : 'bg-accent-subtle text-ink-muted'
              }`}
            >
              R{round}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const SPOTLIGHT_VARIANTS = {
  hidden: { opacity: 0, scale: 0.85 },
  shown: { opacity: 1, scale: 1 },
};
const SPOTLIGHT_SPRING = { type: 'spring' as const, stiffness: 420, damping: 32 };

function SpotlightOverlay({
  tile,
  round,
  gameTitle,
  canRelease,
  onRelease,
}: {
  tile: WallTileData;
  round: number;
  gameTitle: string;
  canRelease: boolean;
  onRelease: () => void;
}) {
  const motionSafe = useMotionSafe();
  const variants = fadeOnlyVariants(SPOTLIGHT_VARIANTS, motionSafe);
  const snapshot = tile.reveals[round];
  if (!snapshot) return null;

  return (
    <div className="fixed inset-0 z-modal flex flex-col items-center justify-center gap-4 bg-ink/40 p-6">
      <motion.div
        initial="hidden"
        animate="shown"
        variants={variants}
        transition={transition(motionSafe, SPOTLIGHT_SPRING)}
      >
        <Plaque name={tile.name} avatarHue={tile.avatarHue} gameTitle={gameTitle} cards={snapshot.cards} ranked={snapshot.ranked} />
      </motion.div>
      {canRelease ? (
        <Button variant="secondary" onClick={onRelease}>
          Release spotlight
        </Button>
      ) : null}
    </div>
  );
}
