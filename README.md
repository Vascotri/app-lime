# app-template

The **web golden path** for the inex26 agent company. A new app = clone this, rename, build.

**Stack:** Next.js (App Router) · TypeScript (strict) · ESLint + Prettier · Vitest · CI on PRs · deploy on Vercel.

## Scripts
```bash
npm install
npm run dev        # local dev server
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
npm run test       # vitest
npm run build      # production build
npm run format     # prettier --write
```

## Layout
```
app/        # Next.js App Router (layout.tsx, page.tsx, globals.css)
lib/        # framework-free logic + its tests (greeting.ts is a placeholder example)
.github/    # CI (typecheck + lint + test + build on every PR)
CLAUDE.md   # how agents should work in this repo (points at the hq standards)
```

## Deploy (Vercel)
Connect this repo to Vercel — it auto-detects Next.js. Every PR gets a **preview URL**; merges to
`main` deploy to **production**. Set env vars in Vercel with separate **Preview** and **Production**
scopes (see `.env.example`). Attach a custom domain in the Vercel project's Domains tab.

## New app from this template
```bash
gh repo create inex26/app-<name> --private --template inex26/app-template
```
(or clone + re-`git init` + push). Then connect it to Vercel.
