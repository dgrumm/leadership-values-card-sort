/** Body of the `GET /api/health` stub route. Pure so it is unit-testable off-Workers. */
export function healthBody(): { ok: true } {
  return { ok: true };
}

export const HEALTH_PATH = '/api/health';
