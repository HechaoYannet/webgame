# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **There is a second CLAUDE.md at `.claude/CLAUDE.md`** — that is the *multi-agent contract* (file ownership table, 6-phase workflow, the §6 design-decision rulings, environment constraints). It governs how the sub-agent cluster collaborates. **Read it before any multi-agent or data-layer work.** This root file is the operations + architecture guide for working in the code itself.

## What this is

《张强宿舍大逃杀》— a pure-frontend, zero-backend web puzzle game. The player is林哲, investigating a classmate's disappearance through a **simulated smartphone** (WeChat / QQ / SMS / phone / doorbell / album-evidence-vault — 6 apps, plus a 百度搜索 entry on the desktop). "Real websites" are **not** an in-phone browser app: each site is a full-screen hash route (`#/site/<siteId>/...`) opened in a new tab via `openSitePage(pageId)`. Collect evidence, crack passwords, call the police before a 3-minute countdown expires. Deployed to GitHub Pages; every "upload PDF / search / login backend" is faked client-side from JSON data.

## Commands

```bash
npm install                  # deps (npm only — CI uses npm ci; do not mix pnpm/yarn)
npm run dev                  # dev server → http://localhost:5173/webgame/  (note the /webgame/ base)
npm run build                # tsc -b && vite build  → dist/
npm run preview              # preview built dist
npm run typecheck            # tsc --noEmit -p tsconfig.app.json   ← use this, not bare `tsc`
npm run lint                 # oxlint  (NOT eslint)
```

