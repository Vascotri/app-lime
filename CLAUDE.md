# CLAUDE.md — (app)

A product app in the **inex26** agent company. The canonical standards live in the **hq** repo
(`AGENTS.md` + `standards/`); the essentials, inlined:

- **Stack:** Next.js (App Router) + **TypeScript strict** (no `any`). Deployed on **Vercel**.
- **Done means green:** `npm run typecheck && npm run lint && npm run test && npm run test:e2e &&
  npm run build` all pass. `test:e2e` is the **mobile responsive gate** (Playwright at 375px) — run it
  before you finish any user-facing change. A bug fix adds a regression test.
- **Mobile is the default, not an afterthought.** No horizontal scroll at 360–390px wide. Overlays/
  modals/cards must fit the phone: `max-width:100%`, centered with auto margins + a viewport-edge gutter,
  `max-height` with internal scroll, and respect safe-area insets. Long unbreakable strings (URLs,
  emails, invite codes) must wrap (`overflow-wrap:anywhere`) or truncate — never force the page wider.
  When you add or change a user-facing route/state, add it to `tests/e2e/responsive.spec.ts`.
- **Small, focused changes**; match existing patterns before inventing new ones.
- **Design every state** — loading, empty, error, success — not just the happy path. Accessibility is
  non-negotiable (labels, contrast, keyboard, ≥44px targets).
- **Environments are isolated:** Preview (per-PR) and Production have separate env/secrets. Never
  touch production data. Real secrets live in Vercel env vars, never in the repo.
- **Ask before anything irreversible** (deleting data, spending money, publishing externally).
