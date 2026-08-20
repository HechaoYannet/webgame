/**
 * src/sites/site-xinxwang/index.tsx
 *
 * 新希望成长中心 官方网站 —— 站点根。
 *
 * 挂载在宿主路由 /site/site-xinxwang/ 下（splat 接管任意子路径）。
 * 本根组件用 <Routes> 做站内导航：相对路径，如 about / admission / news / news/lab-coop /
 * admin / admin/financial 等。slug 与 pageId 的对应见 manifest.ts。
 *
 * 边界：仅 import react、react-router、@/sites/shared/*、@/types、本目录。
 * 禁止 import @/engine、@/game、@/data/loader、@/ui、@/utils、src/apps、@/sites/sitePage。
 *
 * 注：本文件不含任何含星紧接斜杠的双字符序列，符合编码约束。
 */
import { Route, Routes } from 'react-router'
import { manifest } from './manifest'
import { HomePage } from './HomePage'
import { SitePage } from './SitePage'

export const siteId = manifest.siteId

export default function XinxwangSite(): JSX.Element {
  return (
    <Routes>
      {/* 首页：定制版式（hero + stats + 简介） */}
      <Route index element={<HomePage />} />

      {/* 各内容页：通用 SitePage */}
      <Route path="about" element={<SitePage pageId="page-xinxwang-about" />} />
      <Route path="admission" element={<SitePage pageId="page-xinxwang-admission" />} />
      <Route path="cases" element={<SitePage pageId="page-xinxwang-cases" />} />
      <Route path="cooperation" element={<SitePage pageId="page-xinxwang-cooperation" />} />

      {/* 新闻栏目 + 三篇新闻文章 */}
      <Route path="news" element={<SitePage pageId="page-xinxwang-news" />} />
      <Route path="news/lab-coop" element={<SitePage pageId="page-xinxwang-news-lab" />} />
      <Route path="news/spring2026" element={<SitePage pageId="page-xinxwang-news-spring" />} />
      <Route path="news/newyear2026" element={<SitePage pageId="page-xinxwang-news-newyear" />} />

      {/* 团队 / 家长心声 / 联系 */}
      <Route path="team" element={<SitePage pageId="page-xinxwang-team" />} />
      <Route path="voices" element={<SitePage pageId="page-xinxwang-voices" />} />
      <Route path="contact" element={<SitePage pageId="page-xinxwang-contact" />} />

      {/* 后台：登录页 → 成功后跳 financial */}
      <Route path="admin" element={<SitePage pageId="page-xinxwang-admin" />} />
      <Route path="admin/financial" element={<SitePage pageId="page-xinxwang-financial" />} />

      {/* 兜底：未匹配的站内路径回首页 */}
      <Route path="*" element={<HomePage />} />
    </Routes>
  )
}
