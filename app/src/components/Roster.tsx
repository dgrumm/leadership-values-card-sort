import { useState } from 'react';
import type { Participant } from '@values-cards/shared';
import { Avatar } from './Avatar';

export interface RosterProps {
  /** `SessionState.participants` — object key order is insertion order (join order, decision). */
  participants: Record<string, Participant>;
  selfId: string;
  /** Renders as a collapsed avatar strip with an expand toggle (sort/wall); omit for the
   *  always-expanded lobby view. */
  collapsible?: boolean;
}

function progressLine(participant: Participant): string {
  if (participant.progress.done) return 'Done ✓';
  const { round, sorted, kept } = participant.progress;
  return `Round ${round} · ${sorted} sorted · ${kept} kept`;
}

function RosterList({ participants, selfId }: Pick<RosterProps, 'participants' | 'selfId'>) {
  const ids = Object.keys(participants);
  return (
    <ul aria-label="Participants" className="flex flex-col gap-2">
      {ids.map((id) => {
        const participant = participants[id];
        if (!participant) return null;
        return (
          <li key={id} className="flex items-center gap-3">
            <Avatar name={participant.name} hue={participant.avatarHue} />
            <div className="flex flex-col">
              <span className="font-semibold text-ink">
                {participant.name}
                {id === selfId ? ' (you)' : ''}
                {participant.role === 'facilitator' ? ' · Facilitator' : ''}
              </span>
              <span className="text-sm text-ink-muted">{progressLine(participant)}</span>
            </div>
            <span
              data-connected={participant.connected}
              aria-hidden="true"
              className={`ml-auto h-2.5 w-2.5 rounded-full border border-ink-muted ${participant.connected ? 'bg-accent' : 'bg-transparent'}`}
            />
            <span className="sr-only">{participant.connected ? 'Connected' : 'Disconnected'}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Participants visible to each other — names, avatars, progress counts, connection —
 * without ever rendering card contents (the client only ever has counts, spec 02.1).
 */
export function Roster({ participants, selfId, collapsible = false }: RosterProps) {
  const [expanded, setExpanded] = useState(!collapsible);

  if (!collapsible || expanded) {
    return (
      <div>
        {collapsible ? (
          <button type="button" onClick={() => setExpanded(false)} className="mb-2 text-sm font-semibold text-ink-muted">
            Hide participants
          </button>
        ) : null}
        <RosterList participants={participants} selfId={selfId} />
      </div>
    );
  }

  const ids = Object.keys(participants);
  return (
    <button
      type="button"
      onClick={() => setExpanded(true)}
      aria-label={`Show participants (${ids.length})`}
      className="flex items-center -space-x-2"
    >
      {ids.map((id) => {
        const participant = participants[id];
        if (!participant) return null;
        return <Avatar key={id} name={participant.name} hue={participant.avatarHue} />;
      })}
    </button>
  );
}
