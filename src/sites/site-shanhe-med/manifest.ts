/**
 * site-shanhe-med manifest —— 站点元信息与站内路由表。
 *
 * pageRoutes 是 pageId → 站内路径的唯一声明处：index.tsx 的 <Routes> 与
 * shared/siteRegistry（百度深链 / 跨站链接）都读它，避免两份映射漂移。
 *
 * 注意：注释里禁止出现星紧接斜杠的字符序列，故路径通配均用文字描述。
 */
export const siteId = 'site-shanhe-med'

export interface ShanheManifest {
  siteId: string
  name: string
  /** 本站所涉后台登录谜题（供编排层把 puzzleId 接到 loginForm 的 token 上）。 */
  loginPuzzleIds: string[]
  /** 站内 pageId → 相对路径（首页为空串）。 */
  pageRoutes: Array<{ pageId: string; path: string }>
}

const pageRoutes: ShanheManifest['pageRoutes'] = [
  { pageId: 'page-shanhe-home', path: '' },
  { pageId: 'page-shanhe-research', path: 'research' },
  { pageId: 'page-shanhe-research-breakthrough', path: 'research/breakthrough' },
  { pageId: 'page-shanhe-research-crystal', path: 'research/crystal-paper' },
  { pageId: 'page-shanhe-structure', path: 'structure' },
  { pageId: 'page-shanhe-faculty', path: 'faculty' },
  { pageId: 'page-shanhe-lab', path: 'lab' },
  { pageId: 'page-shanhe-recruit', path: 'lab/recruit' },
  { pageId: 'page-shanhe-publications', path: 'publications' },
  { pageId: 'page-shanhe-news-funding', path: 'news/funding-2025yfc' },
  { pageId: 'page-shanhe-news-award', path: 'news/energy-award' },
  { pageId: 'page-shanhe-contact', path: 'contact' },
  { pageId: 'page-shanhe-lab-admin', path: 'admin' },
  { pageId: 'page-lab-funding-report', path: 'admin/funding-report' },
  { pageId: 'page-lab-subject-list', path: 'admin/subject-list' },
]

export const manifest: ShanheManifest = {
  siteId,
  name: '山河医科大学',
  loginPuzzleIds: ['puzzle-lab-backend'],
  pageRoutes,
}

export default manifest
