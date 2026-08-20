/**
 * site-hnga manifest —— 湖南省公安厅政务门户站点清单。
 *
 * 单页站点，无登录后台（页面无 loginForm 块），故 loginPuzzleIds 为空。
 * 仅声明本站标识与名称；路由/页面内容在 index.tsx 与各页面组件内。
 */
export const manifest = {
  siteId: 'site-hnga',
  name: '湖南省公安厅',
  /** 后台登录谜题 id（无后台则为空）。 */
  loginPuzzleIds: [] as string[],
} as const

export default manifest
