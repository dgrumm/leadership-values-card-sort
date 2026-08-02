import { describe, expect, it } from 'vitest';
import { HEALTH_PATH, healthBody } from './health';

describe('health stub', () => {
  it('serves at /api/health', () => {
    expect(HEALTH_PATH).toBe('/api/health');
  });

  it('returns { ok: true }', () => {
    expect(healthBody()).toEqual({ ok: true });
  });
});
