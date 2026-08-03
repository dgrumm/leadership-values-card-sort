import type { ConnectionState } from './connection';

export interface ConnectionPillProps {
  connection: ConnectionState;
}

/** Quiet by design: nothing in `live`/`connecting`/`resumed`, a small pill while `reconnecting`. */
export function ConnectionPill({ connection }: ConnectionPillProps) {
  if (connection !== 'reconnecting') return null;
  return (
    <div
      role="status"
      className="fixed left-1/2 top-4 z-toast -translate-x-1/2 rounded-control bg-surface-raised px-4 py-2 text-sm font-semibold text-ink shadow-card"
    >
      Reconnecting…
    </div>
  );
}
