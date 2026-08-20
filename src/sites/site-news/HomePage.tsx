/**
 * site-news/HomePage —— 首页（page-news-home）。
 *
 * 渲染 hero 通栏 + 文章列表。文章列表的 pageId 映射到站内路由 slug 跳转。
 */
import { useEffect, useState, type ReactElement } from 'react'
import { Link } from 'react-router'
import { getPageContent, type SitePage } from '@/sites/shared/pageContent'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import { BlockView } from './BlockView'
import { slugByPageId } from './manifest'

const PAGE_ID = 'page-news-home'

export function HomePage(): ReactElement {
  const base = useSiteBase()
  const [page, setPage] = useState<SitePage | null>(null)

  useEffect(() => {
    void getPageContent(PAGE_ID).then(setPage)
  }, [])

  if (!page) {
    return <div className="site-news-loading">加载中…</div>
  }

  return (
    <>
      {/* 先渲染非文章列表块（hero 等） */}
      {page.blocks
        .filter((b) => b.type !== 'articleList')
        .map((b, i) => (
          <BlockView key={i} block={b} />
        ))}

      {/* 文章列表：本站首页的核心。 */}
      {page.blocks
        .filter((b) => b.type === 'articleList')
        .map((b, i) =>
          b.type === 'articleList' ? (
            <section key={i}>
              <h2 className="site-news-list-title">最新报道</h2>
              <ul className="site-news-list">
                {b.items.map((item, li) => {
                  const slug = slugByPageId.get(item.pageId) ?? ''
                  return (
                    <li key={li} className="site-news-list-item">
                      <Link to={sitePath(base, slug)} className="site-news-list-link">
                        <span className="site-news-list-title-text">{item.title}</span>
                        {item.date && (
                          <time className="site-news-list-date">{item.date}</time>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null,
        )}
    </>
  )
}
