---
name: frontend-browser
description: 【已退役】原"前端浏览器App agent"——src/apps/BrowserApp 从未实现，已被 src/sites/ 独立真网站模型取代。保留本文件作退役说明，勿再按旧职责派发。
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

## ⚠️ 本 agent 已退役（2026-08-19 重构后）

原职责"实现 `src/apps/BrowserApp/**`（伪浏览器：地址栏/URL匹配器/查看源码/搜索/后台登录/PDF查看）"
**整体作废**——`src/apps/BrowserApp/` 从未真正实现，伪浏览器已被玩家否决（"太像游戏"）。

### 新模型：调查网站 = 独立真网页（见 .claude/CLAUDE.md §6 与 重构计划）

- 不再有"浏览器 App"。手机通过 `openSitePage(pageId)`（`src/sites/sitePage.ts`）→ `window.open`
  在**新标签**打开 `#/site/<siteId>/*`，由 `src/sites/SiteRouter.tsx`（`import.meta.glob` 聚合）挂载各站根组件。
- 每个网站是 `src/sites/<siteId>/` 下的独立组件树，**自带视觉身份、自带站内 `<Routes>`**，
  与游戏系统完全解耦（禁 import `@/engine`/`@/game`/`@/data/loader`/`@/ui`/`@/utils`/`src/apps`）。
- 网站只显示信息，**绝不触发剧情/手机效果**（无门控、无 onViewEffects、无跨标签桥）。
- 登录表单（绿中 internal `yigeyi` / 新希望 `88888888` / 实验室 `123456`）在站点内调
  `checkLogin(token, password)`（`@/sites/shared/answerCheck`），成功只揭示站内后台页，无游戏副作用。
- 高潮（3分钟倒计时+威胁短信+刀哥门铃+心跳）改由手机内动作触发（AlbumApp 勾 `ev-lab-funding-report`
  → "启动举报倒计时"），不再由网页触发。
- 图片一律用 `PlaceholderImage`（`@/sites/shared/placeholder`），`public/assets/` 占位，玩家后换。

### 10 个站点（各由独立建站 sub-agent 构建，**不知是解谜游戏**）

`site-lvzhong`(含 /qiangzhang 员工系统) / `site-xinxwang`(含 /admin 财务后台) /
`site-shanhe-med`(含 lab/admin 实验室后台+经费报告) / `site-arxiv`(论文PDF) /
`site-news` / `site-tianyancha` / `site-baidu`(搜索) / `site-hnedu` / `site-hnga`(举报热线0731-88888888) /
`site-endfield`(公测日2025-11-28，QQ密码线索来源)。

### 若需建站/改站，不要用本 agent
用通用建站 Workflow（脚本见 `.claude/workflows/build-sites.js`），每站一个 sub-agent，
按"普通组织官网"brief 派发（deceptive-but-honest），强制导入边界 grep 门控 + 占位图。
建站约束详见 build-sites.js 脚本的 PREAMBLE。

### 依赖契约（仅备用参考，非本 agent 职责）
- 共享层：`src/sites/shared/{answerCheck,pageContent,placeholder}`、`src/types/index.ts`（PageBlock/SitePage）。
- 站点取页内容：`getPageContent(pageId)`（不经游戏 loader 的全量索引）。
- 编排层桥：`src/sites/sitePage.ts`（openSitePage）、`src/sites/SiteRouter.tsx`。

## 环境约束（仍适用任何子代理）
WebFetch/WebSearch 阻断，查文档用 `curl https://raw.githubusercontent.com/...`（CLAUDE.md §2.1）。
JSDoc/块注释里禁止出现星紧接斜杠的双字符序列（会提前终止注释致编译错）。
