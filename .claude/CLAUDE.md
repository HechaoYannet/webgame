# CLAUDE.md — 《张强宿舍大逃杀》网页解谜游戏 项目全局契约

> 这是本项目的最高规则文件。**所有 agent（包括主控与所有 sub-agent）启动时必须先读本文件**，再进入各自职责。本文件优先级高于 agent 定义文件内的任何表述；冲突以本文件为准。

---

## 0. 项目一句话

一款网页解谜游戏《张强宿舍大逃杀》，玩家扮演高二学生林哲，通过模拟智能手机界面（微信/QQ/短信/电话/门铃/相册/备忘录 **7 个 App**）与**独立全屏"真实网站"路由**（`#/site/site-*`，新标签打开）调查同学失联案，收集证据、破解密码、在倒计时内报警举报。部署到 GitHub Pages（纯前端、零后端）。

游戏完整设计见只读文档：
- `docs/game_about/剧情大纲.md` — 人物、5章+终章剧情、三结局、谜题答案
- `docs/game_about/信息架构.md` — 各平台信息量、联系人、群聊、朋友圈、公众号、网站页面、密码线索、红鲱鱼、提示系统
- `docs/game_about/交互设计.md` — 模拟手机桌面、App 清单、现实事件→网页表现映射、风险值、3分钟倒计时、证据库

> **这三份文档是只读源真相。若文档之间或文档与 §6 统一方案冲突，一律以 §6 统一方案为准。** 未经主控 agent 同意，任何人不得修改这三份文档。

---

## 1. 协作模式（最重要）

**主控 agent（你，即 Claude）原则上不亲自写前端代码与文案**。你的职责是：
1. 维护本契约文件与 `.claude/agents/*.md` 子代理定义。
2. 用 Workflow 工具按 §5 的 6 阶段编排 agent 集群。
3. 在阶段之间审读产出、对齐不一致、决定回滚或推进。
4. 处理真正需要全局协调、无法交给单个子代理的事项。

**例外**：基础设施类文件（本文件、agent 定义、settings.json、脚手架协调）由主控直接维护——这是"组织"而非"写业务代码"。

---

## 2. 技术栈（命令与配置均已核实官方源）

- **Vite + React + TypeScript**：`npm create vite@latest webgame -- --template react-ts`（npm 7+ 需双横线；模板准确名 `react-ts`；Node 20.19+/22.12+）
- **状态管理**：Zustand 5 + `persist` 中间件（localStorage 断点续玩）。TS **必须用柯里化形式** `create<T>()(persist(fn, { name, storage: createJSONStorage(() => localStorage) }))`，否则类型推断丢失；`name` 必填作 key；用 `partialize` 只存 GameState
- **路由**：**HashRouter**（强制）。GitHub Pages 静态托管不支持服务端重写，BrowserRouter 刷新子路由会真 404 且需 404.html hack（官方未提供）。HashRouter URL `/<repo>/#/app/wechat`，hash 段不经服务器，刷新零 404。React Router v7：用 `createHashRouter`/`<RouterProvider>`，路由对象用 `Component`（大写，v7 新增，替代 v6 `element`）；HashRouter 下可不设 basename
- **构建配置**：`vite.config.ts` 设 `base: '/webgame/'`（仓库名 webgame，首尾斜杠都要）。动态拼 URL 用 `import.meta.env.BASE_URL`（构建时静态替换，**必须原样出现**，`import.meta.env['BASE_URL']` 不工作）
- **静态资源**：默认走 `import`（自动 hash+inline+套 base）；`public/` 仅放不被代码引用/保留原名的文件，用根绝对路径 `/foo.png`。PDF/音频用 `?url`；TS 需 `vite/client` 类型
- **游戏资源（`public/assets/**`）**：数据里一律写**不带扩展名的 assetId**，文件名必须严格等于 `<assetId>.<ext>`（候选扩展名链见 `src/utils/assetUrl.ts`）；位图统一**长边 ≤2000 + JPEG q90**，AI 原图投放区 `src/assets/img/`（已 gitignore，不进构建、不进仓库）；**新增/替换任何资源必须在 `docs/engineering/ASSETS.md` 登记**。`public/assets` 总预算 ≤25 MB。
- **数据加载**：JSON 放 `public/data/`，用 `fetch(import.meta.env.BASE_URL + 'data/...')` 按需加载；开发期用 Zod schema 校验
- **部署**：**GitHub Actions**（非 gh-pages 包）。仓库 Settings→Pages→Source 选 "GitHub Actions"，加 `.github/workflows/deploy.yml`（官方 yaml：`npm ci && npm run build` → `upload-pages-artifact` 到 `./dist` → `deploy-pages`）
- **包管理**：npm（与 CI 的 `npm ci` 一致），不要混用 pnpm/yarn

