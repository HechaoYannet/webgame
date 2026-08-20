/**
 * site-news/ArticlePage —— 单篇新闻文章页。
 *
 * 按 pageId 取内容，渲染：面包屑 + 文章标题 + 正文块 + 返回首页。
 * 日期/来源信息本站数据写在第一个 paragraph 块里（见 page JSON），故正文块照原样渲染即可。
 */
import { useEffect, useState, type ReactElement } from 'react'
import { Link, useParams } from 'react-router'
import { getPageContent, type SitePage } from '@/sites/shared/pageContent'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import { BlockView } from './BlockView'

interface ArticlePageProps {
  /** 该路由对应的 pageId（由 index.tsx 的路由声明注入）。 */
  pageId: string
}

export function ArticlePage({ pageId }: ArticlePageProps): ReactElement {
  const base = useSiteBase()
  const params = useParams()
  const [page, setPage] = useState<SitePage | null>(null)

  useEffect(() => {
    void getPageContent(pageId).then(setPage)
  }, [pageId])

  if (!page) {
    return <div className="site-news-loading">加载中…</div>
  }

  return (
    <>
      <nav className="site-news-crumb">
        <Link to={sitePath(base, '')}>首页</Link>
        {params.slug ? <span> &gt; {page.title}</span> : null}
      </nav>

      <article>
        <header className="site-news-article-head">
          <h1 className="site-news-article-title">{page.title}</h1>
          <div className="site-news-article-meta">
            来源：湖南新闻网 · {page.url}
          </div>
        </header>

        {page.blocks.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </article>

      <div className="site-news-back">
        <Link to={sitePath(base, '')}>« 返回首页</Link>
      </div>
    </>
  )
}
