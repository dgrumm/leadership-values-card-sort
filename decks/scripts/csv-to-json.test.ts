import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DeckSchema } from '@values-cards/shared';
import { HELP_TEXT, convert, parseCsv, run } from './csv-to-json';

const FIXTURE = join(import.meta.dirname, 'fixtures/sample.csv');

describe('csv-to-json CLI', () => {
  it('prints help with --help and exits 0', () => {
    const result = run(['--help']);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('csv-to-json');
    expect(result.output).toContain('Usage:');
  });

  it('prints help when run with no arguments', () => {
    expect(run([]).output).toBe(HELP_TEXT);
  });

  it('fails without a --name', () => {
    const result = run([FIXTURE]);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('--name');
  });

  it('converts a fixture CSV into a valid deck JSON file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'csv-to-json-'));
    const outPath = join(dir, 'sample.json');
    try {
      const result = run([FIXTURE, '--name', 'Sample deck', '--out', outPath]);
      expect(result.exitCode).toBe(0);
      const written = JSON.parse(readFileSync(outPath, 'utf8'));
      expect(DeckSchema.safeParse(written).success).toBe(true);
      expect(written.cards).toHaveLength(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('parseCsv', () => {
  it('handles quoted fields with embedded commas', () => {
    const cards = parseCsv(readFileSync(FIXTURE, 'utf8'));
    expect(cards).toEqual([
      { value: 'Trust', description: 'Firm reliance on the integrity, ability, or character of a person' },
      { value: 'Teamwork', description: 'Cooperative effort by a group' },
      { value: 'Balance', description: 'Balancing time and effort between work, home, and hobbies' },
    ]);
  });
});

describe('convert', () => {
  it('produces a schema-valid deck', () => {
    const deck = convert(readFileSync(FIXTURE, 'utf8'), 'Sample deck');
    expect(DeckSchema.safeParse(deck).success).toBe(true);
  });

  it('throws for a CSV missing required columns', () => {
    expect(() => convert('foo,bar\n1,2', 'Bad deck')).toThrow();
  });
});
