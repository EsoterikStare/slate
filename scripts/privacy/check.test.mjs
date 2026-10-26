// Runs check.mjs against a throwaway git repository, as the hooks and CI do.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CHECK = resolve('scripts/privacy/check.mjs');
// Assembled at runtime so this file has no literal email for the check to trip on.
const personalEmail = ['someone', 'mailprovider.test'].join('@');
const noreply = ['12345678+someone', 'users.noreply.github.com'].join('@');

let repo;
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
const check = (args, env = {}) => {
  const r = spawnSync(process.execPath, [CHECK, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, CI: '', ...env },
  });
  return { code: r.status, out: r.stdout + r.stderr };
};

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'slate-privacy-'));
  git('init', '-q');
  git('config', 'user.name', 'someone');
  git('config', 'user.email', noreply);
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe('check.mjs', () => {
  it('refuses a force-added denylist without printing what it lists', () => {
    writeFileSync(join(repo, '.privacy-denylist'), 'Jordan\n');
    git('add', '-f', '.privacy-denylist');
    const r = check(['--staged']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('.privacy-denylist must never be committed');
    expect(r.out).not.toContain('Jordan');
  });

  it('refuses a tracked denylist in a full scan too', () => {
    writeFileSync(join(repo, '.privacy-denylist'), 'Jordan\n');
    git('add', '-f', '.privacy-denylist');
    expect(check(['--all']).code).toBe(1);
  });

  it('blocks staged personal data, naming the full value locally', () => {
    writeFileSync(join(repo, 'notes.txt'), `contact ${personalEmail}\n`);
    git('add', 'notes.txt');
    const r = check(['--staged']);
    expect(r.code).toBe(1);
    expect(r.out).toContain(`notes.txt:1  email address: ${personalEmail}`);
  });

  it('masks what it found when running in CI, whose logs are public', () => {
    writeFileSync(join(repo, 'notes.txt'), `contact ${personalEmail}\n`);
    git('add', 'notes.txt');
    const r = check(['--all'], { CI: 'true' });
    expect(r.code).toBe(1);
    expect(r.out).toContain('notes.txt:1  email address: so••');
    expect(r.out).not.toContain(personalEmail);
  });

  it('refuses a commit author with a personal email address', () => {
    git('config', 'user.email', personalEmail);
    writeFileSync(join(repo, 'ok.txt'), 'nothing personal\n');
    git('add', 'ok.txt');
    const r = check(['--staged']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('author email is not a noreply address');
  });

  it('passes clean changes', () => {
    writeFileSync(join(repo, 'ok.txt'), 'nothing personal\n');
    git('add', 'ok.txt');
    expect(check(['--staged']).code).toBe(0);
  });
});
