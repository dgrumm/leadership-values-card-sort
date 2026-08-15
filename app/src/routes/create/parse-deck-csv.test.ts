import { describe, expect, it } from 'vitest';
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

  it('every error carries a row number', () => {
    const result = parseDeckCsv('Courage,\ncourage,B', 'My deck');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    for (const error of result.errors) {
      expect(typeof error.row).toBe('number');
    }
  });
});
