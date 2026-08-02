#!/usr/bin/env node
/**
 * Token lint: enforces tenet 5 — "Tokens or it doesn't merge".
 *
 * Scans app/src/** (excluding app/src/theme/**, where tokens are defined)
 * and fails on:
 *   (a) raw Tailwind palette classes  e.g. bg-blue-500
 *   (b) hex color literals            e.g. #ff0000
 *   (c) inline z-index                e.g. z-[999] or `zIndex:` in TSX/CSS
 *
 * Prints file:line for every violation and exits non-zero if any are found.
 * Usage: node scripts/token-lint.mjs [rootDir]   (rootDir defaults to app/src)
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const RULES = [
  {
    name: 'raw-palette-class',
    pattern:
      /\b(bg|text|border|ring|fill|stroke|from|via|to|shadow|outline|decoration|accent|caret|divide)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/,
    message: 'raw Tailwind palette class — use an @theme token instead',
  },
  {
    name: 'hex-color-literal',
    pattern: /#[0-9a-fA-F]{3,8}\b/,
    message: 'hex color literal — use an @theme token instead',
  },
  {
    name: 'inline-z-index',
    pattern: /z-\[|zIndex\s*:/,
    message: 'inline z-index — use a --z-* token instead',
  },
];

const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html']);
const EXCLUDED_DIR_NAME = 'theme';

function collectFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (entry === EXCLUDED_DIR_NAME || entry === 'node_modules') continue;
      collectFiles(fullPath, files);
    } else if (SCANNED_EXTENSIONS.has(path.extname(entry))) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Lint every scannable file under rootDir (excluding any `theme/` directory).
 * Returns violations as { file, line, rule, message, text }.
 */
export function lintDir(rootDir) {
  const violations = [];
  let files = [];
  try {
    files = collectFiles(rootDir);
  } catch {
    return violations; // nothing to scan yet
  }
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, index) => {
      for (const rule of RULES) {
        if (rule.pattern.test(text)) {
          violations.push({
            file,
            line: index + 1,
            rule: rule.name,
            message: rule.message,
            text: text.trim(),
          });
        }
      }
    });
  }
  return violations;
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const rootDir = path.resolve(REPO_ROOT, process.argv[2] ?? 'app/src');
  const violations = lintDir(rootDir);
  if (violations.length > 0) {
    for (const v of violations) {
      console.error(`${path.relative(REPO_ROOT, v.file)}:${v.line} [${v.rule}] ${v.message}`);
      console.error(`  ${v.text}`);
    }
    console.error(`\ntoken-lint: ${violations.length} violation(s) found.`);
    process.exit(1);
  }
  console.log(`token-lint: OK (${path.relative(REPO_ROOT, rootDir)} clean; theme/ excluded)`);
}
