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

function violations(files: string[], pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const file of files) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (pattern.test(line)) hits.push(`${file}:${index + 1}`);
      });
  }
  return hits;
}

/** The opaque-panel fallback: a fill that bypasses the surface primitives entirely. */
const OPAQUE_FILL = /bg-surface-raised/;

/**
 * Hand-rolled blur. `.panel`/`.scrim` own `backdrop-filter` (driven by
 * `--panel-blur`/`--scrim-blur`), so any blur utility outside `theme/` is a surface
 * being assembled by hand — the precise thing this gate exists to stop, and the case
 * that a `bg-surface-raised`-only scan silently passed.
 */
const HAND_ROLLED_BLUR = /backdrop-blur|backdrop-filter/;

/**
 * Reaching past the class into a pack primitive. Composing `.panel`/`.panel-strong`
 * is the contract; reading `var(--panel-*)` directly re-implements part of it and
 * drifts the moment the class gains a property.
 */
const RAW_PRIMITIVE = /var\(--(panel|scrim)-/;

function allowedPaths(allowlist: Record<string, string>): Set<string> {
  return new Set(Object.keys(allowlist).map((p) => join(APP_SRC, p)));
}

const THEME_DIR = join(APP_SRC, 'theme');

/**
 * `theme/` is where surfaces are legitimately defined, so the blur and raw-primitive
 * rules must exclude it — they are rules about consumers, not about the definition
 * site. (`theme/packs/types.ts` documents `backdrop-filter` in a doc comment; scanning
 * it flagged the gate against its own source of truth.)
 */
function consumerFiles(): string[] {
  return collectFiles(APP_SRC).filter((f) => !f.startsWith(THEME_DIR));
}

function unlisted(
  pattern: RegExp,
  allowlist: Record<string, string>,
  files: string[] = collectFiles(APP_SRC),
): string[] {
  const allowed = allowedPaths(allowlist);
  return violations(files, pattern).filter(
    (hit) => !allowed.has(hit.slice(0, hit.lastIndexOf(':'))),
  );
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

/**
 * Files that read a pack primitive directly instead of composing a class.
 *
 * Only one, and it is a genuine nesting constraint rather than a shortcut: GameCard's
 * front face sits *inside* the card's own `.panel`, so composing `.panel-strong` there
 * would stack a second border and shadow on top of the first (card-in-card). It needs
 * the fill alone, which no class exposes on its own.
 */
const PRIMITIVE_ESCAPES: Record<string, string> = {
  'components/GameCard.tsx':
    'Front face nests inside the card\'s own .panel — composing .panel-strong would ' +
    'double the border and shadow. Needs the fill only, which no class exposes alone.',
};

describe('surface composition coverage', () => {
  it('no unlisted bg-surface-raised anywhere under app/src', () => {
    expect(unlisted(OPAQUE_FILL, INTENTIONALLY_OPAQUE)).toEqual([]);
  });

  // Guards the allowlist itself: an entry that stops being true is a stale
  // exemption, and a stale exemption is how the original hole would grow back.
  it('every allowlisted file still uses bg-surface-raised', () => {
    const stale = Object.keys(INTENTIONALLY_OPAQUE).filter(
      (p) => violations([join(APP_SRC, p)], OPAQUE_FILL).length === 0,
    );
    expect(stale).toEqual([]);
  });

  /*
   * The two rules that make this gate live up to its name. Without them the scan
   * detected one utility class (`bg-surface-raised`) while claiming to catch
   * hand-assembled surfaces generally — so a panel built by hand out of
   * `bg-[var(--panel-bg)] backdrop-blur-md border shadow-*` passed cleanly. Verified
   * against exactly that construction.
   */
  it('no hand-rolled blur outside theme/ — .panel and .scrim own backdrop-filter', () => {
    expect(unlisted(HAND_ROLLED_BLUR, {}, consumerFiles())).toEqual([]);
  });

  it('no unlisted raw var(--panel-*/--scrim-*) outside theme/', () => {
    expect(unlisted(RAW_PRIMITIVE, PRIMITIVE_ESCAPES, consumerFiles())).toEqual([]);
  });

  it('every primitive-escape entry still reads a raw primitive', () => {
    const stale = Object.keys(PRIMITIVE_ESCAPES).filter(
      (p) => violations([join(APP_SRC, p)], RAW_PRIMITIVE).length === 0,
    );
    expect(stale).toEqual([]);
  });
});
