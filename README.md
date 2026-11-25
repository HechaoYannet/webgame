# 《张强宿舍大逃杀》

一款网页解谜游戏。玩家扮演高二学生林哲，通过模拟智能手机界面（微信 / QQ / 短信 / 电话 / 门铃 / 相册 / 备忘录 共 7 个 App，桌面另有"百度搜索"入口）调查同学失联案；"真实网站"是**独立全屏路由**（新标签打开），不是手机里的浏览器 App。收集证据、破解密码、在倒计时内拨通举报电话。

**纯前端、零后端**，部署到 GitHub Pages。所有"搜索""登录后台""AI 解读"均为前端伪造，数据全部 JSON 化。

---

## 玩法主线

1. **序幕**：翻看微信聊天与朋友圈，找出"密码是那个日子"指向的日期，登录李桥瑞的 QQ（`20251128`，终末地全面测试开启日，可点朋友圈链接访问真实官网核对）。
2. **绿中官网**：百度搜索 → 官网通知公告 → 页面源码里藏着校务系统隐藏入口 → 用校长寄语中的"小目标"登录（`yigeyi`），看到合作协议、加密筛查名单（密码 `0312`）、通讯录。
3. **新希望成长中心**：官网新闻 + 天眼查工商信息，坐实张强与陈建国的利益链。
4. **论文与真相**：在预印本库下载论文 PDF，到"论文 AI 翻译解读"上传（站点按 sha256 校验你刚下载的那份 PDF）→ 出解读，得到实验室后台地址与密码线索（基金号后 6 位 `123456`）。**解读只存在于该网站，微信内不会出现。**
5. **终章**：登录实验室后台，打开经费申请报告——**倒计时 3 分钟开始**，威胁短信与刀哥门铃同步到达。在倒计时内集齐 5 项关键证据，拨打 `0731-88888888`，在通话中提交证据，触发真 / 普通结局；超时则坏结局。

证据为**查看即归档**：看到关键聊天 / 协议 / 新闻 / 论文解读 / 经费报告，会自动归档到相册，无需手动记录。

---

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 构建 | **Vite + React + TypeScript**（`react-ts` 模板） | Node 20.19+/22.12+ |
| 状态 | **Zustand 5** + `persist` 中间件 | localStorage 断点续玩；只持久化极简检查点 |
| 路由 | **React Router v8 + HashRouter**（强制） | GitHub Pages 静态托管刷新不 404 |
| 数据校验 | **Zod** | 开发期校验 `public/data/**/*.json` 满足 `src/types` 契约 |
| 部署 | **GitHub Actions** | `npm ci && npm run build` → Pages |
| 包管理 | **npm**（与 CI `npm ci` 一致） | 不混用 pnpm/yarn |

## 开发命令

```bash
npm install        # 装依赖
npm run dev        # 开发服务器 http://localhost:5173/webgame/
npm run typecheck  # tsc --noEmit -p tsconfig.app.json
npm run build      # tsc -b && vite build
npm run lint       # oxlint
```

## 目录结构

```
webgame/
├── public/
│   ├── data/                   # ★ 全部游戏内容（JSON 即内容）
│   │   ├── meta/  puzzle/      # 章节 / 人物 / 结局 / 证据 / 谜题答案
│   │   ├── wechat/  qq/        # 微信（会话/朋友圈/公众号）与 QQ（会话/空间/群文件）
│   │   ├── browser/            # 站点清单 / 搜索索引 / 各网页内容
│   │   └── phone/  story/      # 短信 / 门铃 / 通话 / 独白
│   └── assets/                 # 图片 / 音频 / PDF（数据里用 assetId，解析时按候选扩展名补全）
│                               #   ↑ 命名、体积与清单见 docs/engineering/ASSETS.md
├── src/
│   ├── game/                   # ★ 极简游戏状态：检查点 + 倒计时 + 答案校验（无引擎）
│   ├── apps/                   # 手机 App：Wechat / Qq / Sms / Phone / Doorbell / Album / Notes
│   ├── sites/                  # ★ 10 个全屏"真网站"（独立路由 #/site/…，与游戏解耦，经 shared/gameEvent 回调）
│   ├── data/loader.ts          # 唯一数据加载层（fetch + Zod 校验 + 索引）
│   ├── ui/  utils/  types/     # 共享 UI / 工具 / 类型契约
│   └── main.tsx  App.tsx       # 入口（先 await loadGameData 再渲染）
└── docs/  .claude/             # 设计文档与协作约定
```

## 设计要点

- **没有游戏引擎**：这类体量的解谜游戏不需要引擎。状态收敛在 `src/game`（Zustand 检查点），谜题校验是 `src/game/answerCheck.ts` 的纯函数，网站与手机通过 `src/sites/shared/gameEvent.ts` 单点回调。
- **数据即内容**：所有剧情文本、站点页面、谜题答案都在 `public/data/**/*.json`，前端代码不硬编码答案。
- **查看即收集**：证据收集由"查看关键内容"自动触发（幂等），相册只展示已收集的证据；终局判定唯一入口是举报电话内的证据勾选。
- **倒计时仅内存**：刷新即清，避免"刷新即坏结局"；`startedAt` 不落盘。
- **站点与游戏解耦**：各站是独立全屏路由（`#/site/:siteId`），只能通过 `@/sites/shared/*` 访问受限接口。
- **静态资源**：数据里只写不带扩展名的 assetId，文件名严格等于 `<assetId>.<ext>`（候选链见 `src/utils/assetUrl.ts`）；位图统一长边 ≤2000 + JPEG q90，`public/assets` 总预算 ≤25 MB，AI 原图放 `src/assets/img/`（不进仓库、不进构建）。清单见 `docs/engineering/ASSETS.md`。

## 部署

仓库 **Settings → Pages → Source 选 "GitHub Actions"**，推送 `main` 分支触发 `.github/workflows/deploy.yml`。
关键配置：`vite.config.ts` 的 `base: "/webgame/"`；HashRouter；动态 URL 用 `import.meta.env.BASE_URL`。