### 2.1 环境约束（重要，避免浪费轮次）

**本环境 WebFetch 与 WebSearch 被企业策略阻断**（WebFetch 报 "Unable to verify if domain is safe"，WebSearch 全返回空）。需要查官方文档时，用：
- `curl https://raw.githubusercontent.com/<org>/<repo>/main/<path>`（对 vitejs/vite、remix-run/react-router、pmndrs/zustand 均有效；pmndrs/zustand 偶发空 body，重试即可）
- `curl https://registry.npmjs.org/<pkg>/latest`（取版本号）
- `curl "https://api.github.com/repos/<org>/<repo>/contents/<path>?ref=main"`（列目录）

**不要调用 WebFetch/WebSearch**，它们必定失败。

---

## 3. 文件所有权表（agent 写权限锁 — 冲突避免核心）

**规则**：每个 agent 拥有独占的输出目录。跨 agent 引用必须用稳定 ID（`contactId`/`puzzleId`/`evidenceId`/`pageId`/`clueId`）。**任何 agent 不得为他方目录新增或修改文件**。共享类型放 `src/types/index.ts`，由 doc-engineer 维护，变更需通告全局。

| 路径 | 所有者 agent |
|---|---|
| `data/meta/**` `data/puzzle/**` | level-designer |
| `data/wechat/**` | writer-wechat |
| `data/qq/**` | writer-qq |
| `data/browser/**` | writer-browser |
| `data/phone/**` `data/story/**` | writer-phone-story |
| `src/types/**` | doc-engineer（主）+ frontend-engine（协） |
| `src/data/loader.ts` | frontend-engine |
| `src/game/**` | frontend-phone-shell（2026-08 重构后：游戏状态收敛于此） |
| `src/apps/PhoneShell/**` `src/ui/**` `src/main.tsx` `src/App.tsx` `src/utils/{shellState,time,assetUrl}.ts` | frontend-phone-shell |
| `src/apps/WechatApp/**` | frontend-wechat |
| `src/apps/QqApp/**` | frontend-qq |
| `src/apps/{Phone,Sms,Doorbell,Album,Notes}App/**` | frontend-phone-apps |
| `src/sites/site-*/**` `src/sites/shared/**` | 各站点 agent（真实网站 = 独立全屏路由） |
| `public/assets/**` | 资源 agent（主控指派）——清单与约定见 `docs/engineering/ASSETS.md` |
| `docs/engineering/**` 构建配置/CI/README/SCHEMA | doc-engineer |
| `.claude/**` | 主控 agent |
| `docs/game_about/**` | 只读，任何人不得修改 |

> `data/` 目录位于 `public/data/`（Vite 静态服务，便于 fetch）。下文为简洁起见仍称 `data/**`，实际路径 = `public/data/**`。

---

## 4. 数据即契约（文案 agent 与前端 agent 的唯一耦合面）

### 4.1 核心原则
1. **数据即契约**：`public/data/**/*.json` 是文案 agent 与前端 agent 之间的唯一耦合面。前端只读 JSON、不生成 JSON；文案只写 JSON、不触碰 `src/`。
2. **"是什么"在数据，"怎么验"在代码**：谜题答案、线索触发条件的数据形态由 level-designer 定（`data/puzzle/puzzles.json` 单一真源），但密码校验/比较逻辑由前端 `src/game/answerCheck.ts` 实现，**前端不持硬编码答案**（2026-08 重构后引擎层 `src/engine/**` 已删除）。
3. **一人一目录，目录即锁**：见 §3。
4. **纯前端、零后端**：所有"上传 PDF 解读""搜索""登录后台"均为前端伪造，数据全部 JSON 化。

