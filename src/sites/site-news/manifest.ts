/**
 * site-news —— 湖南新闻网 站点清单。
 *
 * 一个普通的地市级新闻门户：首页 + 若干新闻文章页。全公开、无门控、无登录后台。
 * 内容来自 public/data/browser/pages/page-news-*.json（由 getPageContent 取）。
 */
export const siteId = 'site-news'

export interface NewsManifest {
  siteId: string
  name: string
  /** 本站是否含登录后台页（湖南新闻网无）。 */
  hasAdmin: false
  /** 站内 pageId → 路由 slug（首页用空串，文章页用派生 slug）。 */
  pageRoutes: Array<{ pageId: string; slug: string; isHome: boolean }>
  /** 登录谜题 id 列表（无 → undefined）。 */
  loginPuzzleIds?: string[]
}

const pageRoutes: NewsManifest['pageRoutes'] = [
  { pageId: 'page-news-home', slug: '', isHome: true },
  { pageId: 'page-news-3-missing', slug: '3-missing', isHome: false },
  { pageId: 'page-news-school-addiction', slug: 'school-addiction', isHome: false },
  { pageId: 'page-news-addiction-school', slug: 'addiction-school', isHome: false },
  { pageId: 'page-news-energy-award', slug: 'energy-award', isHome: false },
  { pageId: 'page-news-health-notice', slug: 'health-notice', isHome: false },
  { pageId: 'page-news-police-crackdown', slug: 'police-crackdown', isHome: false },
  { pageId: 'page-news-edu-inspection', slug: 'edu-inspection', isHome: false },
]

export const manifest: NewsManifest = {
  siteId,
  name: '湖南新闻网',
  hasAdmin: false,
  pageRoutes,
}

/** pageId → slug 反查（站内导航/文章列表点击跳转用）。 */
export const slugByPageId = new Map<string, string>(
  pageRoutes.map((r) => [r.pageId, r.slug]),
)

/** slug → pageId 反查（路由匹配后取内容用）。 */
export const pageIdBySlug = new Map<string, string>(
  pageRoutes.map((r) => [r.slug, r.pageId]),
)
