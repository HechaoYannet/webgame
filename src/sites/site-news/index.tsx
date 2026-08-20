/**
 * site-news —— 湖南新闻网（Hunan News）独立站点根组件。
 *
 * 一个普通的地市级新闻门户：顶部红底通栏品牌 + 横向频道导航 + 白底正文 + 底栏。
 * 首页是文章列表，其余是单篇新闻文章。全公开、无门控、无登录后台。
 *
 * 站内路由（相对路径，挂在宿主 HashRouter 的 /site/site-news/星号 下）：
 *   ""          → 首页（page-news-home）
 *   3-missing   → 长沙3名青少年失联
 *   school-addiction → 湖南某中学被曝将学生送入戒网瘾学校
 *   addiction-school  → 戒网瘾学校乱象调查
 *   energy-award → 山河医科大实验室获能源创新奖
 *   health-notice → 国家卫健委发文严禁未成年人人体实验
 *   police-crackdown → 湖南警方捣毁一非法人体实验窝点
 *   edu-inspection → 市教育局将开展民办教育机构专项检查
 *
 * 边界：仅 import react、react-router、@/sites/shared 子目录、@/types、本目录。
 */
import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import { Layout } from './Layout'
import { HomePage } from './HomePage'
import { ArticlePage } from './ArticlePage'

export const siteId = 'site-news'

export default function NewsSite(): ReactElement {
  // 站点根挂在 /site/site-news 下任意子路径。站内 Routes 的 path 仍相对（react-router
  // 路由匹配正常），但**导航/重定向用绝对站点路径**（sitePath(base, ...)），避免孤立
  // Routes 的 <Link to>/<Navigate to> 相对解析累积成 /3-missing/3-missing。
  const base = useSiteBase()
  return (
    <Layout>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="3-missing" element={<ArticlePage pageId="page-news-3-missing" />} />
        <Route
          path="school-addiction"
          element={<ArticlePage pageId="page-news-school-addiction" />}
        />
        <Route
          path="addiction-school"
          element={<ArticlePage pageId="page-news-addiction-school" />}
        />
        <Route
          path="energy-award"
          element={<ArticlePage pageId="page-news-energy-award" />}
        />
        <Route
          path="health-notice"
          element={<ArticlePage pageId="page-news-health-notice" />}
        />
        <Route
          path="police-crackdown"
          element={<ArticlePage pageId="page-news-police-crackdown" />}
        />
        <Route
          path="edu-inspection"
          element={<ArticlePage pageId="page-news-edu-inspection" />}
        />
        {/* 未知路径 → 回首页（不报错，因为所有页面公开、无门控） */}
        <Route path="*" element={<Navigate to={sitePath(base, '')} replace />} />
      </Routes>
    </Layout>
  )
}
