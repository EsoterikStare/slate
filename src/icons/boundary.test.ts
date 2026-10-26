// src/icons is meant to become its own package, so its code must not reach
// into the dashboard. Stories are exempt: they borrow the dashboard's test
// photos and show the Meteocons originals for comparison.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve('src/icons');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : e.name.endsWith('.ts') && !e.name.endsWith('.stories.ts') ? [join(dir, e.name)] : [],
  );
}

describe('src/icons', () => {
  it('imports only its own modules and packages, never the dashboard', () => {
    const outside = sources(ROOT).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/(?:from|import)\s+'(\.[^']*)'/g)]
        .map((m) => m[1]!)
        .filter((spec) => relative(ROOT, resolve(file, '..', spec)).startsWith('..'))
        .map((spec) => `${relative(ROOT, file)} → ${spec}`),
    );
    expect(outside).toEqual([]);
  });
});
