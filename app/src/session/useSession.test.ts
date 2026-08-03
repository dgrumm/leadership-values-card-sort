import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseInboundMessage } from './useSession';

describe('parseInboundMessage', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('drops non-JSON garbage without throwing', () => {
    expect(() => parseInboundMessage('not json at all {{{')).not.toThrow();
    expect(parseInboundMessage('not json at all {{{')).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('drops valid JSON that matches neither Welcome nor Event without throwing', () => {
    expect(parseInboundMessage(JSON.stringify({ type: 'not-a-real-type', foo: 'bar' }))).toBeNull();
    expect(parseInboundMessage(JSON.stringify({ hello: 'world' }))).toBeNull();
    expect(parseInboundMessage('null')).toBeNull();
    expect(parseInboundMessage('42')).toBeNull();
  });

  it('parses a welcome message', () => {
    const raw = JSON.stringify({
      type: 'welcome',
      participantId: '11111111-1111-4111-8111-111111111111',
      participantToken: 'tok',
    });
    expect(parseInboundMessage(raw)).toEqual({
      kind: 'welcome',
      welcome: { type: 'welcome', participantId: '11111111-1111-4111-8111-111111111111', participantToken: 'tok' },
    });
  });

  it('parses an error event', () => {
    const raw = JSON.stringify({ type: 'error', code: 'not_found', message: 'gone' });
    expect(parseInboundMessage(raw)).toEqual({
      kind: 'event',
      event: { type: 'error', code: 'not_found', message: 'gone' },
    });
  });
});
