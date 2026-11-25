/**
 * site-baidu —— 百度搜索 站点清单。
 *
 * 该站点是搜索引擎，非内容站：首页搜索框 + 结果页（新标签打开命中页面）。
 * 站内无后台、无登录表单、无门控。loginPuzzleIds 因此为空。
 * pageRoutes 仅登记站内两条路由（首页空路径、结果页 s），供 pageId 反查兜底。
 */
export const siteId = 'site-baidu'

export interface BaiduManifest {
  siteId: string
  name: string
  /** 本站是否含登录后台页（搜索引擎无）。 */
  hasAdmin: false
  /** 站内 pageId → 路由 slug：首页空串，结果页 s。 */
  pageRoutes: Array<{ pageId: string; path: string }>
  /** 登录谜题 id 列表（无 → undefined）。 */
  loginPuzzleIds?: string[]
}

export const manifest: BaiduManifest = {
  siteId,
  name: '百度搜索',
  hasAdmin: false,
  pageRoutes: [{ pageId: 'page-baidu-search', path: '' }],
}
