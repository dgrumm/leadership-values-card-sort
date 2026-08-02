import { Server, routePartykitRequest } from 'partyserver';
import type { Connection, WSMessage } from 'partyserver';
import { HEALTH_PATH, healthBody } from './health';

interface Env {
  Session: DurableObjectNamespace;
}

/**
 * Minimal echo Durable Object stub. Real session logic is spec 01.1 —
 * this only proves `wrangler dev` (Miniflare) runs a DO locally with no
 * Cloudflare account.
 */
export class SessionServer extends Server<Env> {
  override onMessage(connection: Connection, message: WSMessage): void {
    connection.send(typeof message === 'string' ? message : '[binary]');
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === HEALTH_PATH) {
      return Response.json(healthBody());
    }
    const partyResponse = await routePartykitRequest(request, env);
    return partyResponse ?? new Response('Not found', { status: 404 });
  },
};
