/**
 * site-ai-pdf/Layout —— AI 论文解读工具站外壳：深紫蓝品牌顶栏 + 主区 + 页脚。
 *
 * 参照 site-arxiv/site.css 的 .site-arxiv-root：根容器 width:100% / min-height:100vh /
 * 自带底色，避免左右黑边。简洁工具站，无侧栏、无多级导航。
 */
import type { ReactElement, ReactNode } from 'react'
import { Link } from 'react-router'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import './site.css'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps): ReactElement {
  const base = useSiteBase()
  return (
    <div className="site-ai-pdf-root">
      <header className="site-ai-pdf-topbar">
        <div className="site-ai-pdf-topbar-inner">
          <Link to={sitePath(base, 'home')} className="site-ai-pdf-brand">
            <span className="site-ai-pdf-brand-mark">AI</span>
            <span className="site-ai-pdf-brand-name">论文 AI 翻译解读</span>
            <span className="site-ai-pdf-brand-sub">PDF 秒读论文</span>
          </Link>
          <Link to={sitePath(base, 'home')} className="site-ai-pdf-nav-link">
            首页
          </Link>
        </div>
      </header>

      <main className="site-ai-pdf-main">
        {children}
      </main>

      <footer className="site-ai-pdf-footer">
        <div>论文 AI 翻译解读 · 第三方 AI 引擎驱动</div>
        <div className="site-ai-pdf-footer-meta">
          本工具使用AI提供服务 · © 2026 论文 AI 翻译解读 · 网址：www.paperai.cn
        </div>
      </footer>
    </div>
  )
}
