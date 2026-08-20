/**
 * src/sites/site-xinxwang/SitePage.tsx
 *
 * 通用页面容器：按 pageId 取 page JSON，渲染版式（面包屑 + 标题 + blocks）。
 * 非首页/非后台页都走它。首页 (home) 走 HomePage（定制 hero+stats），
 * 后台登录 (admin) / 财务 (financial) 走 AdminPage / 后台版式。
 */
import { useEffect, useState, type ReactElement } from 'react'
import { Link, useNavigate } from 'react-router'
import { useSiteBase, sitePath } from '@/sites/shared/siteNav'
import { getPageContent, type SitePage as SitePageData } from '@/sites/shared/pageContent'
import { reportPuzzleSolved } from '@/sites/shared/gameEvent'
import { BlockRenderer } from './BlockRenderer'
import { Layout, pageIdToPath } from './Layout'
import { slugByPageId, manifest } from './manifest'

interface SitePageProps {
  pageId: string
  /** 当前页是否为后台类（隐藏主框架喧宾夺主，但仍显示版式）。 */
  minimalFrame?: boolean
}

export function SitePage({ pageId }: SitePageProps): ReactElement {
  const base = useSiteBase()
  const [page, setPage] = useState<SitePageData | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    void getPageContent(pageId).then(setPage)
  }, [pageId])

  if (!page) {
    return (
      <Layout>
        <div className="xw-loading">页面加载中…</div>
      </Layout>
    )
  }

  // admin 页：含 loginForm，登录成功跳 financial
  if (pageId === 'page-xinxwang-admin') {
    // 登录成功：跳财务页 + 上报 puzzle-xinxwang-backend 已解（站点唯一触游戏状态处，
    // 与 site-ai-pdf / site-lvzhong 同构：reportPuzzleSolved 经 gameEvent 间接写 gameStore，
    // 不违站→游戏边界）。后台登录是红鲱鱼支线（88888888），不进通关必需证据，但登录后
    // 会触发手机收到"验证码短信"与"未知号码来电"，强化机构监视玩家的压迫感。
    const backendPuzzleId = manifest.loginPuzzleIds[0] ?? 'puzzle-xinxwang-backend'
    const handleLoginSuccess = (): void => {
      reportPuzzleSolved(backendPuzzleId)
      navigate(sitePath(base, 'admin/financial'))
    }
    return (
      <Layout>
        <Breadcrumbs pageId={pageId} title={page.title} />
        <div className="xw-admin-wrap">
          <div className="xw-admin-card">
            <div className="xw-admin-bar">
              <strong>{page.title.replace(' — ', ' · ')}</strong>
              <span>v3.2.1</span>
            </div>
            <BlockRenderer
              blocks={page.blocks}
              loginTokens={page.loginTokens}
              onLoginSuccess={handleLoginSuccess}
            />
          </div>
        </div>
      </Layout>
    )
  }

  // financial 页：后台版式，左上有返回登录链接
  if (pageId === 'page-xinxwang-financial') {
    return (
      <Layout>
        <Breadcrumbs pageId={pageId} title={page.title} />
        <div className="xw-admin-bar" style={{ marginBottom: 16 }}>
          <strong>财务管理系统 · 已登录</strong>
          <Link to={sitePath(base, 'admin')} style={{ color: '#bfe0e4' }}>退出登录</Link>
        </div>
        <BlockRenderer blocks={page.blocks} />
      </Layout>
    )
  }

  // 普通内容页
  return (
    <Layout>
      <Breadcrumbs pageId={pageId} title={page.title} />
      <BlockRenderer blocks={page.blocks} loginTokens={page.loginTokens} />
    </Layout>
  )
}

/* ---------- 面包屑 ---------- */
function Breadcrumbs({ pageId, title }: { pageId: string; title: string }): ReactElement {
  const base = useSiteBase()
  const slug = slugByPageId.get(pageId) ?? ''
  // 二级页（news/xxx）显示 新闻动态 > 标题
  const parts = slug.split('/')
  const isSubNews = parts[0] === 'news' && parts.length > 1

  return (
    <nav className="xw-crumb">
      <Link to={base}>首页</Link>
      {isSubNews ? (
        <>
          <span>{'>'}</span>
          <Link to={sitePath(base, pageIdToPath('page-xinxwang-news'))}>新闻动态</Link>
          <span>{'>'}</span>
          <span style={{ color: '#4a5a62' }}>{title.replace(/^.*— /, '')}</span>
        </>
      ) : pageId === 'page-xinxwang-home' ? (
        <span style={{ color: '#4a5a62' }}>首页</span>
      ) : (
        <>
          <span>{'>'}</span>
          <span style={{ color: '#4a5a62' }}>{title.replace(/^.*— /, '')}</span>
        </>
      )}
    </nav>
  )
}
