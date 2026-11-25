/**
 * manifest.ts —— 湖南省教育厅站点清单。
 *
 * siteId: 与路由 /site/site-hnedu 一致。
 * name: 顶栏品牌名（政务门户）。
 * loginPuzzleIds: 本站内容页无 loginForm 块，故不声明登录谜题。
 * pageRoutes: 单页门户，首页即 page-hnedu（站内子栏目共用该页内容）。
 */
export const manifest = {
  siteId: 'site-hnedu',
  name: '湖南省教育厅',
  loginPuzzleIds: [] as string[],
  pageRoutes: [{ pageId: 'page-hnedu', path: '' }],
} as const

export default manifest
