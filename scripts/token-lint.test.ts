import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { lintDir } from './token-lint.mjs';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPTS_DIR, '..');
const FIXTURES = path.join(SCRIPTS_DIR, 'fixtures', 'token-lint');

const tempDirs: string[] = [];

function makeAppSrc(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'token-lint-'));
  tempDirs.push(dir);
  const src = path.join(dir, 'app', 'src');
  mkdirSync(src, { recursive: true });
  // theme/ is the sanctioned home for raw values — copy the real tokens file in.
  mkdirSync(path.join(src, 'theme'), { recursive: true });
  cpSync(
    path.join(REPO_ROOT, 'app', 'src', 'theme', 'tokens.css'),
    path.join(src, 'theme', 'tokens.css'),
  );
  return src;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('token-lint', () => {
  it('passes on app/src/theme/tokens.css (theme dir is excluded)', () => {
    const src = makeAppSrc();
    expect(lintDir(src)).toEqual([]);
  });

  it('fails when a fixture with bg-blue-500, #ff0000 and z-[999] is placed under app/src/', () => {
    const src = makeAppSrc();
    cpSync(path.join(FIXTURES, 'violations.tsx.txt'), path.join(src, 'components', 'Bad.tsx'), {
      recursive: true,
    });
    const violations = lintDir(src);
    const rules = violations.map((v) => v.rule);
    expect(rules).toContain('raw-palette-class');
    expect(rules).toContain('hex-color-literal');
    expect(rules).toContain('inline-z-index');
    for (const v of violations) {
      expect(v.line).toBeGreaterThan(0);
      expect(v.file).toContain('Bad.tsx');
    }
  });

  it('flags zIndex: style props', () => {
    const src = makeAppSrc();
    writeFileSync(path.join(src, 'Overlay.tsx'), 'const s = { zIndex: 999 };\n');
    expect(lintDir(src).map((v) => v.rule)).toEqual(['inline-z-index']);
  });

  it('CLI exits non-zero and prints file:line on violations', () => {
    const src = makeAppSrc();
    cpSync(path.join(FIXTURES, 'violations.tsx.txt'), path.join(src, 'Bad.tsx'));
    let failed = false;
    try {
      execFileSync('node', [path.join(SCRIPTS_DIR, 'token-lint.mjs'), src], {
        encoding: 'utf8',
      });
    } catch (error) {
      failed = true;
      const { status, stderr } = error as { status: number; stderr: string };
      expect(status).toBe(1);
      expect(stderr).toMatch(/Bad\.tsx:\d+/);
    }
    expect(failed).toBe(true);
  });

  it('CLI passes on the real app/src', () => {
    const stdout = execFileSync('node', [path.join(SCRIPTS_DIR, 'token-lint.mjs')], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
    });
    expect(stdout).toContain('token-lint: OK');
  });
});
