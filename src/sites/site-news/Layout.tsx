/**
 * site-news/Layout —— 站点外壳：顶部红底通栏 + 主导航 + 内容区 + 底栏。
 *
 * 主导航是固定的频道入口（首页为主，其余为本站若干代表文章的直达），
 * 让站点像一个真实的新闻门户，而不是一堆文章的裸列表。
 *
 * 导航 to 用**绝对站点路径**（sitePath(base, seg)），避免孤立 Routes 相对解析累积。
 * Route path 不在这儿（在 index.tsx），这里只管链接。
 */
import type { ReactElement, ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import './site.css'

interface LayoutProps {
  children: ReactNode
}

/** 导航项的相对段（渲染前转绝对站点路径）。 */
const NAV_SEGS: Array<{ label: string; seg: string }> = [
  { label: '首页', seg: '' },
  { label: '社会', seg: '3-missing' },
  { label: '教育', seg: 'edu-inspection' },
  { label: '深度', seg: 'addiction-school' },
  { label: '健康', seg: 'health-notice' },
  { label: '法治', seg: 'police-crackdown' },
  { label: '科技', seg: 'energy-award' },
]

export function Layout({ children }: LayoutProps): ReactElement {
  const base = useSiteBase()
  const location = useLocation()

  // 当前站点相对首段（base 之后的剩余路径首段），用于高亮主导航。
  const pathname = location.pathname.replace(/\/+$/, '')
  const baseClean = base.replace(/\/+$/, '')
  const afterBase = pathname.startsWith(baseClean)
    ? pathname.slice(baseClean.length).replace(/^\/+/, '')
    : ''
  const currentSeg = afterBase.split('/')[0] ?? ''

  return (
    <div className="site-news-root">
      <header className="site-news-topbar">
        <div className="site-news-topbar-inner">
          <div className="site-news-brand">
            <span className="site-news-brand-name">湖南新闻网</span>
            <span className="site-news-brand-slogan">聚焦三湘 · 服务民生</span>
          </div>
          <div className="site-news-topbar-meta">
            湘ICP备2019004526号 · 湘公网安备43010502000321号
            <br />
            新闻热线：0731-85551234
          </div>
        </div>
      </header>

      <nav className="site-news-nav">
        <div className="site-news-nav-inner">
          {NAV_SEGS.map((item) => {
            const isActive = item.seg === currentSeg
            return (
              <Link
                key={item.seg || 'home'}
                to={sitePath(base, item.seg)}
                className={`site-news-nav-link${isActive ? ' is-active' : ''}`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <main className="site-news-main">{children}</main>

      <footer className="site-news-footer">
        <div>湖南新闻网 HUNAN NEWS · 主管单位：湖南省互联网信息办公室</div>
        <div>地址：湖南省长沙市开福区芙蓉中路一段440号 · 邮编：410016 · 投稿邮箱：editor@hunan-news.cn</div>
        <div className="site-news-footer-icp">
          湘ICP备2019004526号 · 互联网新闻信息服务许可证：43120200055 · Copyright © 2020-2026 hunan-news.cn
        </div>
      </footer>
    </div>
  )
}
