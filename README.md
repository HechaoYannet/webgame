# 《张强宿舍大逃杀》

一款网页解谜游戏。玩家扮演高二学生林哲，通过模拟智能手机界面（微信 / QQ / 浏览器 / 短信 / 电话 / 门铃等 App）调查同学失联案，收集证据、破解密码、在倒计时内报警举报。

**纯前端、零后端**，部署到 GitHub Pages。所有"上传 PDF 解读""搜索""登录后台"均为前端伪造，数据全部 JSON 化。

---

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 构建 | **Vite + React + TypeScript**（`react-ts` 模板） | Node 20.19+/22.12+ |
| 状态 | **Zustand 5** + `persist` 中间件 | localStorage 断点续玩；柯里化 `create<T>()(persist(...))` |
| 路由 | **React Router v7+ + HashRouter**（强制，实际装 `react-router@8.3.0`） | GitHub Pages 静态托管不支持服务端重写，BrowserRouter 刷新子路由会 404 |
| 数据校验 | **Zod** | 开发期校验 `public/data/**/*.json` 满足 `src/types` 契约 |
| 部署 | **GitHub Actions**（非 gh-pages 包） | `npm ci && npm run build` → `upload-pages-artifact` → `deploy-pages` |
| 包管理 | **npm**（与 CI `npm ci` 一致） | 不混用 pnpm/yarn |

> 详见 `.claude/CLAUDE.md` §2（技术栈，命令与配置已核实官方源）。

---

## 开发命令

```bash
npm install        # 装依赖
npm run dev        # 开发服务器 http://localhost:5173/
npm run build      # 生产构建到 dist/
npm run preview    # 预览构建产物
npm run lint       # ESLint
npx tsc --noEmit   # 类型检查
```

## 部署

仓库 **Settings → Pages → Source 选 "GitHub Actions"**，推送 `main` 分支即触发 `.github/workflows/deploy.yml` 自动部署到 `https://<user>.github.io/webgame/`。

关键配置：
- `vite.config.ts` 的 `base: '/webgame/'`（首尾斜杠都要，仓库名 webgame）
- **HashRouter**（`createHashRouter`），刷新子路由不 404
- 动态拼 URL 用 `import.meta.env.BASE_URL`（**必须原样出现**，括号访问不工作）

详见 `docs/engineering/DEPLOYMENT.md`。

---

## 目录结构

```
webgame/
├── .claude/                    # 主控 agent：契约 + agent 定义 + settings
│   ├── CLAUDE.md               # ★ 全局最高契约，所有 agent 启动必读
│   ├── agents/                 # 各 sub-agent 定义
│   └── settings.json
├── .github/workflows/
│   └── deploy.yml              # GitHub Pages CI（doc-engineer）
├── docs/
│   ├── game_about/             # ★ 只读源真相（剧情/信息架构/交互设计）
│   └── engineering/            # 工程文档（doc-engineer）
│       ├── SCHEMA.md           # 类型契约人类可读版
│       ├── AGENT_OWNERSHIP.md  # 文件所有权表
│       ├── DEPLOYMENT.md       # 部署说明
│       └── ARCHITECTURE.md     # React 架构（phase1 产出）
├── public/
│   ├── data/                   # ★ 数据即契约（文案 agent 写，前端读）
│   │   ├── meta/  puzzle/  clustering/   # level-designer
│   │   ├── wechat/  qq/  browser/        # writer-{wechat,qq,browser}
│   │   └── phone/  story/                # writer-phone-story
│   └── assets/                 # 图片/音频/PDF（资源 agent）
├── src/
│   ├── types/index.ts          # ★ 类型契约，所有 agent 的依赖根（doc-engineer）
│   ├── engine/                 # 加载器/puzzle校验/PuzzleEffect执行器（frontend-engine）
│   ├── apps/                   # 各 App（目录即锁，见 .claude/）
│   │   ├── PhoneShell/  WechatApp/  QqApp/  BrowserApp/
│   │   └── PhoneApp/  SmsApp/  DoorbellApp/  AlbumApp/  FilesApp/  NotesApp/
│   ├── ui/                     # 共享 UI（frontend-phone-shell）
│   ├── main.tsx  App.tsx       # 入口（frontend-phone-shell）
│   └── ...
├── package.json  vite.config.ts  tsconfig.json  index.html   # 工程配置（doc-engineer）
└── README.md
```

---

## 数据即契约（CLAUDE.md §4）

`public/data/**/*.json` 是文案 agent 与前端 agent 的**唯一耦合面**：
- 前端只读 JSON、不生成 JSON；文案只写 JSON、不触碰 `src/`。
- "是什么"在数据（谜题答案在 `puzzles.json`），"怎么验"在代码（前端 `engine/puzzle` 按校验逻辑实现，**前端不持硬编码答案**）。
- 跨 agent 引用必须用稳定 ID（`contactId`/`puzzleId`/`evidenceId`/`pageId`/`clueId`），命名约定见 CLAUDE.md §4.2。

完整类型契约见 `src/types/index.ts`，人类可读版见 `docs/engineering/SCHEMA.md`。

---

## Agent 集群

本项目由多个 sub-agent 协作开发（见 `.claude/agents/`）。主控 agent 按 CLAUDE.md §5 的 6 阶段编排：

```
Phase 0 契约固化  → Phase 1 骨架数据 → Phase 2 文案填充 → Phase 3 钩子回填 → Phase 4 前端实现 → Phase 5 对抗验证
```

- **所有权表**（谁写哪个目录）：见 `.claude/CLAUDE.md` §3 与 `docs/engineering/AGENT_OWNERSHIP.md`。
- **agent 定义**：`.claude/agents/*.md`。
- **环境约束**：WebFetch/WebSearch 被阻断，查官方文档用 `curl`（CLAUDE.md §2.1）。

---

## 验证标准（CLAUDE.md §9，端到端）

1. `tsc --noEmit` 通过
2. Zod schema 在 loader.ts 对所有 JSON 校验通过
3. `npm run dev` 手动走通主线
4. 三结局分别触发（真/普通/坏）
5. 红鲱鱼：登录新希望后台（`88888888`）能进入但不影响通关
6. `npm run build` 产物正确带 base；推 GitHub → Actions 部署成功；刷新子路由不 404
7. reviewer 的 `docs/engineering/REVIEW_REPORT.md` 全部通过或已修复