- **Type checking uses a 3-file tsconfig** (`tsconfig.json` references `tsconfig.app.json` + `tsconfig.node.json`). The `typecheck` script targets `tsconfig.app.json` (which has `strict`, `paths`, `types:["vite/client"]`). `npm run build` runs `tsc -b` (project references) — both must pass.
- **No test runner is configured.** Verification is: `npm run typecheck` + `npm run build` + manual `npm run dev` playthrough (see "Verifying changes" below). A `node -e "JSON.parse(...)"` one-liner is the standard way to sanity-check data JSON.
- Path alias: `@/*` → `src/*` (configured in `tsconfig.app.json` `paths` + `vite.config.ts` `resolve.alias`; no `baseUrl` — TS 6 doesn't need it).

## Architecture — the big picture

Three layers, decoupled by a **data-as-contract** boundary. Understanding this split is the single most important thing:

### Layer 1: Data (`public/data/**/*.json`) — the contract, written by content agents
All game content (chats, contacts, moments, web pages, SMS, call scripts, puzzles, evidence, chapters, endings) lives as JSON, validated by Zod schemas at load time. **The frontend never generates JSON and never hardcodes puzzle answers** — answers live in `public/data/puzzle/puzzles.json` (single source of truth); the game layer only implements *how to validate* (`matchStrategy`), not *what the answer is*.
- `meta/` `puzzle/` — level-design data: characters, evidence registry, chapters, endings, **puzzles.json**. (There is no `clustering/clue-map.json` any more — the clue registry was removed in the 2026-08-19 rewrite.)
- `wechat/` `qq/` `browser/` `phone/` `story/` — content per platform. Chat messages are split one-file-per-thread (`messages/<threadId>.json`, referenced by `ChatThread.messageFile`) to keep files small and let writers work in parallel.

### Layer 2: Game state (`src/game/**`) + loader (`src/data/loader.ts`)
The old engine (`src/engine/**`: PuzzleService / EffectExecutor / ClueRegistry / ChapterDirector / RiskService / hooks) was **removed** in the 2026-08-19 rewrite. Current reality:
- `src/data/loader.ts` is the **only** module that touches `public/data`. It fetches via `import.meta.env.BASE_URL + 'data/...'`, validates with Zod, builds in-memory indices, and exposes **synchronous** query getters (`getChapterById`, `getPuzzleById`, …). All getters call `requireIndex()` which **throws** if data isn't loaded yet — see the load-order invariant below.
- `src/game/gameStore.ts` — Zustand store persisted to localStorage key `webgame-save` (curried `create<T>()(persist(...))` form). The state is a **minimal checkpoint**: `collectedEvidenceIds`, `solvedPuzzleIds`, chapter/ending flags, `countdowns`, settings. The v2→v3 migration deliberately strips the old engine fields (`risk` / `clue` / `unlocked*` / `visited*`). Actions are semantic only: `collectEvidence / markPuzzleSolved / startCountdown / pushEnding / resetGame`.
- `src/game/answerCheck.ts` — pure `checkAnswer(puzzleId, value)` against `puzzles.json` `answer` + `matchStrategy`. **The one and only place that knows how to validate an answer.**
- `src/game/{evidence,countdown,persistence,audio,settingsStore}.ts` — idempotent evidence collection, countdown helpers, checkpoint read/write + cross-tab sync, looping audio, settings.
- `src/utils/shellState.ts` — the shell-facing adapter and the side-effect chokepoint: notifications, incoming call, `deliverDoorbell`, `useCountdown`, `watchCountdownExpiry` (countdown 归零 → `pushEnding('bad')`), audio, vibration. **The finale (3-minute countdown + threat SMS + doorbell + heartbeat) is started here, from the phone side**, when `ev-lab-funding-report` lands in `collectedEvidenceIds` (PhoneShell subscribes to it) — sites open in a new tab and cannot drive the phone UI.
- Sites talk to the game through exactly one module: `src/sites/shared/gameEvent.ts` (`reportPuzzleSolved` / `reportEvidenceCollected` / `reportPageViewed`).
- **Risk value is currently a stub** — `useRisk` returns `{ risk: 0, isRedAlert: false, isMaxed: false }`; there is no RiskService.

### Layer 3: Apps (`src/apps/**`) — React components, one dir per app, auto-registered
- `PhoneShell/` is the device frame (not an app itself). It owns `AppRouter` (HashRouter), `AppRegistry`, `Desktop`, `StatusBar`, `NotificationBar`, `ToastHost`, `IntroScreen`, `EndingOverlay`. `src/utils/shellState.ts` adapts the game store for the shell.
- **`AppRegistry` auto-aggregates apps** via `import.meta.glob('../apps/*/manifest.ts', { eager: true })`. Each app dir has a `manifest.ts` exporting `{ appId, title, icon, route, Component, availableFrom, hiddenUntilPuzzleId? }`. Adding an app = adding a dir; the registry picks it up. **Do not hardcode the app list.**
- `ui/` — shared components (`RichBlocks` renders all `ArticleBlock` + `PageBlock` types; `ImageViewer` supports zoom for hidden details in images; `Countdown`, `Primitives`, `icons.tsx`, `theme.ts`). Apps import from `@/ui` rather than reinventing.
- `ui/atmosphere/` — the **only** place that models "how wrong things feel": `dread.ts` (chapter + evidence count + finale → level 0–3, pure `computeDread`), `AtmosphereLayer.tsx` (grain / breathing vignette / scanlines / whispers / one-frame glitch / tab-title trick), `atmosphere.css`. Mounted by `PhoneShell` over the screen. **Do not add ad-hoc horror effects in individual apps** — read `useDread()` (or the inherited `--dread` CSS var) so intensity stays single-sourced and reversible. Visual tokens (ink / bone / blood / `--font-serif` / `--font-mono`) live in `src/index.css`; shell chrome in `PhoneShell/phone-shell.css`; landing + cinematic in `PhoneShell/intro.css`.
- `PhoneShell/EndingOverlay.tsx` — renders the three endings' `epilogueBlocks` when `GameState.finished === true`, covering any app. This is the **only** consumer of `endings.json`'s epilogue text.
- **6 apps**: `WechatApp`, `QqApp` (incl. QQ空间), `PhoneApp` (dialer + call scripts, finale), `SmsApp`, `DoorbellApp` (plays `video-doorbell-dao-loop`), `AlbumApp` (evidence vault, finale). `NotesApp` (备忘录) was removed on 2026-11-26 — its notes.json spelled out the case checklist/timeline/hotline and leaked the plot.
- `src/sites/**` — 10 standalone "real website" routes (`site-lvzhong` `site-xinxwang` `site-shanhe-med` `site-arxiv` `site-news` `site-tianyancha` `site-baidu` `site-hnedu` `site-hnga` `site-ai-pdf`) sharing `sites/shared/**` (`pageContent`, `siteNav`, `placeholder`, `gameEvent`). Sites may **not** import `@/game` or `@/utils` directly.

### Load-order invariant (violating it crashes at runtime — `tsc`/`build` will NOT catch it)

**`loadGameData()` must complete before any `get*` query runs.** `src/main.tsx` awaits it before render, and `RootLayout` (`src/apps/PhoneShell/AppRouter.tsx`) re-calls it (idempotent, cache-hit) and gates the whole `<PhoneShell>` render on a `ready` flag, showing a spinner otherwise. Any shell-level component that calls a loader getter must render *inside* that gate (i.e. under `<PhoneShell>`), never above it. (There is no `initEngine()` — that was removed with the engine.)

### Static assets

Everything under `public/assets/` is referenced **by assetId without extension** from `public/data/**`; `src/utils/assetUrl.ts` turns it into a candidate-URL list and callers advance on `onError`. Naming, optimization, the full inventory, the cross-platform reuse map and the "AI watermark" cleanup log live in `docs/engineering/ASSETS.md` — **register every new asset there.** Never add a multi-megabyte original to `public/assets/` (budget: ≤25 MB total; images long-edge ≤2000 JPEG q90).

### Multi-agent ownership (summary — full table in `.claude/CLAUDE.md` §3 / `docs/engineering/AGENT_OWNERSHIP.md`)
Each directory has a single owning agent; cross-agent references go by stable IDs (`char-*`, `puzzle-*`, `ev-*`, `clue-*`, `page-*`, `ch-*`). Concretely when editing: `public/data/**` is data (content/level), `src/game/**` + `src/data/loader.ts` hold game state and loading, `src/apps/<App>/**` is that app, `src/sites/site-*/**` is that site, `public/assets/**` is the resource agent's, `src/types/index.ts` is the shared contract root. `docs/game_about/**` is **read-only source truth** — never edit.

## Key design decisions (do not regress these — they were deliberately chosen and audit-verified)

- **HashRouter, not BrowserRouter.** GitHub Pages is static; BrowserRouter deep-link refresh 404s. `vite.config.ts` `base: '/webgame/'` is required for project-page asset paths. Site routes live *inside* the same hash router (`#/site/<siteId>/...`), so they must never re-show the game intro overlay (see `isSiteHash()` in `src/App.tsx`).
- **`import.meta.env.BASE_URL` must appear literally** in code (it's statically replaced at build time). `import.meta.env['BASE_URL']` (bracket access) does **not** work.
- **`import.meta.glob` patterns must be string literals**, not variables — Vite analyzes them at build time. (A `const GLOB = '....'` then `import.meta.glob(GLOB)` fails with "Invalid glob import syntax: Could only use literals".) And `*/` inside a *string literal* is harmless; it only terminates block comments.
- **QQ password is `20251128`** (终末地公测日期，公测日见终末地官网 = `2025-11-28`), tolerated as `oneOf:["20251128","1128"]`. The earlier value `0328`/`20260328` was an **AI-hallucinated date** and is **deprecated** — it must never appear in `public/data`, `src`, or writable docs. Clue text intentionally does NOT hardcode the digits: 闫欣泽 only says "密码改成终末地公测那天", and the player must look up the official 公测日期 (`2025-11-28`) from the 终末地 site/公众号 to derive `20251128`.
- **新希望后台密码 `88888888` is an optional red herring** — it shares digits with the report hotline `0731-88888888`, but its clue must **never** enter `puzzle-evidence-finale.requiredEvidenceIds`.
- **The 3-minute countdown starts on the phone side** when `ev-lab-funding-report` is collected (PhoneShell → `shellState.startFinaleCountdown`), **not** from a web page and not from a puzzle `onSuccess`. `WebPage.onViewEffects` no longer exists as a field.
- **The paper-AI-interpretation article does NOT exist inside WeChat.** The chain is: 公众号《上传PDF，秒懂论文》→ `site-ai-pdf` `page-ai-pdf-home` (upload the PDF you just downloaded) → sha256 match → `page-ai-interpret`. Putting the interpretation back into `wechat/official-accounts.json` re-opens a plot leak (see `.claude/CLAUDE.md` §6.5).
- **Wrong-answer risk is not modelled** (no RiskService); if risk is ever restored it must be single-sourced, never double-counted.

When docs disagree (e.g. `docs/game_about/**` vs. `.claude/CLAUDE.md` §6), `.claude/CLAUDE.md` §6 wins.

## Environment constraint

**`WebFetch` and `WebSearch` are blocked** in this environment (WebFetch returns "Unable to verify if domain is safe"; WebSearch returns empty). To read official docs: `curl https://raw.githubusercontent.com/<org>/<repo>/main/<path>` (works for vitejs/vite, remix-run/react-router, pmndrs/zustand). Versions: `curl https://registry.npmjs.org/<pkg>/latest`. Do not call WebFetch/WebSearch — they always fail.

## Verifying changes

1. `npm run typecheck` — must pass (catches type errors across the whole project).
2. `npm run build` — must pass (catches Vite static-analysis issues `tsc` can't, e.g. glob/import-meta quirks).
3. **Dev-server smoke test** — `npm run dev` and open `http://localhost:5173/webgame/` (note the `/webgame/` base path). Confirm the phone desktop renders with no console errors. *This catches runtime issues neither `typecheck` nor `build` will* (e.g. the `import.meta.glob` literal error and the loader race both slipped past static checks). After a data or engine change, click into an app or two to confirm no `GameData 未加载` or render-time throws.
4. For data JSON changes: `node -e "JSON.parse(require('fs').readFileSync('public/data/<file>.json','utf8'))"` to confirm validity; check cross-references to IDs exist in `meta/`/`puzzle/`. For asset changes, additionally `HEAD`-probe the candidate URLs against `npm run preview` (`curl -I http://localhost:4173/webgame/assets/<assetId>.jpg`) — a missing file silently degrades to a placeholder.
5. The end-to-end main path and 3 endings are documented in `.claude/CLAUDE.md` §9; the latest audit results are in `docs/engineering/REVIEW_REPORT.md`.

## Engineering docs

- `docs/engineering/SCHEMA.md` — human-readable version of the type contract (`src/types/index.ts`).
- `docs/engineering/ASSETS.md` — **static-asset contract + full inventory** (naming, candidate-extension resolution, size budget, reuse map, watermark cleanup log).
- `docs/engineering/AGENT_OWNERSHIP.md` — full file-ownership table.
- `docs/engineering/DEPLOYMENT.md` — GitHub Pages deployment details (base, HashRouter, the `import.meta.env.BASE_URL` gotcha).
- `docs/engineering/REVIEW_REPORT.md` — Phase 5 adversarial audit results + known issues, plus the 后续修订 log (low-severity items documented there are acceptable; do not reintroduce the fixed high/medium findings).
- `.claude/agents/*.md` — the 13 sub-agent definitions. **Historical**: several (frontend-engine, frontend-browser, writer-browser) describe the pre-2026-08 engine/browser architecture that no longer exists; treat `src/` as the source of truth until they are rewritten.
