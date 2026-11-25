/**
 * site-hnga manifest —— 湖南省公安厅政务门户站点清单。
 *
 * 单页站点，无登录后台（页面无 loginForm 块），故 loginPuzzleIds 为空。
 * pageRoutes: 首页即 page-hnga（站内栏目共用该页内容）。
 */
export const manifest = {
  siteId: 'site-hnga',
  name: '湖南省公安厅',
  /** 后台登录谜题 id（无后台则为空）。 */
  loginPuzzleIds: [] as string[],
  pageRoutes: [{ pageId: 'page-hnga', path: '' }],
} as const

export default manifest
