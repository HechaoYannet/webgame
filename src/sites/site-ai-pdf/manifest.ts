/**
 * site-ai-pdf manifest —— 论文 AI 翻译解读工具站（仿 AI 论文解读工具）。
 *
 * 两页站点（经 getPageContent 取自 public/data/browser/pages/）:
 *  - page-ai-pdf-home   工具首页（功能介绍 + 上传校验，本站默认落地页）
 *  - page-ai-interpret  解读结果页（上传校验通过后展示的 AI 解读文章）
 *
 * 无 loginForm block，无后台，无任何登录门控——首页公开，解读结果由上传校验成功后跳转到达。
 *
 * 站内路由（pageId → 相对路径）声明于此，供 index.tsx 与导航复用。
 *
 * EXPECTED_PAPER_SHA256：上传论文 PDF 的预期 sha256（hex 小写 64 位）。已回填真实值——
 * paper-source-crystal.pdf 整文件 sha-256（sha256sum 实算）。严格匹配，失配提示"文件哈希不匹配"。
 *
 * 边界：仅 import 本目录 / @/types / @/sites/shared。不碰游戏系统。
 */
export const siteId = 'site-ai-pdf'

/** 预期论文 PDF 的 sha-256（hex 小写 64 位）。
 *  占位态 = 以 "TODO" 开头 → 放行任意 PDF；回填真实 hex 后严格匹配。
 *  已回填：paper-source-crystal.pdf 整文件 sha-256（sha256sum 实算）。 */
export const EXPECTED_PAPER_SHA256 = 'cc5038dda8c2ceefe5135755490159371c120caeac6f4f0ca76acc18f0add9f3'

export interface AiPdfManifest {
  siteId: string
  name: string
  /** 本站是否含登录后台页（工具站无）。 */
  hasAdmin: false
  /** 站内 pageId → 相对路径。 */
  pageRoutes: Array<{ pageId: string; path: string }>
  /** 登录谜题 id 列表（无 → 空数组）。 */
  loginPuzzleIds: string[]
}

const pageRoutes: AiPdfManifest['pageRoutes'] = [
  { pageId: 'page-ai-pdf-home', path: 'home' },
  { pageId: 'page-ai-interpret', path: 'result' },
]

export const manifest: AiPdfManifest = {
  siteId,
  name: '论文AI翻译解读',
  hasAdmin: false,
  pageRoutes,
  loginPuzzleIds: [],
}

/** pageId → 站内相对路径反查（站内导航用）。 */
export const pathByPageId = new Map<string, string>(
  pageRoutes.map((r) => [r.pageId, r.path]),
)

/** 站内相对路径 → pageId 反查（路由匹配后取内容用）。 */
export const pageIdByPath = new Map<string, string>(
  pageRoutes.map((r) => [r.path, r.pageId]),
)
