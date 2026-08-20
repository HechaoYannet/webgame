/**
 * site-endfield 站点元数据（按站点交付契约提供）。
 *
 * 当前 SiteRouter 仅按 index.tsx 的 siteId 命名导出注册根组件，并不读取本文件；
 * 本文件留存是为了编排/审计层的一致性，以及记录该站是否含登录后台。
 *
 * 本站为《明日方舟：终末地》仿官方网站，仅一个公开页面 page-endfield-news
 * （全面测试资格公告），无任何登录后台，故 loginPuzzleIds 为 undefined。
 */
export const manifest = {
  siteId: 'site-endfield',
  name: '明日方舟：终末地 官网',
} as const

export default manifest
