# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **There is a second CLAUDE.md at `.claude/CLAUDE.md`** — that is the *multi-agent contract* (file ownership table, 6-phase workflow, the §6 design-decision rulings, environment constraints). It governs how the sub-agent cluster collaborates. **Read it before any multi-agent or data-layer work.** This root file is the operations + architecture guide for working in the code itself.

## What this is

《张强宿舍大逃杀》— a pure-frontend, zero-backend web puzzle game. The player is林哲, investigating a classmate's disappearance through a **simulated smartphone** (WeChat / QQ / browser / SMS / phone / doorbell / album-evidence-vault / files / notes apps). Collect clues, crack passwords, gather evidence, call the police before a 3-minute countdown expires. Deployed to GitHub Pages; every "upload PDF / search / login backend" is faked client-side from JSON data.

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
All game content (chats, contacts, moments, web pages, SMS, call scripts, puzzles, clues, evidence, chapters, endings) lives as JSON, validated by Zod schemas at load time. **The frontend never generates JSON and never hardcodes puzzle answers** — answers live in `public/data/puzzle/puzzles.json` (single source of truth); the engine only implements *how to validate* (`matchStrategy`), not *what the answer is*.
- `meta/` `puzzle/` `clustering/` — level-design data: characters, evidence registry, chapters, endings, risk events, **puzzles.json**, **clue-map.json** (clue→evidence mapping, red-herring flags).
- `wechat/` `qq/` `browser/` `phone/` `story/` — content per platform. Chat messages are split one-file-per-thread (`messages/<threadId>.json`, referenced by `ChatThread.messageFile`) to keep files small and let writers work in parallel.

