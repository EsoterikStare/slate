// Tests the boot command-line handling in setup-kiosk.sh by sourcing the
// script (it stops before doing anything when sourced) and calling its
// functions in bash, against temporary files.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = resolve('scripts/pi/setup-kiosk.sh').replace(/\\/g, '/');

// Same shape as Raspberry Pi OS's cmdline.txt, with neutral values. Like the
// real file, it has NO trailing newline: that's what broke the first version.
const ORIGINAL =
  'console=serial0,115200 console=tty1 root=PARTUUID=00000000-02 rootfstype=ext4 fsck.repair=yes rootwait quiet splash plymouth.ignore-serial-consoles';

let dir;
let file;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'slate-cmdline-'));
  file = join(dir, 'cmdline.txt').replace(/\\/g, '/');
  writeFileSync(file, ORIGINAL);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** Runs bash with the script's functions loaded; SUDO is empty so nothing escalates. */
function bash(commands) {
  const r = spawnSync('bash', ['-c', `set -euo pipefail; source "${SCRIPT}"; ${commands}`], {
    encoding: 'utf8',
    env: { ...process.env, SUDO: '' },
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const tokens = (line) => line.trim().split(/\s+/).sort();

describe('set_boot_cmdline', () => {
  it('rewrites a cmdline.txt without a trailing newline instead of emptying it', () => {
    const r = bash(`set_boot_cmdline "${file}" silent`);
    expect(r.code).toBe(0);
    const written = readFileSync(file, 'utf8');
    expect(written).toContain('root=PARTUUID=00000000-02');
    expect(tokens(written)).toEqual(
      tokens(
        'console=serial0,115200 console=tty3 root=PARTUUID=00000000-02 rootfstype=ext4 fsck.repair=yes rootwait quiet loglevel=3 logo.nologo vt.global_cursor_default=0',
      ),
    );
  });

  it('writes the text and splash modes correctly', () => {
    bash(`set_boot_cmdline "${file}" text`);
    expect(tokens(readFileSync(file, 'utf8'))).toEqual(
      tokens('console=serial0,115200 console=tty1 root=PARTUUID=00000000-02 rootfstype=ext4 fsck.repair=yes rootwait'),
    );
    bash(`set_boot_cmdline "${file}" splash`);
    expect(tokens(readFileSync(file, 'utf8'))).toEqual(tokens(ORIGINAL));
  });

  it('switches cleanly between modes and is stable when repeated', () => {
    const r = bash(
      `set_boot_cmdline "${file}" silent; set_boot_cmdline "${file}" silent; ` +
        `a="$(cat "${file}")"; set_boot_cmdline "${file}" text; set_boot_cmdline "${file}" silent; ` +
        `[ "$a" = "$(cat "${file}")" ] && echo stable`,
    );
    expect(r.out.trim()).toBe('stable');
  });

  it('refuses to write a command line that would no longer boot, leaving the file alone', () => {
    writeFileSync(file, 'quiet splash');
    const r = bash(`set_boot_cmdline "${file}" silent`);
    expect(r.code).not.toBe(0);
    expect(r.err).toContain('no root= entry');
    expect(readFileSync(file, 'utf8')).toBe('quiet splash');
  });

  it('refuses an empty file rather than writing an empty one', () => {
    writeFileSync(file, '');
    expect(bash(`set_boot_cmdline "${file}" text`).code).not.toBe(0);
    expect(readFileSync(file, 'utf8')).toBe('');
  });
});
