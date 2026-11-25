# DEPLOYMENT.md — GitHub Pages 部署

> 《张强宿舍大逃杀》纯前端、零后端，部署到 GitHub Pages。本文档说明 base 配置、为何强制 HashRouter、CI 流程、以及 `import.meta.env.BASE_URL` 的坑。配置真源是 `vite.config.ts` 与 `.github/workflows/deploy.yml`，冲突以代码为准。

## 1. 部署目标

- 仓库：`webgame`（仓库名决定 base path）
- 访问地址：`https://<user>.github.io/webgame/`
- 类型：GitHub Pages 静态托管，**无服务端**。

## 2. base 配置（vite.config.ts）

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/webgame/',  // 首尾斜杠都要，仓库名 webgame
  build: {
    assetsInlineLimit: 4096,  // 避免大文件（PDF/音频）内联
  },
})
```

**为什么 `base` 必须是 `/webgame/`**：GitHub Pages 把站点托管在 `https://<user>.github.io/webgame/` 子路径下，所有静态资源 URL 必须带 `/webgame/` 前缀。不设 base，Vite 默认 `/`，构建产物里 `<script src="/assets/index-xxx.js">` 会去请求 `https://<user>.github.io/assets/...` → 404。

- `base` 首尾斜杠都要：`'/webgame/'`。少了首斜杠 → 相对解析；少了尾斜杠 → 资源路径拼接异常。
- `assetsInlineLimit: 4096`：把内联阈值压到 4KB，避免 PDF/音频等大文件被 base64 内联进 JS（让 bundle 膨胀）。PDF/音频应留在 `public/assets/` 或用 `?url` import 走独立文件。

## 3. 路由：强制 HashRouter（不用 BrowserRouter）

**用 HashRouter，不用 BrowserRouter。** 这是非可选项。

**原因**：
- GitHub Pages 是静态托管，**不支持服务端重写**。
- BrowserRouter 依赖 HTML5 History API，URL 形如 `/webgame/app/wechat`。当玩家在子路由刷新或直接访问该 URL，GitHub Pages 服务器会去找 `/webgame/app/wechat` 这个文件 → 真 404。常见的 404.html hack（把 404 重定向到 index.html）GitHub Pages 官方未提供支持，行为不稳定。
- HashRouter URL 形如 `/webgame/#/app/wechat`，`#` 之后的 hash 段**不发往服务器**，永远命中 `/webgame/index.html`。刷新任意子路由都不会 404。

**React Router v7+ 用法**（实际安装 `react-router@8.3.0`，`createHashRouter`/`RouterProvider` 与 v7 API 一致）：
```ts
import { createHashRouter, RouterProvider } from 'react-router'

const router = createHashRouter([...])
// HashRouter 下可不设 basename（hash 段不经服务器，base 已由 vite 处理资源 URL）
;<RouterProvider router={router} />
```
- 用 `createHashRouter` / `<RouterProvider>`，**不要**用 `createBrowserRouter`。
- 路由对象用 `Component`（大写，v7 起新增），替代 v6 的 `element`。

## 4. import.meta.env.BASE_URL 的坑

构建时 Vite 把 `import.meta.env.BASE_URL` 静态替换为 `vite.config.ts` 里 `base` 的值（即 `/webgame/`）。用于**动态拼**运行时数据 URL：

```ts
// ✅ 正确：必须原样出现 import.meta.env.BASE_URL
const dataUrl = import.meta.env.BASE_URL + 'data/meta/characters.json'
const res = await fetch(dataUrl)
```

**两个坑**：
1. **必须原样出现** `import.meta.env.BASE_URL`。写成 `import.meta.env['BASE_URL']`（括号访问）**不工作** —— Vite 的静态替换是源码字面量匹配，括号形式匹配不到，构建后该表达式变成 `undefined`，运行时 fetch 到 `undefineddata/...` → 404。
2. 不要把它存进变量再用：`const b = import.meta.env.BASE_URL` 后 `b + 'data/...'` —— 这能工作但削弱了静态替换的可读性，且某些压缩配置下可能出问题。直接原样拼接最稳。

**静态 import 不用 BASE_URL**：默认 `import` 资源（`import logo from './logo.png'`）会被 Vite 自动加 hash + 套 base，无需手拼。只有 `public/` 下不被代码引用、需保留原名的文件，以及运行时动态拼接的 URL，才用 `import.meta.env.BASE_URL`。

## 5. 数据加载（public/data/）

JSON 放 `public/data/`，Vite 原样拷贝到 `dist/data/`。前端按需 fetch：

