import { describe, expect, it } from 'vitest';
import { CARD_DESCRIPTION_MAX, CARD_VALUE_MAX } from '@values-cards/shared';
import { parseDeckCsv } from './parse-deck-csv';

describe('parseDeckCsv', () => {
  it('parses a header-less happy path', () => {
    const result = parseDeckCsv('Courage,Acting despite fear\nTrust,Confidence in others', 'My deck');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.cards).toEqual([
      { value: 'Courage', description: 'Acting despite fear' },
      { value: 'Trust', description: 'Confidence in others' },
    ]);
  });

  it('detects and skips a case-insensitive header row', () => {
    const result = parseDeckCsv('Value,Description\nCourage,Acting despite fear', 'My deck');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.cards).toEqual([{ value: 'Courage', description: 'Acting despite fear' }]);
  });

  it('parses quoted fields containing commas', () => {
    const result = parseDeckCsv('"Courage, boldly","Acting, despite fear"', 'My deck');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.cards).toEqual([{ value: 'Courage, boldly', description: 'Acting, despite fear' }]);
  });

  it('handles CRLF line endings and a leading BOM', () => {
    const csv = '﻿Courage,Acting despite fear\r\nTrust,Confidence in others\r\n';
    const result = parseDeckCsv(csv, 'My deck');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.cards).toHaveLength(2);
  });

  it('detects a header row that follows a leading blank line', () => {
    const result = parseDeckCsv('\nValue,Description\nCourage,Acting despite fear', 'My deck');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Regression: keying header detection off literal row 1 ingested the header as a card.
    expect(result.deck.cards).toEqual([{ value: 'Courage', description: 'Acting despite fear' }]);
  });

  it('skips blank lines', () => {
    const result = parseDeckCsv('Courage,Acting despite fear\n\nTrust,Confidence in others', 'My deck');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.cards).toHaveLength(2);
  });

  it('flags duplicate values case-insensitively with a row number', () => {
    const result = parseDeckCsv('Courage,A\ncourage,B', 'My deck');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({ row: 2, message: "Row 2: duplicate value 'courage'" });
  });

  it('flags an empty description with a row number', () => {
    const result = parseDeckCsv('Courage,\nTrust,Confidence', 'My deck');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({ row: 1, message: 'Row 1: empty description' });
  });

  it('rejects 101 cards', () => {
    const rows = Array.from({ length: 101 }, (_, i) => `Card ${i},Description ${i}`).join('\n');
    const result = parseDeckCsv(rows, 'My deck');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((error) => /exceeds the 100-card maximum/.test(error.message))).toBe(true);
  });

  it('accepts exactly 100 cards', () => {
    const rows = Array.from({ length: 100 }, (_, i) => `Card ${i},Description ${i}`).join('\n');
    const result = parseDeckCsv(rows, 'My deck');
    expect(result.ok).toBe(true);
  });

  it('marks the parsed deck as a custom source', () => {
    const result = parseDeckCsv('Courage,Acting despite fear', 'My deck');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deck.source).toBe('custom');
  });

  it('flags over-length value and description with the row and the actual length', () => {
    const csv = `${'a'.repeat(CARD_VALUE_MAX + 5)},ok\nTrust,${'b'.repeat(CARD_DESCRIPTION_MAX + 12)}`;
    const result = parseDeckCsv(csv, 'My deck');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      row: 1,
      message: `Row 1: value is ${CARD_VALUE_MAX + 5} characters (max ${CARD_VALUE_MAX})`,
    });
    expect(result.errors).toContainEqual({
      row: 2,
      message: `Row 2: description is ${CARD_DESCRIPTION_MAX + 12} characters (max ${CARD_DESCRIPTION_MAX})`,
    });
  });

  it('accepts card text exactly at the ceilings', () => {
    const csv = `${'a'.repeat(CARD_VALUE_MAX)},${'b'.repeat(CARD_DESCRIPTION_MAX)}`;
    expect(parseDeckCsv(csv, 'My deck').ok).toBe(true);
  });

  it('every error carries a row number', () => {
    const result = parseDeckCsv('Courage,\ncourage,B', 'My deck');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    for (const error of result.errors) {
      expect(typeof error.row).toBe('number');
    }
  });
});
