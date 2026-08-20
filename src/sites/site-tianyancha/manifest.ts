/**
 * site-tianyancha manifest —— 天眼查（仿）企业工商信息查询站 清单。
 *
 * 两页站点，无 loginForm block，无后台 → loginPuzzleIds 为空。
 * 站内路由（pageId → 相对路径）声明于此，供 index.tsx 与导航复用。
 *
 * 边界：仅 import 本目录 / @/types。不碰游戏系统。
 */
export const siteId = 'site-tianyancha'

export interface TianyanchaManifest {
  siteId: string
  name: string
  /** 本站是否含登录后台页（天眼查仿站无）。 */
  hasAdmin: false
  /** 站内 pageId → 相对路径。 */
  pageRoutes: Array<{ pageId: string; path: string }>
  /** 登录谜题 id 列表（无 → 空数组）。 */
  loginPuzzleIds: string[]
}

const pageRoutes: TianyanchaManifest['pageRoutes'] = [
  { pageId: 'page-tianyancha', path: 'company' },
  { pageId: 'page-tianyancha-chen', path: 'person/chen-jianguo' },
]

export const manifest: TianyanchaManifest = {
  siteId,
  name: '天眼查',
  hasAdmin: false,
  pageRoutes,
  loginPuzzleIds: [],
}

/** pageId → 站内相对路径反查。 */
export const pathByPageId = new Map<string, string>(
  pageRoutes.map((r) => [r.pageId, r.path]),
)
