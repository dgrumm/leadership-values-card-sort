import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Card } from '@values-cards/shared';
import { Plaque } from './Plaque';

afterEach(cleanup);

const CARDS: Card[] = [
  { value: 'Curiosity', description: 'd1' },
  { value: 'Courage', description: 'd2' },
  { value: 'Kindness', description: 'd3' },
];

describe('Plaque', () => {
  it('renders the participant name, game title, and each card', () => {
    render(<Plaque name="Ada" avatarHue={40} gameTitle="Values Night" cards={CARDS} ranked={false} />);
    expect(screen.getByText('Ada')).not.toBeNull();
    expect(screen.getByText('Values Night')).not.toBeNull();
    for (const card of CARDS) expect(screen.getByText(card.value)).not.toBeNull();
    expect(screen.queryByText('1')).toBeNull(); // no order badge when unranked
  });

  it('shows 1/2/3 order badges when ranked', () => {
    render(<Plaque name="Ada" avatarHue={40} gameTitle="Values Night" cards={CARDS} ranked />);
    expect(screen.getByText('1')).not.toBeNull();
    expect(screen.getByText('2')).not.toBeNull();
    expect(screen.getByText('3')).not.toBeNull();
  });
});

// Architecture §12: the plaque layout is constrained to a satori-safe CSS subset
// (flexbox, no grid/filters) so 04.1's satori export renders the identical artifact.
// Source-scan (same technique as scripts/token-lint.mjs) rather than computed styles —
// jsdom doesn't apply Tailwind's generated CSS, so class/style source is the only
// reliable signal here.
describe('plaque layout: satori-safe CSS subset', () => {
  const DIR = dirname(fileURLToPath(import.meta.url));
  const FORBIDDEN: Array<{ name: string; pattern: RegExp }> = [
    { name: 'CSS grid', pattern: /\bgrid(-cols|-rows)?\b/ },
    { name: 'filter', pattern: /\bfilter\s*:/ },
    { name: 'backdrop-filter/backdrop-blur', pattern: /backdrop-(filter|blur)/ },
    { name: 'clip-path', pattern: /clip-path/ },
  ];

  function violationsIn(file: string): string[] {
    // Strip comments (`//` and `/* */`) — this scans actual class/style code, not
    // this file's own prose about *why* those properties are forbidden.
    const code = readFileSync(join(DIR, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    return FORBIDDEN.filter((rule) => rule.pattern.test(code)).map((rule) => rule.name);
  }

  it('Plaque.tsx uses none of the forbidden properties', () => {
    expect(violationsIn('Plaque.tsx')).toEqual([]);
  });

  it('plaque-layout.ts uses none of the forbidden properties', () => {
    expect(violationsIn('plaque-layout.ts')).toEqual([]);
  });
});
