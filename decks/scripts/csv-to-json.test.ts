import { describe, expect, it } from 'vitest';
import { HELP_TEXT, run } from './csv-to-json';

describe('csv-to-json stub CLI', () => {
  it('prints help with --help and exits 0', () => {
    const result = run(['--help']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('csv-to-json');
    expect(result.output).toContain('Usage:');
  });

  it('prints help when run with no arguments', () => {
    expect(run([]).output).toBe(HELP_TEXT);
  });

  it('exits non-zero for unimplemented conversion', () => {
    const result = run(['deck.csv']);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('not implemented');
  });
});
