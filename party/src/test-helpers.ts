import { SELF } from 'cloudflare:test';
import type { GameConfig } from '@values-cards/shared';

export interface CreatedSession {
  code: string;
  creatorToken: string;
}

export async function createSession(config?: GameConfig): Promise<CreatedSession> {
  const response = await SELF.fetch('http://test/api/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(config ? { config } : {}),
  });
  if (response.status !== 200) {
    throw new Error(`createSession failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

/**
 * A connected test socket that buffers every inbound message from the moment it opens, so
 * `next()` can be awaited any time after a `send()` without a race against delivery.
 */
export interface TestSocket {
  ws: WebSocket;
  send(message: Record<string, unknown>): void;
  /** Returns the next not-yet-consumed message, in arrival order. */
  next(): Promise<Record<string, unknown>>;
  received: number;
}

export async function connect(code: string): Promise<TestSocket> {
  const response = await SELF.fetch(`http://test/api/session/${code}/ws`, {
    headers: { Upgrade: 'websocket' },
  });
  const ws = response.webSocket;
  if (!ws) throw new Error(`expected a websocket upgrade, got ${response.status}`);

  const queue: Record<string, unknown>[] = [];
  const waiters: Array<() => void> = [];
  const socket: TestSocket = {
    ws,
    received: 0,
    send(message) {
      ws.send(JSON.stringify(message));
    },
    async next() {
      while (queue.length === 0) {
        await new Promise<void>((resolve) => waiters.push(resolve));
      }
      socket.received += 1;
      return queue.shift() as Record<string, unknown>;
    },
  };
  ws.addEventListener('message', (event) => {
    queue.push(JSON.parse(event.data as string));
    waiters.splice(0).forEach((resolve) => resolve());
  });
  ws.accept();
  return socket;
}

export async function join(
  socket: TestSocket,
  name: string,
  intentId = crypto.randomUUID(),
): Promise<{ participantId: string; participantToken: string }> {
  socket.send({ type: 'join', intentId, name });
  const welcome = await socket.next();
  await socket.next(); // the broadcasted full-state event that follows every join
  return welcome as { participantId: string; participantToken: string };
}
