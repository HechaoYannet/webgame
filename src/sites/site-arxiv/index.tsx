/**
 * site-arxiv —— 预印本论文库（仿 arXiv 风格）。
 *
 * 两页内容（经 getPageContent 取自 public/data/browser/pages/）:
 *  - page-arxiv-list  论文列表（本站默认落地页）
 *  - page-arxiv-paper 论文详情：标题、作者、基金号 2025YFC0123456、摘要、PDF、评论
 *
 * 无 loginForm block，无后台，无任何访问门控——全公开。
 *
 * 站点根挂在 /site/site-arxiv 下任意子路径。站内用相对 Routes 做导航：
 *  index     → 重定向到 list
 *  list      → 论文列表（渲染 page-arxiv-list 的 articleList）
 *  abs/2026.0228.001 → 论文详情（渲染 page-arxiv-paper 的 blocks）
 *
 * 边界（强制）: 仅 import react / react-router / @/sites/shared 子目录 / @/types / 本目录。
 * 严禁 import @/engine、@/game、@/data/loader、@/ui、@/utils、src/apps、@/sites/sitePage。
 */
import { useEffect, useState, type ReactElement } from 'react'
import { Routes, Route, Link, Navigate } from 'react-router'
import { getPageContent, type SitePage } from '@/sites/shared/pageContent'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import type { PageBlock } from '@/types'
import { Layout } from './Layout'
import { BlockView } from './BlockView'

export const siteId = 'site-arxiv'

export default function ArxivSite(): ReactElement {
  /**
   * 站点根挂在 /site/site-arxiv 下任意子路径。站内 Routes 的 path 仍相对（react-router
   * 路由匹配正常），但**导航链接/重定向用绝对站点路径**（sitePath(base,...)），避免孤立
   * Routes 的 <Link to> 相对解析累积成 /list/list。
   */
  const base = useSiteBase()
  return (
    <Layout>
      <Routes>
        <Route index element={<Navigate to={sitePath(base, 'list')} replace />} />
        <Route path="list" element={<ListPage />} />
        <Route path="abs/2026.0228.001" element={<PaperPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}

/** 论文列表页（page-arxiv-list）：渲染 articleList 为主条目列表，渲染其余 blocks。 */
function ListPage(): ReactElement {
  const base = useSiteBase()
  const [page, setPage] = useState<SitePage | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    setLoading(true)
    void getPageContent('page-arxiv-list').then((p) => {
      if (!alive) return
      setPage(p)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  if (loading) {
    return <div className="site-arxiv-loading">加载中…</div>
  }
  if (!page) {
    return <NotFound />
  }

  // 找到 articleList 块单独渲染成 arXiv 列表样式；其余块走通用 BlockView
  const articleListBlock = page.blocks.find(
    (b): b is Extract<PageBlock, { type: 'articleList' }> => b.type === 'articleList',
  )

  return (
    <div>
      <div className="site-arxiv-crumb">
        <Link to={sitePath(base, 'list')}>首页</Link>
        <span className="site-arxiv-crumb-sep">›</span>
        <span>论文列表</span>
      </div>

      <h2 className="site-arxiv-section-head">最新预印本</h2>
      <div className="site-arxiv-section-meta">
        本库当前共收录 1 篇预印本 · 按提交时间排序
      </div>

      {/* 渲染 nav 块等非 articleList 的附加块 */}
      {page.blocks
        .filter((b) => b.type !== 'articleList')
        .map((b, i) => (
          <BlockView key={i} block={b} />
        ))}

      {/* articleList 渲染为 arXiv 式条目列表 */}
      {articleListBlock ? (
        <ul className="site-arxiv-list">
          {articleListBlock.items.map((it, i) => (
            <li className="site-arxiv-list-item" key={i}>
              <div className="site-arxiv-list-item-head">
                [Submitted: {it.date ?? '—'}]
              </div>
              <h3 className="site-arxiv-list-item-title">
                <Link to={sitePath(base, 'abs/2026.0228.001')}>{it.title}</Link>
              </h3>
              <p className="site-arxiv-list-item-authors">
                Authors: Chen Jianguo, et al. (Shanhe Medical University)
              </p>
              <p className="site-arxiv-list-item-subjects">
                Subjects: q-bio.BM Biomaterials; physics.med-ph Medical Physics;
                chembio Biochemistry
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="site-arxiv-list-empty">暂无预印本。</div>
      )}
    </div>
  )
}

/** 论文详情页（page-arxiv-paper）：渲染摘要、metadata、PDF、评论等 blocks。 */
function PaperPage(): ReactElement {
  const base = useSiteBase()
  const [page, setPage] = useState<SitePage | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    setLoading(true)
    void getPageContent('page-arxiv-paper').then((p) => {
      if (!alive) return
      setPage(p)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  if (loading) {
    return <div className="site-arxiv-loading">加载中…</div>
  }
  if (!page) {
    return <NotFound />
  }

  // 把段落里的"▌ Abstract" "▌ 评论区"等提升为 section 标题；callout 评论项单独框装
  return (
    <div>
      <div className="site-arxiv-crumb">
        <Link to={sitePath(base, 'list')}>首页</Link>
        <span className="site-arxiv-crumb-sep">›</span>
        <Link to={sitePath(base, 'list')}>论文列表</Link>
        <span className="site-arxiv-crumb-sep">›</span>
        <span>2026.0228.001</span>
      </div>

      {page.blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}

      <div className="site-arxiv-back">
        <Link to={sitePath(base, 'list')}>‹ 返回论文列表</Link>
      </div>
    </div>
  )
}

function NotFound(): ReactElement {
  const base = useSiteBase()
  return (
    <div className="site-arxiv-notfound">
      <div style={{ fontSize: 44, marginBottom: 10 }}>404</div>
      <div>页面未找到</div>
      <div style={{ marginTop: 12 }}>
        <Link to={sitePath(base, 'list')} style={{ color: '#b31b1b', textDecoration: 'none' }}>
          返回论文列表
        </Link>
      </div>
    </div>
  )
}
