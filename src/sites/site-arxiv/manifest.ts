/**
 * site-arxiv manifest —— 预印本论文库（仿 arXiv）站点清单。
 *
 * 两页站点：
 *  - page-arxiv-list  论文列表（本站默认落地页）
 *  - page-arxiv-paper 论文详情（标题/作者/基金号/摘要/PDF/评论）
 *
 * 无 loginForm block，无后台登录 → loginPuzzleIds 为空数组。
 * 站内路由（pageId → 相对路径）声明于此，供 index.tsx 与导航复用。
 *
 * 边界：仅 import 本目录 / @/types / @/sites/shared。不碰游戏系统。
 */
export const siteId = 'site-arxiv'

export interface ArxivManifest {
  siteId: string
  name: string
  /** 本站是否含登录后台页（arXiv 仿站无）。 */
  hasAdmin: false
  /** 站内 pageId → 相对路径。 */
  pageRoutes: Array<{ pageId: string; path: string }>
  /** 登录谜题 id 列表（无 → 空数组）。 */
  loginPuzzleIds: string[]
}

const pageRoutes: ArxivManifest['pageRoutes'] = [
  { pageId: 'page-arxiv-list', path: 'list' },
  { pageId: 'page-arxiv-paper', path: 'abs/2603.01187' },
]

export const manifest: ArxivManifest = {
  siteId,
  name: '预印本论文库',
  hasAdmin: false,
  pageRoutes,
  loginPuzzleIds: [],
}

/** pageId → 站内相对路径反查（站内导航/文章列表点击跳转用）。 */
export const pathByPageId = new Map<string, string>(
  pageRoutes.map((r) => [r.pageId, r.path]),
)

/** 站内相对路径 → pageId 反查（路由匹配后取内容用）。 */
export const pageIdByPath = new Map<string, string>(
  pageRoutes.map((r) => [r.path, r.pageId]),
)