### 4.2 ID 命名约定（全局唯一且稳定）
- 人物：`char-liqiaorui` `char-linzhe` `char-zhangqiang` ...
- 谜题：`puzzle-qq-login` `puzzle-lvzhong-internal` `puzzle-lab-backend` `puzzle-xinxwang-backend` `puzzle-pdf-screening` `puzzle-evidence-finale` `puzzle-upload-paper`
- 证据：`ev-qq-chat-plan` `ev-lvzhong-agreement` `ev-xinxwang-lab-news` `ev-paper-pdf` `ev-lab-funding-report` `ev-lab-upload-log`
- 线索：`clue-<source-slug>`
- 页面：`page-<site>-<page>`
- 章节：`ch-prologue` `ch-1` ... `ch-5` `ch-finale`

完整 TS 类型定义在 `src/types/index.ts`（phase0 产出），是所有 agent 的依赖根。关键 schema 设计点（详见 `docs/engineering/SCHEMA.md`）：
- `answer` 与 `matchStrategy` 分离；`onSuccess: PuzzleEffect[]` 副作用清单
- `PageAccessibility` discriminated union（public/hidden/loginRequired/linkedOnly）
- `Clue.source` discriminated union 枚举所有信息载体
- 关卡机制钩子（`registersClueId`/`triggersEvidenceId`）：文案 agent 留空，level-designer phase3 用 JSON patch 补填——避免两类 agent 改同一行
- 消息拆文件：`ChatThread.messageFile` 指向 `messages/<threadId>.json`
- `direction` 字段解决"登录李桥瑞 QQ 后，闫欣泽发的消息是 received"视角

---

## 5. 6 阶段 Workflow 编排（主控用 Workflow 工具执行）

```
Phase 0 契约固化  → Phase 1 骨架数据 → Phase 2 文案填充 → Phase 3 钩子回填 → Phase 4 前端实现 → Phase 5 对抗验证
```

### Phase 0 — 契约固化（parallel）
- doc-engineer + frontend-engine 协作产出 `src/types/index.ts` + `docs/engineering/SCHEMA.md`
- level-designer 产出 `puzzles.json` ID 骨架（仅 id/title/answer 占位）
- 产出：类型契约 + 各谜题/证据/线索/人物的 ID 命名表

### Phase 1 — 骨架数据（level-designer 主导，sequential，schema-validated）
- `meta/characters.json` `meta/evidence-registry.json`（5 项 `isKey` 关键证据）
- `puzzle/puzzles.json`（答案+校验策略+effects，绑定证据ID）— 含 §6 已统一的所有谜题
- `meta/chapters.json` + `endings.json`（触发绑定 puzzleId）
- `meta/risk-events.json`（历史：`clustering/clue-map.json` 已于 2026-08 随线索机制删除，红鲱鱼标记改由 `meta/evidence-registry.json` 的 `isRedHerring` 承载）

### Phase 2 — 内容填充（文案 4 agent 全并行；reviewer 实时 lint ID 引用合法性）
- writer-wechat / writer-qq / writer-browser / writer-phone-story 各占一个 data 子目录
- 只读 `meta/`+`puzzle/`，引用 phase1 稳定 ID，不互相依赖

### Phase 3 — 关卡钩子回填（level-designer，JSON patch）
- 对 phase2 产出的每条消息/页面/朋友圈，补填 `registersClueId`/`triggersEvidenceId`
- 只编辑这些可选字段，不碰文案 `text` 字段（Workflow 校验"只改白名单字段"）

### Phase 4 — 前端实现（前端 6 agent + 资源 agent 全并行；data/ 冻结只读）
- frontend-engine / frontend-phone-shell / frontend-wechat / frontend-qq / frontend-browser / frontend-phone-apps
- 各占 `src/apps/<App>` 目录，依赖 AppRegistry（`import.meta.glob('./apps/*/manifest.ts')`）自动聚合，零跨目录冲突
- **2026-08 重构后**：引擎层已删除（游戏状态收敛到 `src/game`），浏览器 App 已删除（站点改为独立全屏路由 `src/sites/site-*`），文件 App 已删除。当前 **7 个 App**：Wechat / Qq / Phone / Sms / Doorbell / Album / Notes。`.claude/agents/*.md` 中 frontend-engine / frontend-browser / writer-browser 三份定义已过期，以 `src/` 为准。

