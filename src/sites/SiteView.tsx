/**
 * src/sites/SiteView.tsx
 *
 * 全屏站点页（重写后：调查网站作为真网页，无手机框、无伪地址栏 chrome）。
 *
 * 路由：#/site/:siteId/:pageId（见 AppRouter）。
 * - 读路由参数 :siteId/:pageId → loader.getPage(pageId) → PageBlockView 渲染各 block。
 * - 站内导航（nav/articleList/loginForm 成功后）用 history.pushState 更新 hash，
 *   不整页刷新，真实浏览器前进/后退/历史可用。
 * - 首次查看某页 → chapter.visitPage(pageId) 触发 onViewEffects（ch-2 推进、经费报告四件套）。
 *   与手机框同 store（localStorage 持久化 + 同 SPA JS 上下文），点上东西直接生效，
 *   无需跨标签通信桥。
 * - 顶部一个极简头部：显示页 title + page.url（纯展示，无地址栏 chrome）+ 返回手机（关标签）。
 * - 数据就绪：main.tsx 已 await loadGameData() 再 render，本组件内无需门控，所有同步
 *   getter（getChapterById 等）在首次渲染即安全。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import type { PageBlock, PageId, WebPage } from '@/types'
import { getPage } from '@/data/loader'
import { useChapter } from '@/engine/hooks/useChapter'
import { PageBlockView } from '@/ui/PageBlockView'
import { sitePageUrl } from './sitePage'

type ViewState =
  | { kind: 'loading' }
  | { kind: 'notfound' }
  | { kind: 'page'; page: WebPage }
  | { kind: 'source'; page: WebPage }

export default function SiteView(): JSX.Element {
  const params = useParams<{ siteId: string; pageId: string }>()
  const pageId = params.pageId as PageId | undefined
  const chapter = useChapter()

  const [view, setView] = useState<ViewState>({ kind: 'loading' })

  // 加载 pageId 对应页面 + 首访触发 onViewEffects。
  const loadAndRender = useCallback(async (pid: PageId) => {
    try {
      const page = await getPage(pid)
      if (!page) { setView({ kind: 'notfound' }); return }
      setView({ kind: 'page', page })
      // 首访触发 onViewEffects（ch-2 推进 / 经费报告四件套：倒计时+威胁短信+刀哥门铃+心跳）
      chapter.visitPage(page.id)
    } catch {
      setView({ kind: 'notfound' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!pageId) return
    setView({ kind: 'loading' })
    void loadAndRender(pageId)
  }, [pageId, loadAndRender])

  // 站内导航：pushState 更新 hash（触发 useParams 重读 → 重新加载），不整页刷新。
  const navigateInSite = useCallback((targetPageId: PageId) => {
    const siteId = params.siteId
    if (!siteId) return
    const url = sitePageUrl(targetPageId) ?? `#/site/${siteId}/${targetPageId}`
    // sitePageUrl 返回 BASE_URL + hash；pushState 用 hash 段
    const hashPart = url.includes('#') ? url.slice(url.indexOf('#')) : url
    window.history.pushState(null, '', hashPart)
    // pushState 不触发 react-router 重渲染，手动 dispatch popstate
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [params.siteId])

  const onViewSource = useCallback(() => {
    setView((v) => (v.kind === 'page' ? { kind: 'source', page: v.page } : v))
  }, [])

  const onBackToPage = useCallback(() => {
    setView((v) => (v.kind === 'source' ? { kind: 'page', page: v.page } : v))
  }, [])

  if (view.kind === 'loading') {
    return <div style={centerStyle}>加载中…</div>
  }
  if (view.kind === 'notfound') {
    return (
      <div style={centerStyle}>
        <h2>页面不存在</h2>
        <SiteChromeBar url={pageId ?? ''} />
      </div>
    )
  }

  const page = view.page
  return (
    <div style={siteShellStyle}>
      <SiteChromeBar url={page.url} title={page.title} />
      <main style={mainStyle}>
        {view.kind === 'source' ? (
          <SourceView page={page} onBack={onBackToPage} onNavigatePage={navigateInSite} />
        ) : (
          <article className="web-page" data-page-id={page.id}>
            <div className="web-page__blocks">
              {page.blocks.map((block: PageBlock, i) => (
                <PageBlockView
                  key={i}
                  block={block}
                  onNavigatePage={navigateInSite}
                  onViewSource={onViewSource}
                />
              ))}
            </div>
          </article>
        )}
      </main>
    </div>
  )
}

/* ---------- 极简站点头部（非伪浏览器 chrome，仅显示标题+URL+返回手机） ---------- */
function SiteChromeBar({ url, title }: { url: string; title?: string }): JSX.Element {
  return (
    <header style={chromeStyle}>
      <span style={{ fontSize: 13, color: '#5a6473', marginRight: 8 }}>{title ?? ''}</span>
      <span style={{ fontSize: 12, color: '#8a94a3', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
      <button type="button" style={closeBtnStyle} onClick={() => window.close()}>
        ×
      </button>
    </header>
  )
}

/* ---------- 查看源代码视图（藏后台地址线索的 sourceComment 展示，linkPageId 可点进入） ---------- */
function SourceView({
  page,
  onBack,
  onNavigatePage,
}: {
  page: WebPage
  onBack: () => void
  onNavigatePage: (pageId: PageId) => void
}): JSX.Element {
  const comments = useMemo(
    () =>
      page.blocks.filter(
        (b): b is Extract<PageBlock, { type: 'sourceComment' }> => b.type === 'sourceComment',
      ),
    [page],
  )
  return (
    <div className="web-page__source">
      <div className="web-page__source-head">
        <span>查看源代码 — {page.url}</span>
        <button type="button" className="web-page__source-close" onClick={onBack}>返回页面</button>
      </div>
      <pre className="web-page__source-pre"><code>{`<!doctype html><head><title>${page.title}</title></head><body>`}</code></pre>
      {comments.length === 0 ? (
        <p className="web-page__source-empty">本页源码中未发现特殊注释。</p>
      ) : (
        comments.map((c, i) => (
          <div key={i}>
            <pre className="web-page__source-pre"><code>{c.comment}</code></pre>
            {c.linkPageId && (
              <button
                type="button"
                className="wc-article-link-btn"
                style={{ margin: '8px 0 16px', padding: '6px 14px', background: '#1f6feb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                onClick={() => onNavigatePage(c.linkPageId!)}
              >
                发现隐藏入口，点此进入 ›
              </button>
            )}
          </div>
        ))
      )}
    </div>
  )
}

/* ---------- styles ---------- */
const siteShellStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f4f6f8',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  color: '#1f2733',
}
const mainStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: '0 auto',
  padding: '24px 20px 64px',
}
const centerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  fontFamily: 'system-ui, sans-serif',
  color: '#5a6473',
}
const chromeStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 16px',
  background: '#1f2733',
  borderBottom: '1px solid #141922',
}
const closeBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 14,
  border: 'none',
  background: 'transparent',
  color: '#9aa6b5',
  fontSize: 18,
  cursor: 'pointer',
}

