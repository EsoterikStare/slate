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

## Privacy: this repo is public

Never commit personal data: real names, usernames, email addresses (other
than GitHub/Anthropic noreply), IP addresses, hostnames, device names, Home
Assistant entity names or IDs from the owner's setup, or real calendar
content. Use placeholders (`<ha-ip>`, `<pi-ip>`, `calendar.alex`) in docs,
tests, stories and scripts. Scripts must take such values as arguments,
never hard-code them.

- A pre-commit and commit-msg hook (`.githooks/`, enabled with
  `git config core.hooksPath .githooks`) runs `scripts/privacy/check.mjs`,
  which blocks emails, private IPs, Windows home folders, a non-noreply commit
  author, and every term in `.privacy-denylist`. That file is git-ignored and
  local only. Never commit it, never quote its contents into tracked files,
  and never bypass the hook (`--no-verify`).
- The check refuses any commit that includes `.privacy-denylist` itself
  (even force-added), without printing its contents.
- CI runs the same check, minus the private denylist, on every push, and
  masks what it finds, because Actions logs on a public repo are public.
- When adding a personal detail anywhere locally (config, chat), add it to
  `.privacy-denylist` too.

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
