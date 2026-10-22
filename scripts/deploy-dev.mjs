// Copies the built bundle into Home Assistant's /config/www over the Samba
// share add-on, for checking a build on the real kiosk before releasing.
// Usage: pnpm deploy:dev   (builds first; see package.json)
// Target: SLATE_DEPLOY_DIR, default \\homeassistant.local\config\www\slate

import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const target = process.env.SLATE_DEPLOY_DIR ?? String.raw`\\homeassistant.local\config\www\slate`;
const source = 'dist/slate.js';

const bundle = await readFile(source);
const version = createHash('sha256').update(bundle).digest('hex').slice(0, 10);

try {
  await mkdir(target, { recursive: true });
  await copyFile(source, join(target, 'slate.js'));
} catch (err) {
  console.error(`Could not copy to ${target}: ${err.message}`);
  console.error('Is the Samba share add-on running, and have you opened the share once in Explorer to sign in?');
  console.error('Set SLATE_DEPLOY_DIR to use a different path.');
  process.exit(1);
}

console.log(`Copied ${source} → ${target}`);
console.log('');
console.log('Point the dashboard resource at (the ?v= makes browsers fetch the new copy):');
console.log(`  /local/slate/slate.js?v=${version}`);
