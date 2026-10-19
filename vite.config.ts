import { defineConfig } from 'vitest/config';

// One self-contained ES module that HA loads as a dashboard resource.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'wall-cards.js',
    },
    outDir: 'dist',
    target: 'es2022',
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    // Pin a zone with DST so date tests exercise 23h/25h days on any machine.
    env: { TZ: 'America/Los_Angeles' },
  },
});
