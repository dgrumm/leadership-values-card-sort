import { GameConfigSchema, type GameConfig } from '@values-cards/shared';
import { HEALTH_PATH, healthBody } from './health';
import { CLASSIC_TEMPLATE } from './default-config';
import { randomCode } from './code';
import { mintCreatorToken } from './token';
import { SessionServer, type Env } from './session';

export { SessionServer };

const SESSION_PATH = '/api/session';
const WS_PATH_PATTERN = /^\/api\/session\/([A-Z0-9]{6})\/ws$/;
const MAX_CODE_ATTEMPTS = 5;

async function createSession(env: Env, config: GameConfig): Promise<{ code: string; creatorToken: string }> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomCode();
    const stub = env.Session.get(env.Session.idFromName(code));
    const response = await stub.fetch('http://session/internal/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    if (response.status === 201) {
      return { code, creatorToken: await mintCreatorToken(env.SESSION_TOKEN_SECRET, code) };
    }
  }
  throw new Error('could not allocate a unique session code');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === HEALTH_PATH) {
      return Response.json(healthBody());
    }

    if (request.method === 'POST' && url.pathname === SESSION_PATH) {
      const body = (await request.json().catch(() => ({}))) as { config?: unknown };
      const parsedConfig = body.config === undefined ? { success: true as const, data: CLASSIC_TEMPLATE } : GameConfigSchema.safeParse(body.config);
      if (!parsedConfig.success) {
        return Response.json({ error: 'invalid config' }, { status: 400 });
      }
      const { code, creatorToken } = await createSession(env, parsedConfig.data);
      return Response.json({ code, creatorToken });
    }

    const wsMatch = url.pathname.match(WS_PATH_PATTERN);
    if (wsMatch) {
      const code = wsMatch[1] as string;
      const stub = env.Session.get(env.Session.idFromName(code));
      return stub.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};
