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
  server: {
    // For the "live dev dashboard": HA (another origin on the LAN) loads
    // http://<this-pc>:5173/src/index.ts as a module, which needs CORS.
    // Dev server only; `pnpm dev` already listens on the LAN via --host.
    cors: true,
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    // Pin a zone with DST so date tests exercise 23h/25h days on any machine.
    env: { TZ: 'America/Los_Angeles' },
  },
});