```ts
// loader.ts（frontend-engine）
async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(import.meta.env.BASE_URL + 'data/' + path)
  if (!res.ok) throw new Error(`load ${path}: ${res.status}`)
  return res.json()
}
```

开发期用 Zod schema 校验每份 JSON（满足 `src/types/index.ts` 契约）。生产构建可保留校验（首屏加载失败比运行时崩溃好）或剥离以省体积。

## 6. CI 部署（.github/workflows/deploy.yml）

仓库 **Settings → Pages → Source 选 "GitHub Actions"**（不是 "Deploy from a branch"）。然后 `.github/workflows/deploy.yml`：

```yaml
name: Deploy static content to Pages
on:
  push:
    branches: ['main']
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: 'pages'
  cancel-in-progress: true
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
      - id: deployment
        uses: actions/deploy-pages@v4
```

### 关键点
- `permissions: pages: write` + `id-token: write` —— deploy-pages 需要。
- `concurrency: group 'pages'` + `cancel-in-progress: true` —— 同一时间只跑一个部署，新 push 取消旧部署。
- `npm ci`（不是 `npm install`）—— 严格按 lockfile 装，与 CI 一致。本地开发可 `npm install`，但提交的 `package-lock.json` 必须与 `package.json` 同步。
- `cache: 'npm'` —— 缓存 `~/.npm`，加速后续 run。
- `upload-pages-artifact path: './dist'` —— Vite 构建产物目录。
- `configure-pages@v5` —— 自动配置 Pages，不必手动在仓库设置里设 base path。

### 推送后验证
1. GitHub 仓库 → Actions 标签 → 看 deploy workflow 是否绿。
2. Actions 完成后 → Settings → Pages 看 URL。
3. 访问 `https://<user>.github.io/webgame/` —— 首屏正常。
4. **刷新子路由**（如 `https://<user>.github.io/webgame/#/app/wechat`）—— 不 404（HashRouter 保证）。
5. 检查浏览器 DevTools Network：所有资源带 `/webgame/` 前缀，无 404。

## 7. 本地开发

```bash
npm install        # 装依赖
npm run dev        # 开发服务器（http://localhost:5173/）
npm run build      # 生产构建到 dist/
npm run preview    # 预览构建产物（用 /webgame/ base）
```

`npm run dev` 时 `import.meta.env.BASE_URL` = `'/webgame/'`（来自 vite.config 的 base），与生产一致，无需特别处理。

## 8. 常见问题

### Q: 构建后白屏，控制台 404 找不到 JS
A: 检查 `vite.config.ts` 是否有 `base: '/webgame/'`。少了 base，资源路径变成 `/assets/...` 而非 `/webgame/assets/...`。

### Q: 刷新子路由 404
A: 用了 BrowserRouter。改用 HashRouter（`createHashRouter`）。GitHub Pages 不支持服务端重写。

### Q: fetch 数据 404 / `undefineddata/...`
A: `import.meta.env.BASE_URL` 写成了括号访问 `import.meta.env['BASE_URL']`。必须原样点访问。

### Q: PDF/音频被内联进 JS 导致 bundle 巨大
A: `build.assetsInlineLimit` 调小（如 4096），或把大文件放 `public/assets/` 用绝对路径 `/webgame/assets/...` 引用，或用 `import url from './file.pdf?url'` 走独立文件。

### Q: deploy workflow 报 `npm ci` 失败
A: `package-lock.json` 与 `package.json` 不同步。本地跑一次 `npm install` 重新生成 lockfile 并提交。

### Q: 图片/音频 404，页面出现灰块占位
A: `public/data` 里写的是**不带扩展名的 assetId**，文件名必须严格等于 `<assetId>.<ext>` 并放在 `public/assets/` 下（候选扩展名链、命名与清单见 `docs/engineering/ASSETS.md`）。assetId 写 `foo`、文件叫 `foo.png` 是对的；若数据里写成 `foo.png` 而文件叫 `foo.jpg` 则两处都命中失败。逐个验证：`curl -I http://localhost:4173/webgame/assets/<assetId>.jpg`。

### Q: 仓库/产物体积失控（几十 MB 图片）
A: 位图统一**长边 ≤2000 + JPEG q90** 后再放进 `public/assets/`（配方见 `docs/engineering/ASSETS.md` §3）；AI 生成的原始大图放 `src/assets/img/`（已 gitignore，不进构建、不进仓库）。`public/assets` 总预算 ≤25 MB。
