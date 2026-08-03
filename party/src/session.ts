import { Server } from 'partyserver';
import type { Connection, WSMessage } from 'partyserver';
import { IntentSchema, applyIntent, type Event, type GameConfig, type SessionState } from '@values-cards/shared';
import { mintParticipantToken, verifyCreatorToken, verifyParticipantToken } from './token';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface Env {
  Session: DurableObjectNamespace<SessionServer>;
  SESSION_TOKEN_SECRET: string;
}

interface ConnState {
  participantId?: string;
}

/**
 * The single writer for a session: hosts the `shared/` reducer (`applyIntent`) and adds
 * only what the reducer can't own — transport (WebSocket hibernation), auth (token
 * mint/verify), persistence (checkpoint on every accepted mutation), and expiry (24h alarm).
 */
export class SessionServer extends Server<Env> {
  static override options = { hibernate: true };

  private session: SessionState | null = null;

  override async onStart(): Promise<void> {
    this.session = (await this.ctx.storage.get<SessionState>('state')) ?? null;
  }

  /** Non-WebSocket requests: only the Worker's internal "create this session" call. */
  override async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/internal/init') {
      if (this.session) return new Response('session code already in use', { status: 409 });
      const { config } = (await request.json()) as { config: GameConfig };
      const initial: SessionState = {
        code: this.name,
        config,
        phase: 'lobby',
        participants: {},
        reveals: {},
        spotlight: null,
        gate: null,
        processedIntents: {},
        processedJoins: {},
      };
      this.session = initial;
      await this.ctx.storage.put('state', initial);
      await this.ctx.storage.setAlarm(Date.now() + SESSION_TTL_MS);
      return new Response(null, { status: 201 });
    }
    return new Response('not found', { status: 404 });
  }

  override onConnect(connection: Connection<ConnState>): void {
    if (!this.session) {
      this.sendError(connection, 'not_found', 'unknown or expired session code');
      connection.close(1008, 'not_found');
    }
  }

  override async onMessage(connection: Connection<ConnState>, raw: WSMessage): Promise<void> {
    if (!this.session) return;

    let payload: unknown;
    try {
      payload = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw as ArrayBuffer));
    } catch {
      this.sendError(connection, 'invalid_message', 'message must be JSON');
      return;
    }
    if (typeof payload !== 'object' || payload === null) {
      this.sendError(connection, 'invalid_message', 'message must be a JSON object');
      return;
    }

    // `token` (participantToken) and `creatorToken` are transport/auth concerns, not part of
    // the reducer's Intent shape (IntentSchema is a strictObject) — strip them before parsing.
    const record = payload as Record<string, unknown>;
    const token = record.token;
    const creatorToken = record.creatorToken;
    const rest: Record<string, unknown> = { ...record };
    delete rest.token;
    delete rest.creatorToken;
    // A client cannot claim the facilitator role: `isCreator` is only ever set here, from a
    // verified HMAC. Any client-supplied value is discarded.
    delete rest.isCreator;
    let intentInput: Record<string, unknown> = rest;

    if (rest.type === 'join') {
      const isCreator =
        typeof creatorToken === 'string' &&
        (await verifyCreatorToken(this.env.SESSION_TOKEN_SECRET, this.session.code, creatorToken));
      if (isCreator) {
        intentInput = { ...rest, isCreator: true };
      }
    } else {
      if (typeof token !== 'string') {
        this.sendError(connection, 'auth', 'participantToken required');
        return;
      }
      const participantId = await verifyParticipantToken(this.env.SESSION_TOKEN_SECRET, this.session.code, token);
      if (!participantId) {
        this.sendError(connection, 'auth', 'invalid participant token');
        return;
      }
      intentInput = { ...rest, participantId };
    }

    const parsedIntent = IntentSchema.safeParse(intentInput);
    if (!parsedIntent.success) {
      this.sendError(connection, 'invalid_intent', parsedIntent.error.message);
      return;
    }
    const intent = parsedIntent.data;

    const before = this.session;
    const result = applyIntent(before, intent);
    if ('rejection' in result) {
      this.sendError(connection, result.rejection.code, result.rejection.message);
      return;
    }

    const changed = result.state !== before;
    this.session = result.state;
    if (changed) {
      await this.ctx.storage.put('state', this.session);
    }

    if (intent.type === 'join') {
      const participantId = this.session.processedJoins[intent.intentId];
      if (participantId) {
        connection.setState({ participantId });
        const participantToken = await mintParticipantToken(this.env.SESSION_TOKEN_SECRET, this.session.code, participantId);
        connection.send(JSON.stringify({ type: 'welcome', participantId, participantToken }));
      }
    } else if (intent.type === 'rejoin') {
      connection.setState({ participantId: intent.participantId });
    }

    if (changed) {
      for (const event of result.events) {
        this.broadcast(JSON.stringify(event));
      }
    }
  }

  override async onClose(connection: Connection<ConnState>): Promise<void> {
    const participantId = connection.state?.participantId;
    if (!this.session || !participantId) return;
    const participant = this.session.participants[participantId];
    if (!participant || !participant.connected) return;

    const updated = { ...participant, connected: false };
    this.session = {
      ...this.session,
      participants: { ...this.session.participants, [participantId]: updated },
    };
    await this.ctx.storage.put('state', this.session);
    this.broadcast(
      JSON.stringify({ type: 'patch', patch: { participants: { [participantId]: updated } } } satisfies Event),
    );
  }

  override async onAlarm(): Promise<void> {
    for (const connection of this.getConnections<ConnState>()) {
      connection.send(JSON.stringify({ type: 'error', code: 'expired', message: 'session expired' } satisfies Event));
      connection.close(1008, 'expired');
    }
    await this.ctx.storage.deleteAll();
    this.session = null;
  }

  private sendError(connection: Connection, code: string, message: string): void {
    connection.send(JSON.stringify({ type: 'error', code, message } satisfies Event));
  }
}
