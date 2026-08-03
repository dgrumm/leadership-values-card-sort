/**
 * CSV → deck JSON authoring script.
 *
 * Reads a `value,description` CSV (RFC 4180-ish: quoted fields may contain
 * commas), validates it against `@values-cards/shared`'s DeckSchema, and
 * writes the bundled deck JSON.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { DeckSchema } from '@values-cards/shared';

export const HELP_TEXT = `csv-to-json — convert a values-deck CSV into bundled deck JSON

Usage:
  pnpm --filter decks csv-to-json -- <input.csv> --name "<Deck name>" [--out decks/<name>.json]

Options:
  --name <name>  Deck name (required)
  --out <path>   Output JSON path (default: decks/<input-basename>.json)
  -h, --help     Show this help text
`;

/** Parses one CSV row into fields, honoring double-quoted fields with embedded commas/quotes. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

/** Parses a `value,description` CSV (header row required, column order/case-insensitive names). */
export function parseCsv(text: string): { value: string; description: string }[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const valueCol = header.findIndex((h) => h === 'value' || h === 'value_name' || h === 'value name');
  const descCol = header.findIndex((h) => h === 'description');
  if (valueCol === -1 || descCol === -1) {
    throw new Error('CSV header must contain "value" and "description" columns');
  }
  return lines.slice(1).map((line) => {
    const fields = parseCsvLine(line);
    return { value: (fields[valueCol] ?? '').trim(), description: (fields[descCol] ?? '').trim() };
  });
}

/** Parses + validates a CSV into a deck JSON payload. Throws on schema violations. */
export function convert(csvText: string, deckName: string) {
  const cards = parseCsv(csvText);
  return DeckSchema.parse({ name: deckName, cards });
}

function parseArgs(argv: readonly string[]) {
  const positional: string[] = [];
  let out: string | undefined;
  let name: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out = argv[++i];
    else if (argv[i] === '--name') name = argv[++i];
    else positional.push(argv[i]!);
  }
  return { input: positional[0], out, name };
}

export function run(argv: readonly string[]): { exitCode: number; output: string } {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    return { exitCode: 0, output: HELP_TEXT };
  }
  const { input, out, name } = parseArgs(argv);
  if (!input) {
    return { exitCode: 1, output: 'csv-to-json: missing <input.csv>\n\n' + HELP_TEXT };
  }
  if (!name) {
    return { exitCode: 1, output: 'csv-to-json: missing --name "<Deck name>"\n\n' + HELP_TEXT };
  }
  const outPath = out ?? join(dirname(input), '..', 'decks', basename(input).replace(/\.csv$/i, '.json'));
  try {
    const csvText = readFileSync(input, 'utf8');
    const deck = convert(csvText, name);
    writeFileSync(outPath, JSON.stringify(deck, null, 2) + '\n');
    return { exitCode: 0, output: `csv-to-json: wrote ${deck.cards.length} cards to ${outPath}\n` };
  } catch (error) {
    return { exitCode: 1, output: `csv-to-json: ${error instanceof Error ? error.message : String(error)}\n` };
  }
}

const isDirectRun =
  typeof process !== 'undefined' && process.argv[1] !== undefined && import.meta.url.endsWith('csv-to-json.ts');

if (isDirectRun && !('vitest' in globalThis)) {
  const { exitCode, output } = run(process.argv.slice(2));
  console.log(output);
  process.exitCode = exitCode;
}
