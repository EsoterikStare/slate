#!/usr/bin/env node
// Blocks personal data from reaching this public repo. See rules.mjs.
//
//   node scripts/privacy/check.mjs --staged       files about to be committed,
//                                                 plus the commit author (pre-commit hook)
//   node scripts/privacy/check.mjs --message FILE a commit message (commit-msg hook)
//   node scripts/privacy/check.mjs --all          every tracked file (CI)
//
// Specific personal terms come from `.privacy-denylist` (git-ignored, one per
// line). Without that file only the generic patterns apply, as in CI.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { findProblems, isPublishableEmail, mask, parseDenylist } from './rules.mjs';

const DENYLIST = '.privacy-denylist';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const denylist = existsSync(DENYLIST) ? parseDenylist(readFileSync(DENYLIST, 'utf8')) : [];

// In CI the log is public: report where and what kind, but mask the value.
const show = process.env.CI ? mask : (v) => v;
const report = [];
const scan = (label, text) => {
  if (text.includes('\0')) return; // binary
  for (const p of findProblems(text, denylist)) report.push(`  ${label}:${p.line}  ${p.kind}: ${show(p.match)}`);
};
const denylistTracked = `  ${DENYLIST} must never be committed: it lists exactly what it protects`;

const [mode, arg] = process.argv.slice(2);
if (mode === '--staged') {
  const files = git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z').split('\0').filter(Boolean);
  for (const f of files) {
    if (f === DENYLIST) {
      report.push(denylistTracked);
      continue;
    }
    scan(f, git('show', `:${f}`));
  }
  for (const who of ['GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT']) {
    const ident = git('var', who).trim();
    const email = /<([^>]*)>/.exec(ident)?.[1] ?? '';
    if (!isPublishableEmail(email)) {
      report.push(`  commit ${who === 'GIT_AUTHOR_IDENT' ? 'author' : 'committer'} email is not a noreply address: ${show(email)}`);
    }
    scan(`commit ${who === 'GIT_AUTHOR_IDENT' ? 'author' : 'committer'} name`, ident.replace(/<[^>]*>.*/, ''));
  }
} else if (mode === '--message' && arg) {
  scan('commit message', readFileSync(arg, 'utf8').replace(/^#.*$/gm, ''));
} else if (mode === '--all') {
  for (const f of git('ls-files', '-z').split('\0').filter(Boolean)) {
    if (f === DENYLIST) {
      report.push(denylistTracked);
      continue;
    }
    if (!existsSync(f)) continue;
    scan(f, readFileSync(f, 'utf8'));
  }
} else {
  console.error('usage: check.mjs --staged | --message FILE | --all');
  process.exit(2);
}

if (report.length) {
  console.error('Personal data check failed. This repo is public; remove these before committing:');
  console.error(report.join('\n'));
  console.error(`(Patterns: scripts/privacy/rules.mjs. Personal terms: ${DENYLIST}, local only.)`);
  process.exit(1);
}
console.log(`Personal data check passed (${denylist.length} denylisted terms${denylist.length ? '' : '; none configured'}).`);
