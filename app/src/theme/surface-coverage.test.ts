import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// 00.6: pack-agnostic surface-composition gate. Nothing outside theme/ may
// hand-assemble a surface (fill + blur + border + shadow) instead of composing
// `.panel` / `.panel-strong` / `.scrim` — the opaque `bg-surface-raised` fallback is
// exactly that hand-assembly, so it remains the detection signature (00.5's rule,
// generalized: it was never about glass specifically, it was about not bypassing
// the shared surface primitives).
const APP_SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

/*
 * Source files only — test files are skipped. A test names class strings as data
 * (this file's own allowlist and matcher both contain `bg-surface-raised`), so
 * scanning them would flag the guard as its own violation. The old routes-only
 * glob dodged this by accident; the app-wide scan has to be explicit.
 */
function collectFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      collectFiles(fullPath, files);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
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

/*
 * Surfaces that are opaque ON PURPOSE, each for a reason that is not "we forgot".
 *
 * This allowlist exists because the gate used to scan only `routes/**` plus two
 * named components, which let `bg-surface-raised` survive in four unscanned
 * files — so 00.5's "one system-wide surface" claim was not actually enforced
 * anywhere outside routes, and new opaque panels in `engine-ui/` or `session/`
 * would have shipped silently. The scan below now covers all of `app/src`;
 * anything genuinely opaque has to be listed here with its reason, so the
 * exceptions are a decision on the record instead of a gap in the glob.
 *
 * Paths are relative to app/src.
 */
const INTENTIONALLY_OPAQUE: Record<string, string> = {
  'engine-ui/Plaque.tsx':
    'Export artifact. 04.1 renders this same layout through satori, which cannot ' +
    'render backdrop-filter — the component comment pins it to satori-safe CSS ' +
    '(architecture §12). Glass here would desync the wall from the exported PNG.',
  'engine-ui/RankBoard.tsx':
    'Drag surface. A blurred backdrop recomposites every frame while a row is ' +
    'dragged; the opaque fill keeps the drag cheap.',
  'components/Button.tsx':
    'Control, not a panel. The secondary variant needs a solid fill to stay legible ' +
    'at small sizes; glass is the system\'s panel treatment.',
  'session/ConnectionPill.tsx':
    'Status pill floating over arbitrary content — needs a solid fill to stay ' +
    'readable regardless of what scrolls beneath it.',
};

describe('surface composition coverage', () => {
  it('no unlisted bg-surface-raised anywhere under app/src', () => {
    const allowed = new Set(Object.keys(INTENTIONALLY_OPAQUE).map((p) => join(APP_SRC, p)));
    const unexpected = violations(collectFiles(APP_SRC)).filter(
      (hit) => !allowed.has(hit.slice(0, hit.lastIndexOf(':'))),
    );
    expect(unexpected).toEqual([]);
  });

  // Guards the allowlist itself: an entry that stops being true is a stale
  // exemption, and a stale exemption is how the original hole would grow back.
  it('every allowlisted file still uses bg-surface-raised', () => {
    const stale = Object.keys(INTENTIONALLY_OPAQUE).filter(
      (p) => violations([join(APP_SRC, p)]).length === 0,
    );
    expect(stale).toEqual([]);
  });
});
