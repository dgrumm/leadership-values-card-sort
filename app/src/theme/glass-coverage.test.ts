import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// 00.5: glass is the one system-wide surface — no app screen may fall back to the
// opaque 00.3 `bg-surface-raised` panel where a themed surface is intended.
const APP_SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

function collectFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      collectFiles(fullPath, files);
    } else if (/\.tsx?$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

function violations(files: string[]): string[] {
  const hits: string[] = [];
  for (const file of files) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (line.includes('bg-surface-raised')) hits.push(`${file}:${index + 1}`);
      });
  }
  return hits;
}

describe('glass surface coverage', () => {
  it('no bare bg-surface-raised remains under app/src/routes/**', () => {
    expect(violations(collectFiles(join(APP_SRC, 'routes')))).toEqual([]);
  });

  it('no bare bg-surface-raised remains in Roster.tsx or Toast.tsx', () => {
    const files = [join(APP_SRC, 'components', 'Roster.tsx'), join(APP_SRC, 'components', 'Toast.tsx')];
    expect(violations(files)).toEqual([]);
  });
});
