# AGENT_OWNERSHIP.md — 文件所有权表（CLAUDE.md §3 展开版）

> 本文件是 CLAUDE.md §3"文件所有权表"的展开版。核心规则：**每个 agent 拥有独占的输出目录。跨 agent 引用必须用稳定 ID（`contactId`/`puzzleId`/`evidenceId`/`pageId`/`clueId`）。任何 agent 不得为他方目录新增或修改文件。** 共享类型放 `src/types/index.ts`，由 doc-engineer 维护，变更需通告全局。

## 1. 所有权总表

| 路径 | 所有者 agent | 说明 |
|---|---|---|
| `public/data/meta/**` | level-designer | 人物、证据注册表、章节、结局、风险事件、提示骨架 |
| `public/data/puzzle/**` | level-designer | `puzzles.json`（答案+校验+effects，单一真源） |
| `public/data/clustering/**` | level-designer | `clue-map.json`（红鲱鱼标记） |
| `public/data/wechat/**` | writer-wechat | 微信联系人/会话/朋友圈/公众号文章/消息文件 |
| `public/data/qq/**` | writer-qq | QQ 联系人/会话/空间/消息文件 |
| `public/data/browser/**` | writer-browser | 站点/页面/搜索索引 |
| `public/data/phone/**` | level-designer¹ | SMS/通话/门铃事件骨架（见脚注） |
| `public/data/story/**` | writer-phone-story | 独白/旁白/结局后叙事 |
| `src/types/**` | doc-engineer（主）+ frontend-engine（协） | 类型契约，所有 agent 的依赖根 |
| `src/engine/**` | frontend-engine | 加载器/puzzle 校验/PuzzleEffect 执行器/ClueRegistry/CountdownService |
| `src/data/loader.ts` | frontend-engine | JSON 加载 + Zod 校验 |
| `src/apps/PhoneShell/**` | frontend-phone-shell | 手机桌面壳、AppRegistry、路由 |
| `src/ui/**` | frontend-phone-shell | 共享 UI 组件 |
| `src/main.tsx` `src/App.tsx` | frontend-phone-shell | 入口 |
| `src/apps/WechatApp/**` | frontend-wechat | 微信 App |
| `src/apps/QqApp/**` | frontend-qq | QQ App |
| `src/apps/BrowserApp/**` | frontend-browser | 浏览器 App |
| `src/apps/{Phone,Sms,Doorbell,Album,Files,Notes}App/**` | frontend-phone-apps | 系统 App |
| `public/assets/**` | 资源 agent（主控指派） | 图片/音频/PDF |
| `docs/engineering/SCHEMA.md` `AGENT_OWNERSHIP.md` `DEPLOYMENT.md` `ARCHITECTURE.md` | doc-engineer | 工程文档（前4个）；`REVIEW_REPORT.md` 由 reviewer 写 |
| `工程根配置`（package.json/vite.config.ts/tsconfig.json/tsconfig.node.json/index.html/README.md）| doc-engineer | 脚手架与构建配置 |
| `.github/workflows/deploy.yml` | doc-engineer | CI |
| `.claude/**` | 主控 agent | 契约、agent 定义、settings |
| `docs/game_about/**` | **只读，任何人不得修改** | 剧情大纲/信息架构/交互设计 |

¹ `public/data/phone/**`：CLAUDE.md §3 原表标注 writer-phone-story，本展开版遵循原表——SMS/通话/门铃事件的叙事文案由 writer-phone-story 写；其与谜题 effect（`pushSms`/`pushDoorbell` 的事件 ID 引用）的绑定由 level-designer 在 puzzle 的 `onSuccess` 里引用 writer-phone-story 产出的事件 ID。两者通过事件 ID 解耦。

## 2. 冲突避免规则

### 2.1 目录即锁
每个 agent 只在自己目录内 `Write`/`Edit`。跨目录读取任意（只读），但写入禁止。Workflow 在每个 phase 校验产出文件是否落在所有者目录内。

### 2.2 稳定 ID 是唯一跨 agent 引用手段
- 人物：`char-*`（level-designer 在 `meta/characters.json` 发布，writer-* 引用）
- 谜题：`puzzle-*`（level-designer 在 `puzzle/puzzles.json` 发布）
- 证据：`ev-*`（level-designer 在 `meta/evidence-registry.json` 发布）
- 线索：`clue-*`（level-designer 在 `clustering/clue-map.json` 发布）
- 页面：`page-*`（writer-browser 发布，level-designer 引用）
- 章节：`ch-*`（level-designer 在 `meta/chapters.json` 发布）

