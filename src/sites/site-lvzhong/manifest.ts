/**
 * site-lvzhong —— 湖南绿草中学 官方网站 站点清单。
 *
 * 一个普通的中国中学校园门户：首页 + 通知公告 + 校园新闻 + 教学科研 +
 * 德育之窗 + 校园风光 + 校长信箱 + 学校简介。站内含一个隐藏的校务内部
 * 系统登录入口（/notice/screening/qiangzhang），登录后揭示协议、筛查名单
 * PDF、通讯录、巡查记录四个内部后台页。
 *
 * 内容来自 public/data/browser/pages/page-lvzhong 任意 json（由 getPageContent 取）。
 */
export const siteId = 'site-lvzhong'

export interface LvzhongManifest {
  siteId: string
  name: string
  /** 本站是否含登录后台页（绿草中学有：校务内部系统）。 */
  hasAdmin: true
  /** 站内 pageId 对应当站路由 slug（首页用空串）。 */
  pageRoutes: Array<{ pageId: string; slug: string; isHome: boolean }>
  /** 登录谜题 id 列表（校务内部系统登录）。 */
  loginPuzzleIds: string[]
}

/** 站内 pageId 与路由 slug 的映射（slug 相对站点根 /site/site-lvzhong/）。 */
const pageRoutes: LvzhongManifest['pageRoutes'] = [
  { pageId: 'page-lvzhong-home', slug: '', isHome: true },
  { pageId: 'page-lvzhong-notice', slug: 'notice', isHome: false },
  { pageId: 'page-lvzhong-notice-screening', slug: 'notice/screening', isHome: false },
  { pageId: 'page-lvzhong-notice-vacation', slug: 'notice/vacation', isHome: false },
  { pageId: 'page-lvzhong-notice-phone', slug: 'notice/phone', isHome: false },
  { pageId: 'page-lvzhong-notice-signing', slug: 'notice/signing', isHome: false },
  { pageId: 'page-lvzhong-notice-annual2025', slug: 'notice/annual2025', isHome: false },
  { pageId: 'page-lvzhong-intro', slug: 'intro', isHome: false },
  { pageId: 'page-lvzhong-news', slug: 'news', isHome: false },
  { pageId: 'page-lvzhong-news-psych', slug: 'news/psych', isHome: false },
  { pageId: 'page-lvzhong-news-coop', slug: 'news/coop', isHome: false },
  { pageId: 'page-lvzhong-news-visit', slug: 'news/visit', isHome: false },
  { pageId: 'page-lvzhong-teaching', slug: 'teaching', isHome: false },
  { pageId: 'page-lvzhong-moral', slug: 'moral', isHome: false },
  { pageId: 'page-lvzhong-gallery', slug: 'gallery', isHome: false },
  { pageId: 'page-lvzhong-principal-mailbox', slug: 'mailbox', isHome: false },
  { pageId: 'page-lvzhong-contact', slug: 'contact', isHome: false },
  { pageId: 'page-lvzhong-agreement', slug: 'agreement', isHome: false },
  { pageId: 'page-lvzhong-screening-pdf', slug: 'screening-pdf', isHome: false },
  { pageId: 'page-lvzhong-patrol', slug: 'patrol', isHome: false },
  { pageId: 'page-lvzhong-qiangzhang', slug: 'notice/screening/qiangzhang', isHome: false },
]

export const manifest: LvzhongManifest = {
  siteId,
  name: '湖南绿草中学',
  hasAdmin: true,
  pageRoutes,
  loginPuzzleIds: ['puzzle-lvzhong-internal'],
}

/** pageId 转路由 slug（站内导航跳转用）。 */
export const slugByPageId = new Map<string, string>(
  pageRoutes.map((r) => [r.pageId, r.slug]),
)

/** slug 转页面 id（路由匹配后取内容用）。 */
export const pageIdBySlug = new Map<string, string>(
  pageRoutes.map((r) => [r.slug, r.pageId]),
)