### Phase 5 — 对抗式验证（reviewer，blind-review skill 多代理盲审）
- 线索闭环：5 个关键证据每项是否都有从序章到终章的可达路径
- 红鲱鱼隔离：红鲱鱼 clue 不进任何 `requiredEvidenceIds`
- 密码一致性：`puzzles.json` 的 answer 与剧情文本线索一致（重点盯 QQ 密码 20251128，公测日 2025-11-28）
- 章节可达性 / 三结局可达
- 失败 → 回 phase 1/2/3 修复；通过 → 产出 `docs/engineering/REVIEW_REPORT.md`

> **data 冻结期**：phase 4 期间 `data/` 只读，变更必须回 phase 1/2/3 重走。

---

## 6. 已识别的文档不一致与统一方案（强制条款，优先级高于原文档）

1. **【高】QQ 密码矛盾（2026-08-20 反转统一）**：QQ 密码 **统一为 `20251128`**（终末地公测日期，公测日 `2025-11-28` 见终末地官网/公众号），`puzzles.json` 用 `matchStrategy: { kind:"oneOf"; accepted:["20251128","1128"] }` 容错。旧值 `0328`/`20260328` 是 **AI 幻觉**（把终末地公测日错记成 3-28），现已 **废弃**，不得出现在 `public/data`/`src`/可写文档。线索文本**不写死数字**：闫欣泽只说"密码改成终末地公测那天"，玩家须自查终末地公测日（11-28）推出 `20251128`。剧情大纲 L45 的 `20251128` 此前被误判为遗留错误，现确认其正确；L60/信息架构的 `0328` 是需订正项。
2. **【中】新希望后台 `88888888`**：剧情大纲主线未用到。**保留为可选红鲱鱼**——玩家可登录（密码 `88888888`，与举报电话 `0731-88888888` 后 8 位暗合），得额外佐证但**不进 `requiredEvidenceIds`**。不改动主线流程。
3. **【中】朋友圈 3/11 配文**：交互设计/信息架构写"兄弟们，终末地见！"，剧情大纲写"高兴"。**统一为"兄弟们，终末地见！"**。
4. **【低】外部真实 URL**（鹰角官网 `endfield.hypergryph.com/...`）：标记 `link.pageId` 走站内伪造页，`url` 仅显示不真实跳转，避免外链失效与跳出沉浸。
5. **【低】论文 AI 翻译解读（2026-08 修订）**：真实链路 = 公众号《上传PDF，秒懂论文》→ 独立站 `site-ai-pdf`（`page-ai-pdf-home`）上传**刚从预印本站下载的那份** `paper-source-crystal.pdf` → 站点按 sha256 严格校验通过 → 跳 `page-ai-interpret` 出解读。**解读只存在于站点页，微信内不得再放解读文章**。旧设计「检测论文 PDF 已在 FilesApp → 触发 `isGeneratedContent` 预设解读文章」已废弃：FilesApp 已删除，且该做法会把解读（含实验室后台地址+密码线索）直接泄露在公众号里，绕过"下载→上传→出解读"链路。
6. **【低】倒计时与持久化**：终章倒计时由**手机侧**在 `ev-lab-funding-report` 归档后启动（`src/utils/shellState.ts` → `src/game/countdown.ts`，180s，id 恒为 `countdown-finale`）；`startedAt` 只存内存（刷新即清，避免"刷新即坏结局"）；归零由 `watchCountdownExpiry` 调 `pushEnding('bad')`，不可回退。旧的 `CountdownService`/`WebPage.onViewEffects` 已随引擎删除。
7. **【低】`123456` 双重语义**（绿中后台失败/实验室后台成功）：保留为有意设计（红鲱鱼+真实线索交叉），实验室后台 Hint tier1 明确指向"基金号后 6 位"。
8. **【信息】风险值阈值（现状：占位）**：设计上 `risk` 0-100、`==100` 触发坏结局、`>70` 红边+心跳；但 2026-08 重构后 `RiskService` 已删除，`useRisk` 恒返回 `risk:0`，`meta/risk-events.json` 目前无消费者。若恢复，必须单一来源、且校验"正常通关路径 risk 不会无端到 100"。

