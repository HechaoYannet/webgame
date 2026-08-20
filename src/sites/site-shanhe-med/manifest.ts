/**
 * site-shanhe-med manifest —— 站点元信息（非运行时依赖，供编排层聚合/审阅）。
 *
 * 注意：注释里禁止出现星紧接斜杠的字符序列，故路径通配均用文字描述。
 */
export const manifest = {
  siteId: 'site-shanhe-med',
  name: '山河医科大学',
  /** 本站所涉后台登录谜题（供编排层把 puzzleId 接到 loginForm 的 token 上）。 */
  loginPuzzleIds: ['puzzle-lab-backend'],
} as const

export default manifest
