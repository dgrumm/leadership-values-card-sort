#!/usr/bin/env node
/**
 * Spec status: `specs/status.json` is generated, never hand-edited.
 *
 * Default run: parse frontmatter of specs/**\/*.md, validate status.json
 * against it (every spec present exactly once; id/title/phase/depends_on
 * match; depends_on ids exist; statuses in {not-started, in-progress, done}),
 * print a status table, exit non-zero on drift.
 *
 * `--set <id> <status>`: the only sanctioned write path — regenerates
 * status.json from spec frontmatter, applying the new status.
 *
 * `--specs-dir <dir>` / `--status-file <file>`: override locations (tests).
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const VALID_STATUSES = ['not-started', 'in-progress', 'done'];

function collectMarkdown(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      collectMarkdown(fullPath, files);
    } else if (entry.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function parseScalar(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }
  return trimmed.replace(/^"(.*)"$/, '$1');
}

/** Parse `--- ... ---` frontmatter. Returns null when a file has none. */
export function parseFrontmatter(markdown) {
  const match = /^---\n([\s\S]*?)\n---/.exec(markdown);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1 || line.trim() === '') continue;
    fields[line.slice(0, colon).trim()] = parseScalar(line.slice(colon + 1));
  }
  return fields;
}

/** Read every spec's frontmatter from specsDir. Throws on malformed specs. */
export function readSpecs(specsDir) {
  const specs = [];
  for (const file of collectMarkdown(specsDir)) {
    const frontmatter = parseFrontmatter(readFileSync(file, 'utf8'));
    if (!frontmatter) continue; // README etc.
    for (const key of ['id', 'title', 'phase', 'depends_on']) {
      if (frontmatter[key] === undefined) {
        throw new Error(`${file}: frontmatter missing "${key}"`);
      }
    }
    specs.push({
      id: frontmatter.id,
      title: frontmatter.title,
      phase: frontmatter.phase,
      depends_on: frontmatter.depends_on,
      file,
    });
  }
  return specs;
}

/** Validate a status.json document against spec frontmatter. Returns error strings. */
export function validate(specs, statusDoc) {
  const errors = [];
  const entries = Array.isArray(statusDoc?.specs) ? statusDoc.specs : null;
  if (!entries) {
    return ['status.json: expected shape { "specs": [...] }'];
  }

  const specIds = new Set(specs.map((s) => s.id));
  const seen = new Map();
  for (const entry of entries) {
    seen.set(entry.id, (seen.get(entry.id) ?? 0) + 1);
  }

  for (const [id, count] of seen) {
    if (count > 1) errors.push(`status.json: spec "${id}" listed ${count} times`);
    if (!specIds.has(id)) errors.push(`status.json: spec "${id}" has no spec file`);
  }
  for (const spec of specs) {
    if (!seen.has(spec.id)) {
      errors.push(`status.json: spec "${spec.id}" (${spec.title}) is missing`);
    }
  }

  const byId = new Map(entries.map((e) => [e.id, e]));
  for (const spec of specs) {
    const entry = byId.get(spec.id);
    if (!entry) continue;
    if (entry.title !== spec.title) {
      errors.push(`spec "${spec.id}": title drift — spec file says "${spec.title}", status.json says "${entry.title}"`);
    }
    if (entry.phase !== spec.phase) {
      errors.push(`spec "${spec.id}": phase drift — spec file says "${spec.phase}", status.json says "${entry.phase}"`);
    }
    if (JSON.stringify(entry.depends_on) !== JSON.stringify(spec.depends_on)) {
      errors.push(`spec "${spec.id}": depends_on drift — spec file says ${JSON.stringify(spec.depends_on)}, status.json says ${JSON.stringify(entry.depends_on)}`);
    }
    for (const dep of spec.depends_on) {
      if (!specIds.has(dep)) {
        errors.push(`spec "${spec.id}": depends_on "${dep}" does not exist`);
      }
    }
    if (!VALID_STATUSES.includes(entry.status)) {
      errors.push(`spec "${spec.id}": invalid status "${entry.status}" (expected ${VALID_STATUSES.join(' | ')})`);
    }
  }
  return errors;
}

/** Regenerate the status.json document from frontmatter, applying setId → setStatus. */
export function generate(specs, previousDoc, setId, setStatus) {
  const previous = new Map((previousDoc?.specs ?? []).map((e) => [e.id, e.status]));
  return {
    specs: specs.map((spec) => ({
      id: spec.id,
      title: spec.title,
      phase: spec.phase,
      depends_on: spec.depends_on,
      status: spec.id === setId ? setStatus : (previous.get(spec.id) ?? 'not-started'),
    })),
  };
}

function printTable(specs, statusDoc) {
  const statusById = new Map((statusDoc?.specs ?? []).map((e) => [e.id, e.status]));
  const idWidth = Math.max(...specs.map((s) => s.id.length), 4);
  const titleWidth = Math.max(...specs.map((s) => s.title.length), 5);
  console.log(`${'id'.padEnd(idWidth)}  ${'title'.padEnd(titleWidth)}  status`);
  for (const spec of specs) {
    console.log(
      `${spec.id.padEnd(idWidth)}  ${spec.title.padEnd(titleWidth)}  ${statusById.get(spec.id) ?? '???'}`,
    );
  }
}

function parseArgs(argv) {
  const args = { specsDir: path.join(REPO_ROOT, 'specs'), statusFile: null, set: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--specs-dir') args.specsDir = path.resolve(argv[++i]);
    else if (arg === '--status-file') args.statusFile = path.resolve(argv[++i]);
    else if (arg === '--set') args.set = { id: argv[++i], status: argv[++i] };
    else throw new Error(`unknown argument: ${arg}`);
  }
  args.statusFile ??= path.join(args.specsDir, 'status.json');
  return args;
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const args = parseArgs(process.argv.slice(2));
  const specs = readSpecs(args.specsDir);
  const statusDoc = JSON.parse(readFileSync(args.statusFile, 'utf8'));

  if (args.set) {
    const { id, status } = args.set;
    if (!VALID_STATUSES.includes(status)) {
      console.error(`spec-status: invalid status "${status}" (expected ${VALID_STATUSES.join(' | ')})`);
      process.exit(1);
    }
    if (!specs.some((s) => s.id === id)) {
      console.error(`spec-status: unknown spec id "${id}"`);
      process.exit(1);
    }
    const next = generate(specs, statusDoc, id, status);
    writeFileSync(args.statusFile, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`spec-status: set ${id} → ${status}`);
    printTable(specs, next);
    process.exit(0);
  }

  const errors = validate(specs, statusDoc);
  printTable(specs, statusDoc);
  if (errors.length > 0) {
    console.error('\nspec-status: status.json has drifted from spec frontmatter:');
    for (const error of errors) console.error(`  - ${error}`);
    console.error('\nFix with: pnpm spec:status --set <id> <status> (never hand-edit status.json)');
    process.exit(1);
  }
  console.log('\nspec-status: OK');
}