### 6.1 关键谜题答案清单（已定，level-designer 严格遵循）
| 谜题 | 答案 | 校验策略 | 触发后果 |
|---|---|---|---|
| QQ 登录 | `20251128`（容错 `1128`） | oneOf | 解锁闫欣泽 QQ 对话 |
| 绿中内部系统 | `yigeyi` | exact（校长寄语"先挣一个亿"） | 解锁合作协议/名单/通讯录 |
| 心理筛查 PDF | `0312`（合同号 `XH2026-0312` 后4位） | exact | 解锁受试者名单 PDF |
| 新希望后台（红鲱鱼，可选） | `88888888` | exact | 额外佐证，不进关键证据 |
| 论文 AI 解读 | 上传论文 PDF 触发 | uploadAndInterpret | 站点 `page-ai-interpret` 出解读文章（含实验室后台地址+密码线索），**不入微信** |
| 实验室后台 | `123456`（基金号 `2025YFC0123456` 后6位） | exact | 解锁受试者名单+经费报告 → **触发3分钟倒计时+威胁短信+刀哥门铃+心跳** |
| 终章证据勾选 | ≥5 项关键证据 | evidenceSet（requiredEvidenceIds 5项, minLength 5） | 真/普通结局分支 |

---

## 7. 五项关键证据（终章 requiredEvidenceIds，level-designer 必须包含）
1. `ev-qq-chat-plan` — 李桥瑞与闫欣泽 QQ 聊天记录（二人调查张强、失联前计划）
2. `ev-lvzhong-agreement` — 绿中内部系统合作协议（证明张强与机构合作输送学生）
3. `ev-xinxwang-lab-news` — 新希望成长中心与实验室合作新闻（机构与实验室勾结）
4. `ev-paper-pdf` — 论文 PDF（在 AI 解读站上传校验通过或查看解读结果页时归档；非法人体实验）
5. `ev-lab-funding-report` — 实验室后台经费申请报告（李桥瑞、闫欣泽列为受试者）
6. （附加）`ev-lab-upload-log` — 系统日志（张强上传名单）——可作为第6项补强

> 至少 5 项勾选才进真结局；不足或漏掉经费报告 → 普通结局。

---

## 8. 主控 agent 工作守则

1. **每个 phase 用一个 Workflow 脚本编排**；phase 间停下来审读产出、对齐不一致、决定推进或回滚。不要一次跑完全部阶段。
2. **优先用 pipeline()** 而非 barrier parallel()，除非确实需要跨 item 汇总（如 phase5 先收集所有 finding 再去重验证）。
3. **schema 强制结构化输出**：对能定义 JSON Schema 的 agent 产出（尤其 level-designer 的 puzzles.json、文案的各 JSON），用 Workflow 的 schema 选项校验，避免引用非法 ID。
4. **诚实报告**：测试失败就说失败并附输出；步骤跳过就说跳过；完成且验证通过才说完成，不加 hedge。
5. **每个 agent 定义文件**（`.claude/agents/*.md`）必须写入：目录边界（§3）、契约引用（§4）、§6 统一方案相关项、环境约束（§2.1）。

---

## 9. 验证标准（端到端，phase5 后必须全过）

1. `tsc --noEmit` 通过（所有 data JSON 满足 src/types 契约）
2. Zod schema 在 loader.ts 对所有 JSON 校验通过
3. `npm run dev` 手动走通主线：序章微信→看终末地官网/公众号得公测日(2025-11-28)→登QQ(20251128)→看闫欣泽对话→绿中官网→隐藏入口`/qiangzhang`→登内部系统(yigeyi)→看协议/名单PDF(0312)→新希望官网+天眼查→实验室官网→下载论文→公众号《上传PDF，秒懂论文》→AI解读站上传该PDF出解读→实验室后台(123456)→倒计时→勾选5证据→拨打0731-88888888→真结局
4. 三结局分别触发（真/普通/坏：证据不足、倒计时超时、风险值满）
5. 红鲱鱼：登录新希望后台(88888888)能进入但不影响通关
6. `npm run build` 产物正确带 base；推 GitHub → Actions 部署 → Pages 可访问、刷新子路由不 404（HashRouter）
7. reviewer 的 `docs/engineering/REVIEW_REPORT.md` 全部通过或已修复
