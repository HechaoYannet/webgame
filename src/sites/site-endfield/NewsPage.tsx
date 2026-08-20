/**
 * site-endfield 新闻公告页（全面测试资格公告）。
 *
 * 渲染 page-endfield-news 的内容块。核心视觉锚点：把公测日期
 * 2025-11-28 抽成醒目的 date pill，让玩家一眼捕捉。
 */
import type { ReactElement } from 'react'
import type { SitePage } from '@/sites/shared/pageContent'
import { renderBlocks } from './index'

export interface NewsPageProps {
  page: SitePage | null
}

export function NewsPage({ page }: NewsPageProps): ReactElement {
  if (!page) {
    return <div className="site-endfield__loading">加载中…</div>
  }
  return (
    <article>
      {/* 把公告日期做成视觉锚点：醒目彩色 pill。 */}
      <span className="site-endfield__date-pill">公测日期 · 2025-11-28</span>
      <h1 className="site-endfield__hero-heading">{page.title}</h1>
      {renderBlocks(page.blocks)}
    </article>
  )
}
