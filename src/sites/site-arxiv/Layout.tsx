/**
 * site-arxiv/Layout —— 站点外壳：红底 arXiv 式通栏 + 主导航 + 左侧学科分类条 + 内容区 + 底栏。
 *
 * 主导航是 arXiv 式的频道入口（列表 / 关于 / 帮助 等），其中"论文"指向本站列表页。
 * 左侧 sidebar 是 arXiv 经典的学科分类条（本站仅展示静态分类，强调学术站身份）。
 */
import type { ReactElement, ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import './site.css'

interface LayoutProps {
  children: ReactNode
}

/** 左侧学科分类条（arXiv 式静态展示，强化"预印本库"身份）。 */
const SUBJECT_GROUPS: Array<{ title: string; items: string[] }> = [
  {
    title: '生命科学',
    items: ['q-bio.BM 生物大分子', 'q-bio.CB 细胞行为', 'q-bio.GN 遗传学', 'q-bio.TO 组织与器官'],
  },
  {
    title: '物理科学',
    items: ['physics.bio-ph 生物物理', 'physics.med-ph 医学物理'],
  },
  {
    title: '化学',
    items: ['physics.chem-ph 化学物理'],
  },
]

export function Layout({ children }: LayoutProps): ReactElement {
  const location = useLocation()
  const base = useSiteBase()
  // 当前相对路径（去掉前导斜杠），用于高亮主导航
  const currentPath = location.pathname.replace(/^\/+/, '').replace(/\/+$/, '')

  // 主导航项（相对段，经 sitePath(base, ...) 转绝对站点路径，避免孤立 Routes 相对解析累积）。
  const NAV_ITEMS: Array<{ label: string; to: string }> = [
    { label: '论文', to: sitePath(base, 'list') },
    { label: '关于本库', to: sitePath(base, 'list') },
    { label: '提交须知', to: sitePath(base, 'list') },
    { label: '帮助', to: sitePath(base, 'list') },
  ]

  return (
    <div className="site-arxiv-root">
      <header className="site-arxiv-topbar">
        <div className="site-arxiv-topbar-inner">
          <Link to={sitePath(base, 'list')} className="site-arxiv-brand">
            <span className="site-arxiv-brand-mark">arXiv.shanhe</span>
            <span className="site-arxiv-brand-sub">山河医科大学预印本文献库</span>
          </Link>
          <div className="site-arxiv-topbar-meta">
            河西校区 · 湘ICP备2021007733号
            <br />
            reflib@arxiv.shanhe-med.cn
          </div>
        </div>
      </header>

      <nav className="site-arxiv-nav">
        <div className="site-arxiv-nav-inner">
          {NAV_ITEMS.map((item) => {
            // "论文" 高亮 list；其余项不单独高亮（静态展示）
            const isActive = item.label === '论文' && currentPath.includes('list')
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`site-arxiv-nav-link${isActive ? ' is-active' : ''}`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <main className="site-arxiv-main">
        <aside className="site-arxiv-sidebar">
          {SUBJECT_GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="site-arxiv-sidebar-title">{g.title}</h3>
              <ul className="site-arxiv-sidebar-list">
                {g.items.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ))}
          <div className="site-arxiv-sidebar-note">
            本库收录校内研究者提交的预印本，未经同行评审。每篇预印本附作者
            自述摘要与全文 PDF。
          </div>
        </aside>

        <div className="site-arxiv-content">{children}</div>
      </main>

      <footer className="site-arxiv-footer">
        <div>arXiv.shanhe · 山河医科大学图书馆预印本文献库</div>
        <div>本库由山河医科大学图书馆维护 · 内容仅供学术交流，不代表机构立场</div>
        <div className="site-arxiv-footer-meta">
          Copyright © 2020-2026 arxiv.shanhe-med.cn · 湘ICP备2021007733号 · 湘公网安备43010502000654号
        </div>
      </footer>
    </div>
  )
}
