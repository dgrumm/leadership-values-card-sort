/**
 * CSV → deck JSON authoring script (stub).
 *
 * Real conversion (schema validation against `@values-cards/shared` deck
 * schemas, writing into `decks/decks/`) lands in spec 00.2. For 00.1 this is
 * a CLI skeleton with help text only.
 */

export const HELP_TEXT = `csv-to-json — convert a values-deck CSV into bundled deck JSON

Usage:
  pnpm --filter decks csv-to-json -- <input.csv> [--out decks/<name>.json]

Options:
  --out <path>   Output JSON path (default: decks/<input-basename>.json)
  -h, --help     Show this help text

Status:
  Stub only — conversion is implemented in spec 00.2.
`;

export function run(argv: readonly string[]): { exitCode: number; output: string } {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    return { exitCode: 0, output: HELP_TEXT };
  }
  return {
    exitCode: 1,
    output: 'csv-to-json: conversion is not implemented yet (see spec 00.2).\n\n' + HELP_TEXT,
  };
}

const isDirectRun =
  typeof process !== 'undefined' && process.argv[1] !== undefined && import.meta.url.endsWith('csv-to-json.ts');

if (isDirectRun && !('vitest' in globalThis)) {
  const { exitCode, output } = run(process.argv.slice(2));
  console.log(output);
  process.exitCode = exitCode;
}
