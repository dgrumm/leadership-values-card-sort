import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { generate, readSpecs, validate } from './spec-status.mjs';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(SCRIPTS_DIR, 'spec-status.mjs');
const REPO_ROOT = path.resolve(SCRIPTS_DIR, '..');

const tempDirs: string[] = [];

interface SpecSeed {
  id: string;
  title: string;
  phase: string;
  depends_on: string[];
}

const SEEDS: SpecSeed[] = [
  { id: '00.1', title: 'Repo & CI skeleton', phase: '00-foundation', depends_on: [] },
  { id: '00.2', title: 'Shared schemas', phase: '00-foundation', depends_on: ['00.1'] },
];

function specMarkdown(seed: SpecSeed): string {
  return [
    '---',
    `id: "${seed.id}"`,
    `title: ${seed.title}`,
    `phase: ${seed.phase}`,
    `depends_on: ${JSON.stringify(seed.depends_on)}`,
    `branch: feature/${seed.id.replace('.', '-')}`,
    '---',
    '',
    '## Scope',
  ].join('\n');
}

function makeSpecsDir(seeds: SpecSeed[] = SEEDS, statuses: Record<string, string> = {}): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'spec-status-'));
  tempDirs.push(dir);
  for (const seed of seeds) {
    const phaseDir = path.join(dir, seed.phase);
    mkdirSync(phaseDir, { recursive: true });
    writeFileSync(path.join(phaseDir, `${seed.id}.md`), specMarkdown(seed));
  }
  const doc = {
    specs: seeds.map((seed) => ({ ...seed, status: statuses[seed.id] ?? 'not-started' })),
  };
  writeFileSync(path.join(dir, 'status.json'), JSON.stringify(doc, null, 2));
  return dir;
}

function runCli(specsDir: string, extraArgs: string[] = []): { status: number; output: string } {
  try {
    const output = execFileSync('node', [SCRIPT, '--specs-dir', specsDir, ...extraArgs], {
      encoding: 'utf8',
    });
    return { status: 0, output };
  } catch (error) {
    const { status, stdout, stderr } = error as { status: number; stdout: string; stderr: string };
    return { status, output: `${stdout}${stderr}` };
  }
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('spec-status', () => {
  it('passes when status.json matches spec frontmatter', () => {
    const dir = makeSpecsDir();
    const result = runCli(dir);
    expect(result.status).toBe(0);
    expect(result.output).toContain('spec-status: OK');
    expect(result.output).toContain('00.1');
  });

  it('exits non-zero when an id is out of sync (missing from status.json)', () => {
    const dir = makeSpecsDir();
    const statusFile = path.join(dir, 'status.json');
    const doc = JSON.parse(readFileSync(statusFile, 'utf8')) as { specs: { id: string }[] };
    doc.specs = doc.specs.filter((entry) => entry.id !== '00.2');
    writeFileSync(statusFile, JSON.stringify(doc, null, 2));
    const result = runCli(dir);
    expect(result.status).toBe(1);
    expect(result.output).toContain('"00.2"');
  });

  it('exits non-zero on phase drift', () => {
    const dir = makeSpecsDir();
    const statusFile = path.join(dir, 'status.json');
    const raw = readFileSync(statusFile, 'utf8').replace('"phase": "00-foundation"', '"phase": "99-wrong"');
    writeFileSync(statusFile, raw);
    const result = runCli(dir);
    expect(result.status).toBe(1);
    expect(result.output).toContain('phase drift');
  });

  it('exits non-zero on depends_on drift', () => {
    const dir = makeSpecsDir();
    const statusFile = path.join(dir, 'status.json');
    const doc = JSON.parse(readFileSync(statusFile, 'utf8')) as {
      specs: { id: string; depends_on: string[] }[];
    };
    const entry = doc.specs.find((candidate) => candidate.id === '00.2');
    if (entry) entry.depends_on = [];
    writeFileSync(statusFile, JSON.stringify(doc, null, 2));
    const result = runCli(dir);
    expect(result.status).toBe(1);
    expect(result.output).toContain('depends_on drift');
  });

  it('rejects invalid status values', () => {
    const dir = makeSpecsDir(SEEDS, { '00.1': 'shipped' });
    const result = runCli(dir);
    expect(result.status).toBe(1);
    expect(result.output).toContain('invalid status "shipped"');
  });

  it('flags depends_on ids that do not exist', () => {
    const seeds: SpecSeed[] = [{ id: '00.1', title: 'A', phase: 'p', depends_on: ['99.9'] }];
    const dir = makeSpecsDir(seeds);
    const result = runCli(dir);
    expect(result.status).toBe(1);
    expect(result.output).toContain('"99.9" does not exist');
  });

  it('--set updates the status file and validation then passes', () => {
    const dir = makeSpecsDir();
    const setResult = runCli(dir, ['--set', '00.1', 'done']);
    expect(setResult.status).toBe(0);
    const doc = JSON.parse(readFileSync(path.join(dir, 'status.json'), 'utf8')) as {
      specs: { id: string; status: string }[];
    };
    expect(doc.specs.find((entry) => entry.id === '00.1')?.status).toBe('done');
    expect(runCli(dir).status).toBe(0);
  });

  it('--set rejects unknown ids and invalid statuses', () => {
    const dir = makeSpecsDir();
    expect(runCli(dir, ['--set', '99.9', 'done']).status).toBe(1);
    expect(runCli(dir, ['--set', '00.1', 'nope']).status).toBe(1);
  });

  it('validates the real specs/ directory', () => {
    const specs = readSpecs(path.join(REPO_ROOT, 'specs'));
    expect(specs.length).toBeGreaterThanOrEqual(16);
    const statusDoc = JSON.parse(readFileSync(path.join(REPO_ROOT, 'specs', 'status.json'), 'utf8'));
    expect(validate(specs, statusDoc)).toEqual([]);
  });

  it('generate defaults new specs to not-started', () => {
    const specs = [{ id: '00.1', title: 'A', phase: 'p', depends_on: [], file: 'a.md' }];
    const doc = generate(specs, { specs: [] }, undefined, undefined);
    expect(doc.specs[0]?.status).toBe('not-started');
  });
});