### Layer 2: Engine (`src/engine/**`) — pure logic + hooks, no React state of its own
`src/data/loader.ts` is the **only** module that touches `public/data`. It fetches via `import.meta.env.BASE_URL + 'data/...'`, validates with Zod, builds in-memory indices (`contactById`, `puzzleById`, `clueBySource`, …), and exposes **synchronous** query getters (`getChapterById`, `getPuzzleById`, …). All query getters call `requireIndex()` which **throws** if data isn't loaded yet — see the load-order invariant below.
- `store/gameStore.ts` — Zustand `GameState` (persisted to localStorage key `webgame-save` via `persist`, curried `create<T>()(persist(...))` form). Exposes **semantic actions only**: `solvePuzzle / registerClue / collectEvidence / addRisk / visitPage / pushEnding …`. Components never mutate state fields directly.
- `puzzle/PuzzleService.ts` + `validators.ts` + `EffectExecutor.ts` — `submit(puzzleId, value)` validates via `AnswerMatchStrategy` (exact/oneOf/regex/phoneNumber/evidenceSet), then executes `onSuccess: PuzzleEffect[]`. The `EffectExecutor` dispatches all 15 effect types (addRisk, startCountdown, pushSms, pushDoorbell, collectEvidence, **pushEnding, openNewsApp**, openApp, playAudio(loop), stopAudio, …). **This is the single chokepoint for all game side-effects** — apps call `usePuzzle().submit(...)` and the engine does the rest.
- `clue/ClueRegistry.ts` — the "viewing something registers a clue" mechanism. Apps call `useClue().view({kind, ...})`; the registry looks up `clue-map.json`, registers the clue, auto-collects related evidence (if `collectingCondition === 'onView'`), takes a screenshot into the album, appends to the notes memo.
- `chapter/ChapterDirector.ts` — watches `puzzleSolved/evidenceCollected/clueRegistered/pageFirstVisited` events and advances chapters per `enterCondition`. **Also executes `WebPage.onViewEffects`** on first page visit (this is how opening the lab funding-report page triggers the 3-minute countdown + threat SMS + doorbell + heartbeat — `page-lab-funding-report.json` carries those effects, NOT the puzzle's `onSuccess`).
- `risk/RiskService.ts` + `risk/RiskEventDispatcher.ts` — risk 0–100; `==100` → bad ending; `>70` → red edge + heartbeat. `RiskEventDispatcher` consumes `risk-events.json` (`visitSensitivePage` via `pageFirstVisited`, `askedContact` via the `riskOnAskedContact` API).
- `hooks/` — `usePuzzle / useClue / useEvidence / useCountdown / useRisk / useChapter / useSettings`. These are the only engine surface apps use.

### Layer 3: Apps (`src/apps/**`) — React components, one dir per app, auto-registered
- `PhoneShell/` is the device frame (not an app itself). It owns `AppRouter` (HashRouter), `StatusBar`, `NotificationBar`, `Desktop`, and `AppRegistry`. `src/utils/shellState.ts` adapts engine hooks for the shell.
- **`AppRegistry` auto-aggregates apps** via `import.meta.glob('../apps/*/manifest.ts', { eager: true })`. Each app dir has a `manifest.ts` exporting `{ appId, title, icon, route, Component, availableFrom, hiddenUntilPuzzleId? }`. Adding an app = adding a dir; the registry picks it up. **Do not hardcode the app list.**
- `ui/` — shared components (`RichBlocks` renders all `ArticleBlock` + `PageBlock` types; `ImageViewer` supports zoom for hidden details in images; `ChatBubble`, `PasswordInput`, `Countdown`, `Primitives`, `theme.ts`). Apps import from `@/ui` rather than reinventing.
- `PhoneShell/EndingOverlay.tsx` — renders the three endings' `epilogueBlocks` when `GameState.finished === true`, covering any app. This is the **only** consumer of `endings.json`'s epilogue text.
- 9 apps: `WechatApp`, `QqApp`, `BrowserApp` (has the URL matcher + `pdfjs` viewer), `PhoneApp` (dialer + call scripts, finale), `SmsApp`, `DoorbellApp`, `AlbumApp` (evidence vault, finale), `FilesApp` (PDF management; tracks whether the paper PDF is downloaded — a precondition for `puzzle-upload-paper`), `NotesApp`.

### Two load-order invariants (violating either crashes at runtime — `tsc`/`build` will NOT catch these)
1. **`loadGameData()` must complete before any `get*` query runs.** `RootLayout` (`src/apps/PhoneShell/AppRouter.tsx`) gates the entire `<PhoneShell>` render on a `dataState.ready` flag; it calls `loadGameData()` → `initEngine()` → sets ready. Until ready it shows a spinner. Any new shell-level component that calls `useChapter`/engine getters must render *inside* this gate (i.e. under `<PhoneShell>`), never at the top level.
2. **`initEngine()` must run after `loadGameData()`**, because `initEngine()` ends with `reevaluateChapters()` which reads chapter data. The order in `RootLayout`'s effect is already `loadGameData().then(initEngine)` — preserve it.

### Multi-agent ownership (summary — full table in `.claude/CLAUDE.md` §3 / `docs/engineering/AGENT_OWNERSHIP.md`)
Each directory has a single owning agent; cross-agent references go by stable IDs (`char-*`, `puzzle-*`, `ev-*`, `clue-*`, `page-*`, `ch-*`). Concretely when editing: `public/data/**` is data (content/level), `src/engine/**` + `src/data/loader.ts` is engine, `src/apps/<App>/**` is that app, `src/types/index.ts` is the shared contract root (every agent depends on it). `docs/game_about/**` is **read-only source truth** — never edit.

## Key design decisions (do not regress these — they were deliberately chosen and audit-verified)

- **HashRouter, not BrowserRouter.** GitHub Pages is static; BrowserRouter deep-link refresh 404s. `vite.config.ts` `base: '/webgame/'` is required for project-page asset paths.
- **`import.meta.env.BASE_URL` must appear literally** in code (it's statically replaced at build time). `import.meta.env['BASE_URL']` (bracket access) does **not** work.
- **`import.meta.glob` patterns must be string literals**, not variables — Vite analyzes them at build time. (A `const GLOB = '....'` then `import.meta.glob(GLOB)` fails with "Invalid glob import syntax: Could only use literals".) And `*/` inside a *string literal* is harmless; it only terminates block comments.
- **QQ password is `0328`** (公测日期 2026-03-28), tolerated as `oneOf:["0328","20260328"]`. The old design doc value `20251128` is **deprecated** — it must never appear in `public/data` or `src`. (It still lingers in the read-only `docs/game_about/剧情大纲.md`; that's fine.)
- **新希望后台密码 `88888888` is an optional red herring** — it shares digits with the report hotline `0731-88888888` (nice closed loop), but its clue `clue-xinxwang-financial` must **never** enter `puzzle-evidence-finale.requiredEvidenceIds`. Red-herring clues have empty `relatedEvidenceIds`.
- **Risk on wrong puzzle answer is single-sourced** in `PuzzleService` (don't double-count `riskPerWrongAttempt` + `onFailure.addRisk`). Lab-backend one wrong answer = `+10`, not `+20`.
- **The 3-minute countdown triggers on *opening the funding-report page*** (`page-lab-funding-report.onViewEffects`), not on logging into the lab backend.
- `WebPage.onViewEffects?: PuzzleEffect[]` and the `PuzzleEffect` variants `pushEnding`/`openNewsApp`/`openApp`/`stopAudio`/`playAudio(loop)` were added after the initial type freeze — they're real, in `src/types/index.ts`.

When docs disagree (e.g. `docs/game_about/**` vs. `.claude/CLAUDE.md` §6), `.claude/CLAUDE.md` §6 wins.

## Environment constraint

**`WebFetch` and `WebSearch` are blocked** in this environment (WebFetch returns "Unable to verify if domain is safe"; WebSearch returns empty). To read official docs: `curl https://raw.githubusercontent.com/<org>/<repo>/main/<path>` (works for vitejs/vite, remix-run/react-router, pmndrs/zustand). Versions: `curl https://registry.npmjs.org/<pkg>/latest`. Do not call WebFetch/WebSearch — they always fail.

## Verifying changes

1. `npm run typecheck` — must pass (catches type errors across the whole project).
2. `npm run build` — must pass (catches Vite static-analysis issues `tsc` can't, e.g. glob/import-meta quirks).
3. **Dev-server smoke test** — `npm run dev` and open `http://localhost:5173/webgame/` (note the `/webgame/` base path). Confirm the phone desktop renders with no console errors. *This catches runtime issues neither `typecheck` nor `build` will* (e.g. the `import.meta.glob` literal error and the loader race both slipped past static checks). After a data or engine change, click into an app or two to confirm no `GameData 未加载` or render-time throws.
4. For data JSON changes: `node -e "JSON.parse(require('fs').readFileSync('public/data/<file>.json','utf8'))"` to confirm validity; check cross-references to IDs exist in `meta/`/`puzzle/`/`clustering/`.
5. The end-to-end main path and 3 endings are documented in `.claude/CLAUDE.md` §9; the latest audit results are in `docs/engineering/REVIEW_REPORT.md`.

## Engineering docs

- `docs/engineering/SCHEMA.md` — human-readable version of the type contract (`src/types/index.ts`).
- `docs/engineering/AGENT_OWNERSHIP.md` — full file-ownership table.
- `docs/engineering/DEPLOYMENT.md` — GitHub Pages deployment details (base, HashRouter, the `import.meta.env.BASE_URL` gotcha).
- `docs/engineering/REVIEW_REPORT.md` — Phase 5 adversarial audit results + known issues (low-severity items documented there are acceptable; do not reintroduce the fixed high/medium findings).
- `.claude/agents/*.md` — the 13 sub-agent definitions (level-designer, writer-wechat/qq/browser/phone-story, frontend-engine/phone-shell/wechat/qq/browser/phone-apps, doc-engineer, reviewer).