ID 一旦发布不得改名，只能弃用。命名约定见 CLAUDE.md §4.2 与 `SCHEMA.md` §1。

### 2.3 关卡钩子留空 + phase3 回填（避免改同一行）
文案 agent 写消息/页面/朋友圈时，`registersClueId` / `triggersEvidenceId` **留空**。level-designer phase3 用 JSON patch **只补这两个字段**，不动 `text`。
- Workflow 校验 phase3 patch 的 `path` 仅匹配 `registersClueId` / `triggersEvidenceId`。
- 这样文案与关卡两类 agent 不改同一行 JSON，phase2/phase3 可清晰地分别由不同 agent 跑。

### 2.4 消息拆文件
`ChatThread.messageFile` 指向 `messages/<threadId>.json`。会话元数据（threads.json）与会话消息（messages/*.json）分文件，加载低效与并发冲突都缓解。

### 2.5 data 冻结期（CLAUDE.md §5）
phase4（前端实现）期间 `public/data/**` **只读**。数据变更必须回 phase1/2/3 重走。

### 2.6 react 类型解耦
`src/types/index.ts` 的 `AppManifest.Component` 设为 `unknown`，使类型文件不依赖 `@types/react`。phone-shell 在 AppRegistry 处 cast 回 `React.LazyExoticComponent<React.ComponentType<unknown>>`。这避免 types 目录对 react 的隐式依赖，所有 agent 都能直接 import types 而不引入前端运行时。

## 3. 各 agent 写权限清单（速查）

### doc-engineer（本 agent）
- 工程根配置：`package.json` `vite.config.ts` `tsconfig.json` `tsconfig.node.json` `index.html` `README.md`
- `.github/workflows/deploy.yml`
- `docs/engineering/SCHEMA.md` `AGENT_OWNERSHIP.md` `DEPLOYMENT.md` `ARCHITECTURE.md`
- `src/types/index.ts`（主维护者，与 frontend-engine 协作）

### level-designer
- `public/data/meta/**`（characters / evidence-registry / chapters / endings / risk-events / hints）
- `public/data/puzzle/puzzles.json`
- `public/data/clustering/clue-map.json`
- phase3 对 phase2 产出做 JSON patch 补 `registersClueId`/`triggersEvidenceId`（限时白名单字段）

### writer-wechat
- `public/data/wechat/**`（contacts / threads / moments / articles / messages）

### writer-qq
- `public/data/qq/**`（contacts / threads / qzone / messages）

### writer-browser
- `public/data/browser/**`（sites / pages / search-index）

### writer-phone-story
- `public/data/phone/**`（sms / calls / doorbells 的叙事文案）
- `public/data/story/**`（monologues / 旁白）

### frontend-engine
- `src/engine/**`（loader / puzzle 校验 / PuzzleEffect 执行器 / ClueRegistry / CountdownService / RiskService）
- `src/data/loader.ts`
- 协作维护 `src/types/index.ts`

### frontend-phone-shell
- `src/apps/PhoneShell/**`、`src/ui/**`、`src/main.tsx`、`src/App.tsx`
- AppRegistry（`import.meta.glob('./apps/*/manifest.ts')` 聚合）

### frontend-wechat / frontend-qq / frontend-browser / frontend-phone-apps
- 各自 `src/apps/<App>/**`

### reviewer
- `docs/engineering/REVIEW_REPORT.md`
- 全仓只读审计

### 主控 agent
- `.claude/**`（CLAUDE.md、agents/*.md、settings.json）

### 资源 agent
- `public/assets/**`

## 4. 不得触碰清单（所有人）

- `docs/game_about/**` —— **只读源真相**，任何人不得修改。文档间或与 §6 冲突时以 §6 统一方案为准。
- 他方目录 —— 见 §1。

## 5. 环境约束（CLAUDE.md §2.1，所有 agent 共同遵守）

- WebFetch / WebSearch 被企业策略阻断，必失败。
- 查官方文档用 `curl https://raw.githubusercontent.com/<org>/<repo>/main/<path>`（vitejs/vite、remix-run/react-router、pmndrs/zustand）。
- 版本号用 `curl https://registry.npmjs.org/<pkg>/latest`。
- 列目录用 `curl "https://api.github.com/repos/<org>/<repo>/contents/<path>?ref=main"`。
- 不要调用 WebFetch/WebSearch。
