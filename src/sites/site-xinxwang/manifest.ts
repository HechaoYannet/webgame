/**
 * src/sites/site-xinxwang/manifest.ts
 *
 * 新希望成长中心 官方网站 —— 站点清单。
 *
 * 一个普通青少年行为矫正机构的官网：首页/关于/招生/案例/合作/新闻/团队/
 * 家长心声/联系 + 财务后台（管理员登录后显示财务记录页）。
 * 内容来自 public/data/browser/pages/page-xinxwang-*.json（由 getPageContent 取）。
 *
 * 边界：仅 import react、react-router、@/sites/shared 子目录、@/types、本目录。
 */
export const siteId = 'site-xinxwang'

export interface XinxwangManifest {
  siteId: string
  name: string
  /** 本站含登录后台页（财务系统）。 */
  hasAdmin: true
  /** 站内 pageId → 路由 slug（首页用空串，其余派生 slug）。 */
  pageRoutes: Array<{ pageId: string; slug: string; isHome: boolean }>
  /** 登录谜题 id 列表（仅 admin 后台用）。 */
  loginPuzzleIds: string[]
}

const pageRoutes: XinxwangManifest['pageRoutes'] = [
  { pageId: 'page-xinxwang-home', slug: '', isHome: true },
  { pageId: 'page-xinxwang-about', slug: 'about', isHome: false },
  { pageId: 'page-xinxwang-admission', slug: 'admission', isHome: false },
  { pageId: 'page-xinxwang-cases', slug: 'cases', isHome: false },
  { pageId: 'page-xinxwang-cooperation', slug: 'cooperation', isHome: false },
  { pageId: 'page-xinxwang-news', slug: 'news', isHome: false },
  { pageId: 'page-xinxwang-news-lab', slug: 'news/lab-coop', isHome: false },
  { pageId: 'page-xinxwang-news-spring', slug: 'news/spring2026', isHome: false },
  { pageId: 'page-xinxwang-news-newyear', slug: 'news/newyear2026', isHome: false },
  { pageId: 'page-xinxwang-team', slug: 'team', isHome: false },
  { pageId: 'page-xinxwang-voices', slug: 'voices', isHome: false },
  { pageId: 'page-xinxwang-contact', slug: 'contact', isHome: false },
  { pageId: 'page-xinxwang-admin', slug: 'admin', isHome: false },
  { pageId: 'page-xinxwang-financial', slug: 'admin/financial', isHome: false },
]

export const manifest: XinxwangManifest = {
  siteId,
  name: '新希望成长中心',
  hasAdmin: true,
  pageRoutes,
  loginPuzzleIds: ['puzzle-xinxwang-backend'],
}

/** pageId → slug 反查（站内 nav/articleList 链接点击跳转用）。 */
export const slugByPageId = new Map<string, string>(
  pageRoutes.map((r) => [r.pageId, r.slug]),
)

/** slug → pageId 反查（路由匹配后取内容用）。 */
export const pageIdBySlug = new Map<string, string>(
  pageRoutes.map((r) => [r.slug, r.pageId]),
)
