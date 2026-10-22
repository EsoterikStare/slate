# Slate — Instructions for Claude

Project context and every design decision live in [PLANNING.md](PLANNING.md).
Read it before changing behaviour; record new decisions there.

## Commands

- `pnpm test` — Vitest (happy-dom, pinned to `America/Los_Angeles` so date
  tests hit real DST transitions)
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm build` — single ES module at `dist/slate.js` (what HA loads)
- `pnpm storybook` — component gallery at http://127.0.0.1:6006
- `pnpm deploy:dev` — build and copy to HA over the Samba share (see README)

## Structure

- Pure logic (layout, date math, formatting, event merging) lives in plain
  `.ts` modules with no DOM or Lit, e.g. `src/calendar/layout.ts`. Cards
  measure the DOM and feed numbers in; they don't contain layout decisions.
- Date math works on local midnights and steps with `setDate()`, never by
  adding 24h of milliseconds (DST days are 23h/25h).

## Testing: add/change something → add/update its test

- Tests are colocated: `layout.ts` + `layout.test.ts`.
- New function or behaviour gets a test in the same change. Changed behaviour
  means updating the existing test to the new intent.
- A bug fix gets a regression test that fails on the old code. Confirm it
  fails before fixing.
- Not every test earns its place. Skip tests that are tautological (the setup
  creates exactly the state being asserted) or that only re-check a guarantee
  the platform or library already makes. Prefer asserting observable outcomes
  over implementation details.
- What tests can't judge (visual appearance, animation, how it reads from
  across the room) gets checked in Storybook and on the real kiosk.
