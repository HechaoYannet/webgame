/**
 * site-hnga index —— 湖南省公安厅政务门户网站根。
 *
 * 站点根挂在宿主 SPA 路由 /site/site-hnga 任意子路径下（HashRouter，
 * 由 AppRouter 配置 /site/:siteId/*）。本根组件用相对路径 <Routes> 做站内导航。
 *
 * 站内路由：
 *   ""（根）          → 首页（page-hnga 内容 + 举报电话横幅 + 警务要闻框架）
 *   intro / open / report / service / interact / disclose → 各板块占位页
 *   *                  → 兜底：重定向到首页
 *
 * 关键：举报电话 0731-88888888 来自 page-hnga.json 的 callout（权威数据），
 * 本站仅在政务首页外围重复展示，确保号码醒目且与数据一致。
 *
 * 边界：仅 import react、react-router、@/sites/shared、@/types、本目录文件。
 */
import { Navigate, Route, Routes } from 'react-router'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import HomePage from './HomePage'
import SectionPage from './SectionPage'
import './site.css'

export const siteId = 'site-hnga'

export default function HngaSite(): JSX.Element {
  /**
   * 站点根挂在 /site/site-hnga 下任意子路径。站内 Routes 的 path 仍相对（react-router
   * 路由匹配正常），但**导航链接/重定向用绝对站点路径**（sitePath(base, ...)），避免孤立
   * Routes 的 <Link>/<Navigate> 相对解析累积成 /report/report。
   */
  const base = useSiteBase()
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="intro" element={<SectionPage section="intro" />} />
      <Route path="open" element={<SectionPage section="open" />} />
      <Route path="report" element={<SectionPage section="report" />} />
      <Route path="service" element={<SectionPage section="service" />} />
      <Route path="interact" element={<SectionPage section="interact" />} />
      <Route path="disclose" element={<SectionPage section="disclose" />} />
      {/* 兜底：未匹配子路径重定向回首页 */}
      <Route path="*" element={<Navigate to={sitePath(base, '')} replace />} />
    </Routes>
  )
}
