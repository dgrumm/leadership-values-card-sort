import { useEffect, useMemo, useRef, useState } from 'react';
import { EventSchema, type Event, type Intent, type SessionState } from '@values-cards/shared';
import { backoffDelay, connectionReducer, type ConnectionState } from './connection';
import { createSessionStore } from './createSessionStore';
import { WelcomeSchema, type Welcome } from './intents';
import { loadToken, saveToken } from './tokens';

export interface UseSessionResult {
  state: SessionState | null;
  connection: ConnectionState;
  /** Builds the wire envelope (attaches the stored `token`, or a passed `creatorToken` on
   *  `join`) and sends now if `live`, otherwise queues (FIFO) for delivery after resume. */
  send: (intent: Intent, creatorToken?: string) => void;
  /** The most recent `error` event (e.g. a rejected reveal) — transient, not session state.
   *  Callers surface it (a Toast) and clear it once shown. */
  error: { code: string; message: string } | null;
  clearError: () => void;
}

function wsUrl(code: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/session/${code}/ws`;
}

/**
 * Parses one inbound WebSocket frame. `welcome` is transport/auth (minted right after a
 * successful `join`), not part of `EventSchema`, so it's tried first. Anything else that
 * isn't valid JSON matching one of those two shapes is dropped — never thrown — so a
 * malformed frame (or a hostile/buggy peer) can't crash the app (spec 01.2).
 */
export function parseInboundMessage(raw: string): { kind: 'welcome'; welcome: Welcome } | { kind: 'event'; event: Event } | null {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    console.warn('session: dropped malformed message (invalid JSON)');
    return null;
  }

  const welcome = WelcomeSchema.safeParse(payload);
  if (welcome.success) return { kind: 'welcome', welcome: welcome.data };

  const event = EventSchema.safeParse(payload);
  if (event.success) return { kind: 'event', event: event.data };

  console.warn('session: dropped malformed event', event.error.message);
  return null;
}

/**
 * One WebSocket per participant (spec 01.2). Owns the connection state machine,
 * the reconnect-with-backoff loop, and the offline intent queue; reduces inbound
 * `state`/`patch` events into a session store created fresh for this `code`.
 */
export function useSession(code: string): UseSessionResult {
  const store = useMemo(() => createSessionStore(), []);
  const state = store((s) => s.state);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<Array<{ intent: Intent; creatorToken?: string }>>([]);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Bumped once by this effect's cleanup, so a socket from a *superseded* run (React
  // StrictMode's dev-only mount -> cleanup -> remount, or a real `code` change) can
  // tell its own `close` event apart from a genuine drop: a shared boolean flag
  // doesn't work here because the discarded socket's `close` event is asynchronous
  // and can arrive after the very next effect run has already reset it.
  const epochRef = useRef(0);

  useEffect(() => {
    const epoch = epochRef.current;

    function dispatch(action: Parameters<typeof connectionReducer>[1]) {
      setConnection((prev) => connectionReducer(prev, action));
    }

    function connect() {
      const ws = new WebSocket(wsUrl(code));
      socketRef.current = ws;

      ws.addEventListener('open', () => {
        attemptRef.current = 0;
        const token = loadToken(code);
        if (token) {
          ws.send(
            JSON.stringify({
              type: 'rejoin',
              intentId: crypto.randomUUID(),
              participantId: token.participantId,
              token: token.participantToken,
            }),
          );
        }
        dispatch({ type: 'open' });
      });

      ws.addEventListener('message', (event) => {
        const parsed = parseInboundMessage(typeof event.data === 'string' ? event.data : '');
        if (!parsed) return;

        if (parsed.kind === 'welcome') {
          saveToken(code, parsed.welcome);
          return;
        }

        const evt = parsed.event;
        if (evt.type === 'state' || evt.type === 'patch') {
          store.getState().applyEvent(evt);
        }
        if (evt.type === 'state') {
          // No-op if we're already `live` (e.g. the initial join's own state echo) —
          // the reducer only advances `reconnecting -> resumed` here.
          dispatch({ type: 'state' });
          dispatch({ type: 'settled' });
        }
        if (evt.type === 'error') {
          dispatch({ type: 'error', code: evt.code });
          setError({ code: evt.code, message: evt.message });
        }
      });

      ws.addEventListener('close', () => {
        if (epochRef.current !== epoch) return; // this run was superseded — not a real drop
        dispatch({ type: 'close' });
        const delay = backoffDelay(attemptRef.current++);
        timerRef.current = setTimeout(() => {
          if (epochRef.current === epoch) connect();
        }, delay);
      });
    }

    connect();

    return () => {
      epochRef.current++;
      clearTimeout(timerRef.current);
      socketRef.current?.close();
    };
  }, [code, store]);

  // Flush the offline queue once the socket is live again (initial connect or resume).
  useEffect(() => {
    if (connection !== 'live') return;
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const queued = queueRef.current;
    queueRef.current = [];
    for (const { intent, creatorToken } of queued) {
      ws.send(JSON.stringify(envelope(code, intent, creatorToken)));
    }
  }, [connection, code]);

  const send = (intent: Intent, creatorToken?: string) => {
    const ws = socketRef.current;
    if (connection === 'live' && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(envelope(code, intent, creatorToken)));
    } else {
      queueRef.current.push({ intent, creatorToken });
    }
  };

  // Dev-only e2e hook (spec 01.2's socket-kill test): dead code in production builds,
  // since Vite inlines `import.meta.env.DEV` to `false` and strips the branch.
  if (import.meta.env.DEV) {
    (window as unknown as { __VC_TEST__?: unknown }).__VC_TEST__ = {
      send,
      getState: () => store.getState().state,
      closeSocket: () => socketRef.current?.close(),
    };
  }

  return { state, connection, send, error, clearError: () => setError(null) };
}

/** Attaches the transport-level auth field the DO expects alongside the reducer intent. */
function envelope(code: string, intent: Intent, creatorToken?: string): Record<string, unknown> {
  if (intent.type === 'join') {
    return creatorToken ? { ...intent, creatorToken } : intent;
  }
  const token = loadToken(code)?.participantToken;
  return token ? { ...intent, token } : intent;
}
