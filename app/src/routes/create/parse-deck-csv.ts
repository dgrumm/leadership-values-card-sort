import Papa from 'papaparse';
import { DeckSchema, type Deck } from '@values-cards/shared';

const MAX_CARDS = 100;

export interface DeckCsvError {
  /** 1-based row number within the original CSV text (0 for whole-file errors). */
  row: number;
  message: string;
}

export type ParseDeckCsvResult = { ok: true; deck: Deck } | { ok: false; errors: DeckCsvError[] };

function isHeaderRow(fields: string[]): boolean {
  return (fields[0] ?? '').trim().toLowerCase() === 'value' && (fields[1] ?? '').trim().toLowerCase() === 'description';
}

/**
 * `value,description` CSV → validated `Deck`. Shared by both the paste textarea and
 * the file-upload input (03.2) so the two paths can never diverge.
 *
 * Row numbers in errors are 1-based positions in the original text (blank lines
 * count, so "Row 12" points at the actual line a user would scroll to), matching
 * `DeckSchema`'s cross-field rules (duplicate values, card count) but reported per
 * row instead of one aggregate zod error.
 */
export function parseDeckCsv(csvText: string, deckName: string): ParseDeckCsvResult {
  // BOM: Excel/Notepad commonly prefix a CSV export with a UTF-8 BOM.
  const cleaned = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;
  const { data } = Papa.parse<string[]>(cleaned, { skipEmptyLines: false });

  const errors: DeckCsvError[] = [];
  const seen = new Map<string, number>();
  const cards: { value: string; description: string }[] = [];

  let sawFirstRow = false;

  data.forEach((fields, index) => {
    const rowNumber = index + 1;
    const isBlank = fields.every((field) => field.trim() === '');
    if (isBlank) return;
    // Header detection keys off the first *non-blank* row, not literally row 1: a CSV
    // exported with a leading blank line would otherwise ingest its own header as a card.
    const isFirstRow = !sawFirstRow;
    sawFirstRow = true;
    if (isFirstRow && isHeaderRow(fields)) return;

    const value = (fields[0] ?? '').trim();
    const description = (fields[1] ?? '').trim();

    if (!value) errors.push({ row: rowNumber, message: `Row ${rowNumber}: empty value` });
    if (!description) errors.push({ row: rowNumber, message: `Row ${rowNumber}: empty description` });

    if (value) {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        errors.push({ row: rowNumber, message: `Row ${rowNumber}: duplicate value '${value}'` });
      } else {
        seen.set(key, rowNumber);
      }
    }

    cards.push({ value, description });
  });

  if (cards.length > MAX_CARDS) {
    // Whole-file condition, so row 0 (the convention used for the no-cards error below)
    // rather than a row number that points at nothing in particular.
    errors.push({ row: 0, message: `${cards.length} cards exceeds the ${MAX_CARDS}-card maximum` });
  }

  if (cards.length === 0) {
    errors.push({ row: 0, message: 'no cards found' });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const parsed = DeckSchema.safeParse({ name: deckName, cards });
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => ({ row: 0, message: issue.message })) };
  }
  return { ok: true, deck: parsed.data };
}
