/**
 * site-lvzhong —— 湖南绿草中学 官方网站。
 *
 * 一个普通的中国中学校园门户：顶部校徽 banner + 主导航（首页/通知公告/学校简介/
 * 校园新闻/教学科研/德育之窗/校园风光/校长信箱）+ 内容区 + 页脚。站内有一个隐藏的
 * 校务内部系统登录入口（路由 notice/screening/qiangzhang），登录后揭示合作协议、
 * 心理筛查名单 PDF、校长通讯录、宿舍巡查记录四个内部页。
 *
 * 边界约束：仅 import react、react-router、@/sites/shared 子目录、@/types、本目录。
 * 不碰 @/engine、@/game、@/data/loader、@/ui、@/utils、src/apps。
 *
 * 站点根挂在宿主 HashRouter 的 /site/site-lvzhong/ 星号路由下；本组件用相对路径的
 * Routes 做站内导航。页面内容由 getPageContent(pageId) 异步取自浏览器页面 JSON。
 */
import { useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { Link, Routes, Route, useNavigate } from 'react-router'
import { getPageContent, type SitePage } from '@/sites/shared/pageContent'
import { PlaceholderImage, PlaceholderPdf } from '@/sites/shared/placeholder'
import { checkLogin } from '@/sites/shared/answerCheck'
import { reportPageViewed, reportPuzzleSolved } from '@/sites/shared/gameEvent'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import type { PageBlock, PageId } from '@/types'
import { pageIdBySlug, slugByPageId } from './manifest'
import './site.css'

export const siteId = 'site-lvzhong'

/** 全站登录态（会话级内存，不落盘）。登录成功后置 true，揭示后台页。 */
const LoginCtx = {
  listeners: new Set<() => void>(),
  value: false,
  get(): boolean {
    return this.value
  },
  set(v: boolean): void {
    this.value = v
    this.listeners.forEach((l) => l())
  },
  subscribe(l: () => void): () => void {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  },
}

/** useLoggedIn：订阅会话登录态。 */
function useLoggedIn(): boolean {
  const [loggedIn, setLoggedIn] = useState(LoginCtx.get())
  useEffect(() => LoginCtx.subscribe(() => setLoggedIn(LoginCtx.get())), [])
  return loggedIn
}

export default function LvzhongSite(): ReactElement {
  return (
    <div className="lv-root">
      <SiteHeader />
      <SiteNav />
      <main className="lv-main">
        <Routes>
          <Route index element={<PageFrame slug="" />} />
          <Route path="notice" element={<PageFrame slug="notice" />} />
          <Route path="notice/screening" element={<PageFrame slug="notice/screening" />} />
          <Route path="notice/screening/qiangzhang" element={<PageFrame slug="notice/screening/qiangzhang" />} />
          <Route path="notice/vacation" element={<PageFrame slug="notice/vacation" />} />
          <Route path="notice/phone" element={<PageFrame slug="notice/phone" />} />
          <Route path="notice/signing" element={<PageFrame slug="notice/signing" />} />
          <Route path="notice/annual2025" element={<PageFrame slug="notice/annual2025" />} />
          <Route path="intro" element={<PageFrame slug="intro" />} />
          <Route path="news" element={<PageFrame slug="news" />} />
          <Route path="news/psych" element={<PageFrame slug="news/psych" />} />
          <Route path="news/coop" element={<PageFrame slug="news/coop" />} />
          <Route path="news/visit" element={<PageFrame slug="news/visit" />} />
          <Route path="teaching" element={<PageFrame slug="teaching" />} />
          <Route path="moral" element={<PageFrame slug="moral" />} />
          <Route path="gallery" element={<PageFrame slug="gallery" />} />
          <Route path="mailbox" element={<PageFrame slug="mailbox" />} />
          <Route path="contact" element={<AdminGuard slug="contact" />} />
          <Route path="agreement" element={<AdminGuard slug="agreement" />} />
          <Route path="screening-pdf" element={<AdminGuard slug="screening-pdf" />} />
          <Route path="patrol" element={<AdminGuard slug="patrol" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <SiteFooter />
    </div>
  )
}

/* ============================== 布局 ============================== */

function SiteHeader(): ReactElement {
  return (
    <div className="lv-topbar">
      <div className="lv-topbar-inner">
        <div className="lv-logo-mark" aria-hidden>绿</div>
        <div>
          <div className="lv-school-name">湖南绿草中学</div>
          <div className="lv-school-sub">厚德博学 · 追求卓越 · 湖南省长沙市示范性普通高级中学</div>
        </div>
      </div>
    </div>
  )
}

const NAV_ITEMS: Array<{ label: string; slug: string }> = [
  { label: '首页', slug: '' },
  { label: '通知公告', slug: 'notice' },
  { label: '学校简介', slug: 'intro' },
  { label: '校园新闻', slug: 'news' },
  { label: '教学科研', slug: 'teaching' },
  { label: '德育之窗', slug: 'moral' },
  { label: '校园风光', slug: 'gallery' },
  { label: '校长信箱', slug: 'mailbox' },
]

function SiteNav(): ReactElement {
  const base = useSiteBase()
  return (
    <nav className="lv-nav">
      <div className="lv-nav-inner">
        {NAV_ITEMS.map((it) => (
          <Link key={it.slug || 'home'} to={sitePath(base, it.slug)}>
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

function SiteFooter(): ReactElement {
  return (
    <footer className="lv-footer">
      <div>湖南绿草中学 · 地址：湖南省长沙市岳麓区麓山南路389号 · 邮编：410006</div>
      <div>电话：0731-88661234 · 邮箱：office@lvzhong-edu.cn</div>
      <div>© 2026 绿草中学 版权所有 · 湘ICP备2024013579号 · 湘公网安备43010302001188号</div>
    </footer>
  )
}

/* ============================== 页面框架 ============================== */

/**
 * 普通公开页框架：取页面内容，渲染面包屑 + 卡片正文。
 * 渲染所有块类型；sourceComment 块默认不渲染，提供「查看页面源码」入口。
 */
function PageFrame({ slug }: { slug: string }): ReactElement {
  const pageId = pageIdBySlug.get(slug)
  const [page, setPage] = useState<SitePage | null | undefined>(undefined)

  useEffect(() => {
    if (!pageId) return
    setPage(undefined)
    void getPageContent(pageId).then((p) => setPage(p))
  }, [pageId])

  // 上报页面浏览（游戏侧按 pageId 归档证据等；幂等）
  useEffect(() => {
    if (page) reportPageViewed(page.id)
  }, [page])

  if (page === undefined) return <div className="lv-loading">加载中…</div>
  if (page === null) return <NotFound />
  return <PageBody page={page} />
}

/**
 * 后台页守卫：需登录校务内部系统。未登录显示登录提示卡，已登录显示正文。
 */
function AdminGuard({ slug }: { slug: string }): ReactElement {
  const loggedIn = useLoggedIn()
  const pageId = pageIdBySlug.get(slug)
  const [page, setPage] = useState<SitePage | null | undefined>(undefined)

  useEffect(() => {
    if (!pageId) return
    setPage(undefined)
    void getPageContent(pageId).then((p) => setPage(p))
  }, [pageId])

  // 上报页面浏览（协议页为关键证据归档点）
  useEffect(() => {
    if (page && loggedIn) reportPageViewed(page.id)
  }, [page, loggedIn])

  if (!loggedIn) return <LoginRequired />
  if (page === undefined) return <div className="lv-loading">加载中…</div>
  if (page === null) return <NotFound />
  return <PageBody page={page} isAdmin />
}

function PageBody({ page, isAdmin }: { page: SitePage; isAdmin?: boolean }): ReactElement {
  const sourceComments = useMemo(
    () => page.blocks.filter((b) => b.type === 'sourceComment') as Extract<PageBlock, { type: 'sourceComment' }>[],
    [page.blocks],
  )

  return (
    <>
      <Crumb page={page} />
      {isAdmin && <AdminBar />}
      <article className="lv-card">
        <div className="lv-card-pad">
          <PageBlocks page={page} />
        </div>
      </article>
      {sourceComments.length > 0 && <SourceViewer comments={sourceComments} />}
    </>
  )
}

/** 后台已登录提示条：列出口个内部页快捷入口。 */
function AdminBar(): ReactElement {
  const base = useSiteBase()
  return (
    <div className="lv-admin-bar">
      <span>校务内部系统 · 已登录（校长账号 zhangqiang）</span>
      <Link to={sitePath(base, 'agreement')}>合作协议</Link>
      <Link to={sitePath(base, 'screening-pdf')}>筛查名单PDF</Link>
      <Link to={sitePath(base, 'contact')}>校长通讯录</Link>
      <Link to={sitePath(base, 'patrol')}>宿舍巡查记录</Link>
    </div>
  )
}

function Crumb({ page }: { page: SitePage }): ReactElement {
  const base = useSiteBase()
  const segs = useMemo(() => breadcrumbFor(page.id), [page.id])
  return (
    <div className="lv-crumb">
      <Link to={base}>首页</Link>
      {segs.map((s, i) => {
        const targetSlug = slugByPageId.get(s.pageId) ?? ''
        return (
          <span key={i}>
            {' » '}
            {i === segs.length - 1 ? (
              <span>{s.label}</span>
            ) : (
              <Link to={sitePath(base, targetSlug)}>{s.label}</Link>
            )}
          </span>
        )
      })}
      <span className="lv-source-meta">{'  ·  '}{page.title.replace('绿草中学 — ', '')}</span>
    </div>
  )
}

function LoginRequired(): ReactElement {
  const base = useSiteBase()
  return (
    <div className="lv-card">
      <div className="lv-card-pad lv-notfound">
        <h2>需要登录校务内部系统</h2>
        <p>本页内容需以校长账号登录校务内部系统后查看。</p>
        <p>
          <Link to={sitePath(base, 'notice/screening/qiangzhang')}>
            前往登录页 ›
          </Link>
        </p>
      </div>
    </div>
  )
}

function NotFound(): ReactElement {
  const base = useSiteBase()
  return (
    <div className="lv-card">
      <div className="lv-card-pad lv-notfound">
        <h2>页面不存在</h2>
        <p>您访问的页面不存在或已被移除。</p>
        <p>
          <Link to={base}>返回首页 ›</Link>
        </p>
      </div>
    </div>
  )
}

/* ============================== 块渲染器 ============================== */

/**
 * 站内导航链接目标统一用 sitePath(base, targetSlug) → 绝对站点路径
 * /site/site-lvzhong/\<slug\>，避免孤立 Routes 的相对 to 解析累积成
 * /list/list（见 src/sites/shared/siteNav.ts）。原 relPathFromHere 相对
 * 修正逻辑已不再需要。
 */

/** PageBlocks：渲染页面所有非 sourceComment 块。 */
function PageBlocks({ page }: { page: SitePage }): ReactElement {
  const base = useSiteBase()
  return (
    <>
      {page.blocks.map((b, i) => {
        if (b.type === 'sourceComment') return null
        return (
          <BlockView
            key={i}
            block={b}
            base={base}
            loginTokens={page.loginTokens}
            pageId={page.id}
          />
        )
      })}
    </>
  )
}

function BlockView({
  block,
  base,
  loginTokens,
  pageId,
}: {
  block: PageBlock
  base: string
  loginTokens?: string[]
  pageId: PageId
}): ReactElement | null {
  switch (block.type) {
    case 'hero':
      return <HeroBlock heading={block.heading} subheading={block.subheading} imageAssetId={block.imageAssetId} />
    case 'nav':
      return (
        <div className="lv-page-nav">
          {block.links.map((l, i) => (
            <Link key={i} to={sitePath(base, slugByPageId.get(l.pageId) ?? '')}>
              {l.label}
            </Link>
          ))}
        </div>
      )
    case 'articleList':
      return (
        <ul className="lv-article-list">
          {block.items.map((it, i) => (
            <li key={i}>
              <Link to={sitePath(base, slugByPageId.get(it.pageId) ?? '')}>
                <span className="lv-al-title">{it.title}</span>
                {it.date && <time className="lv-al-date">{it.date}</time>}
              </Link>
            </li>
          ))}
        </ul>
      )
    case 'paragraph':
      return <p className="lv-para">{block.text}</p>
    case 'callout': {
      const info = parseCalloutTitle(block.text)
      if (info.isTitle) {
        return <div className="lv-callout is-title">{info.body}</div>
      }
      return (
        <div className={`lv-callout lv-callout-${block.variant}`}>
          {info.title && <div className="lv-callout-title">{info.title}</div>}
          <div>{info.body}</div>
        </div>
      )
    }
    case 'image':
      return <ImageBlock assetId={block.assetId} caption={block.caption} zoomable={block.zoomable} />
    case 'table':
      return (
        <div className="lv-table-wrap">
          <table className="lv-table">
            <thead>
              <tr>
                {block.headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'form':
      return <FormBlock formId={block.formId} onSubmitMessage={block.onSubmitMessage} />
    case 'loginForm':
      return <LoginFormBlock loginTokens={loginTokens} />
    case 'pdfViewer':
      // 加密筛查名单 PDF：在 screening-pdf 页把占位换成「输 0312 → 下载真 PDF」
      // 的第二道密码层（第一道是 AdminGuard 的 zhangqiang 登录）。其余页用占位。
      if (pageId === 'page-lvzhong-screening-pdf') {
        return <EncryptedPdfDownload assetId={block.assetId} />
      }
      return (
        <div className="lv-pdf-wrap">
          <PlaceholderPdf assetId={block.assetId} style={{ width: '100%' }} />
          <p className="lv-source-meta" style={{ marginTop: 8 }}>
            PDF 文档标识：{block.assetId}
          </p>
        </div>
      )
    case 'sourceComment':
      // 主正文不渲染源码注释，由 SourceViewer 统一展示。
      return null
    default:
      return null
  }
}

/* ---------- hero ---------- */
function HeroBlock({
  heading,
  subheading,
  imageAssetId,
}: {
  heading: string
  subheading?: string
  imageAssetId?: string
}): ReactElement {
  return (
    <header className="lv-hero">
      {imageAssetId && (
        <PlaceholderImage
          assetId={imageAssetId}
          alt={heading}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45 }}
        />
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h1>{heading}</h1>
        {subheading && <p className="lv-hero-sub">{subheading}</p>}
      </div>
    </header>
  )
}

/* ---------- image（支持 zoom） ---------- */
function ImageBlock({ assetId, caption, zoomable }: { assetId: string; caption?: string; zoomable?: boolean }): ReactElement {
  const [zoom, setZoom] = useState(false)
  return (
    <figure className="lv-figure">
      <div
        onClick={zoomable ? () => setZoom(true) : undefined}
        style={zoomable ? { cursor: 'zoom-in' } : undefined}
      >
        <PlaceholderImage assetId={assetId} alt={caption ?? ''} style={{ maxWidth: '100%' }} />
      </div>
      {caption && <figcaption>{caption}</figcaption>}
      {zoom && zoomable && (
        <div className="lv-zoom-overlay" onClick={() => setZoom(false)} role="button" tabIndex={0}>
          <PlaceholderImage assetId={assetId} alt={caption ?? ''} style={{ maxWidth: '92vw', maxHeight: '90vh' }} />
          {caption && <div className="lv-zoom-caption">{caption}</div>}
        </div>
      )}
    </figure>
  )
}

/* ---------- form（校长信箱） ---------- */
function FormBlock({ formId, onSubmitMessage }: { formId: string; onSubmitMessage: string }): ReactElement {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [body, setBody] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function submit(e: React.FormEvent): void {
    e.preventDefault()
    // 校园门户表单：纯前端伪造，无后端。提交即显示成功提示。
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="lv-form">
        <div className="lv-form-msg lv-form-msg-ok">{onSubmitMessage}</div>
        <button type="button" className="lv-btn" onClick={() => setSubmitted(false)}>
          再写一封
        </button>
      </div>
    )
  }
  return (
    <form className="lv-form" onSubmit={submit} aria-label={formId}>
      <div className="lv-form-field">
        <label htmlFor={`${formId}-name`}>姓名</label>
        <input id={`${formId}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入姓名" />
      </div>
      <div className="lv-form-field">
        <label htmlFor={`${formId}-contact`}>联系方式（选填）</label>
        <input id={`${formId}-contact`} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="手机或邮箱" />
      </div>
      <div className="lv-form-field">
        <label htmlFor={`${formId}-body`}>留言内容</label>
        <textarea id={`${formId}-body`} value={body} onChange={(e) => setBody(e.target.value)} placeholder="请输入您要反映的问题或建议……" required />
      </div>
      <button type="submit" className="lv-btn" disabled={!body.trim()}>
        提交留言
      </button>
    </form>
  )
}

/* ---------- 登录表单（校务内部系统） ---------- */
function LoginFormBlock({ loginTokens }: { loginTokens?: string[] }): ReactElement {
  const navigate = useNavigate()
  const base = useSiteBase()
  const [account, setAccount] = useState('zhangqiang')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const token = loginTokens?.[0] ?? 'puzzle-lvzhong-internal'

  function submit(e: React.FormEvent): void {
    e.preventDefault()
    if (account.trim() !== 'zhangqiang') {
      setError('账号不正确，本系统仅限校长账号登录。')
      return
    }
    const ok = checkLogin(token, password)
    if (ok) {
      LoginCtx.set(true)
      setError(null)
      // 上报校务系统登录已解（幂等）。
      reportPuzzleSolved('puzzle-lvzhong-internal')
      // 登录成功跳到协议页（后台首页）。用绝对站点路径，避免相对解析累积。
      navigate(sitePath(base, 'agreement'))
    } else {
      setError('密码错误，请重试。')
    }
  }

  return (
    <div className="lv-login-box">
      <form className="lv-form" onSubmit={submit} style={{ margin: 0 }}>
        <div className="lv-form-field">
          <label htmlFor="lv-login-account">账号</label>
          <input id="lv-login-account" value={account} onChange={(e) => setAccount(e.target.value)} autoComplete="username" />
        </div>
        <div className="lv-form-field">
          <label htmlFor="lv-login-pwd">密码</label>
          <input id="lv-login-pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="请输入密码" required />
        </div>
        <button type="submit" className="lv-btn" disabled={!password.trim()}>
          登录校务系统
        </button>
        {error && <div className="lv-form-msg lv-form-msg-err" style={{ marginTop: 12 }}>{error}</div>}
      </form>
    </div>
  )
}

/* ---------- 加密筛查名单 PDF（第二道密码：0312） ----------
 * AdminGuard 已用 zhangqiang 登录守卫本页；此处是页内第二道——
 * 输入合同号后4位 0312 校验通过后下载真实 PDF。
 * checkLogin 复用 qiangzhang 登录页同款 import（answer 在 puzzles.json）。
 */
const SCREENING_PDF_PUZZLE_ID = 'puzzle-pdf-screening'

function EncryptedPdfDownload({ assetId }: { assetId: string }): ReactElement {
  const [password, setPassword] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent): void {
    e.preventDefault()
    if (checkLogin(SCREENING_PDF_PUZZLE_ID, password)) {
      reportPuzzleSolved(SCREENING_PDF_PUZZLE_ID)
      setUnlocked(true)
      setError(null)
    } else {
      setError('密码错误，请重试。')
    }
  }

  // BASE_URL 必须原样出现（CLAUDE.md §2）；asset 文件名固定 pdf-screening-list.pdf。
  const href = `${import.meta.env.BASE_URL}assets/pdf-screening-list.pdf`

  if (unlocked) {
    return (
      <div className="lv-pdf-wrap">
        <div className="lv-form-msg lv-form-msg-ok">
          密码正确，心理筛查名单 PDF 已解密。
        </div>
        <p style={{ marginTop: 12 }}>
          <a href={href} download="pdf-screening-list.pdf" className="lv-btn">
            下载心理筛查名单PDF
          </a>
        </p>
        <p className="lv-source-meta" style={{ marginTop: 8 }}>
          PDF 文档标识：{assetId}
        </p>
      </div>
    )
  }

  return (
    <div className="lv-pdf-wrap">
      <form className="lv-form" onSubmit={submit} style={{ margin: 0 }}>
        <div className="lv-form-field">
          <label htmlFor="lv-screening-pdf-pwd">加密PDF密码</label>
          <input
            id="lv-screening-pdf-pwd"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="请输入合同号后4位"
            required
          />
        </div>
        <button type="submit" className="lv-btn" disabled={!password.trim()}>
          解密并下载
        </button>
        {error && (
          <div className="lv-form-msg lv-form-msg-err" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </form>
      <p className="lv-source-meta" style={{ marginTop: 8 }}>
        PDF 文档标识：{assetId}
      </p>
    </div>
  )
}

/* ---------- 源码注释查看器 ---------- */
function SourceViewer({
  comments,
}: {
  comments: Array<Extract<PageBlock, { type: 'sourceComment' }>>
}): ReactElement {
  const base = useSiteBase()
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" className="lv-source-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '收起页面源码' : '查看页面源码'}
      </button>
      {open && (
        <div>
          {comments.map((c, i) => {
            const display = stripHtmlCommentWrapper(c.comment)
            const targetSlug = c.linkPageId != null ? slugByPageId.get(c.linkPageId as PageId) : undefined
            return (
              <div key={i} className="lv-source-box">
                <div className="lv-source-meta">HTML 源码注释 #{i + 1}</div>
                {display}
                {targetSlug != null && (
                  <div style={{ marginTop: 10 }}>
                    <Link to={sitePath(base, targetSlug)}>
                      [访问注释中的链接页]
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ============================== 工具函数 ============================== */

/** callout 文本里若有「【xxx】」前缀，拆成标题+正文；前缀即标题时整段作标题型 callout。 */
function parseCalloutTitle(text: string): { isTitle: boolean; title?: string; body: string } {
  const m = text.match(/^【([^】]+)】([\s\S]*)?$/)
  if (m) {
    const title = m[1]
    const body = (m[2] ?? '').trim()
    // 只有标题、无后续正文 → 整段当标题型 callout（如「通知公告」「学校简介」）。
    if (!body) return { isTitle: true, body: title }
    return { isTitle: false, title, body: text }
  }
  return { isTitle: false, body: text }
}

/** 去掉 HTML 注释包裹（显示用）。 */
function stripHtmlCommentWrapper(comment: string): string {
  let s = comment.trim()
  if (s.startsWith('<!--')) s = s.slice(4)
  if (s.endsWith('-->')) s = s.slice(0, -3)
  return s.trim()
}

/** 面包屑：按页 id 生成层级标签。 */
function breadcrumbFor(pageId: PageId): Array<{ label: string; pageId: PageId }> {
  const map: Record<string, Array<{ label: string; pageId: PageId }>> = {
    'page-lvzhong-home': [],
    'page-lvzhong-intro': [{ label: '首页', pageId: 'page-lvzhong-home' }, { label: '学校简介', pageId: 'page-lvzhong-intro' }],
    'page-lvzhong-notice': [{ label: '通知公告', pageId: 'page-lvzhong-notice' }],
    'page-lvzhong-notice-screening': [
      { label: '通知公告', pageId: 'page-lvzhong-notice' },
      { label: '心理筛查通知', pageId: 'page-lvzhong-notice-screening' },
    ],
    'page-lvzhong-notice-vacation': [
      { label: '通知公告', pageId: 'page-lvzhong-notice' },
      { label: '春季放假安排', pageId: 'page-lvzhong-notice-vacation' },
    ],
    'page-lvzhong-notice-phone': [
      { label: '通知公告', pageId: 'page-lvzhong-notice' },
      { label: '严禁电子产品通知', pageId: 'page-lvzhong-notice-phone' },
    ],
    'page-lvzhong-notice-signing': [
      { label: '通知公告', pageId: 'page-lvzhong-notice' },
      { label: '合作签约仪式公告', pageId: 'page-lvzhong-notice-signing' },
    ],
    'page-lvzhong-notice-annual2025': [
      { label: '通知公告', pageId: 'page-lvzhong-notice' },
      { label: '2025年度工作总结', pageId: 'page-lvzhong-notice-annual2025' },
    ],
    'page-lvzhong-news': [{ label: '校园新闻', pageId: 'page-lvzhong-news' }],
    'page-lvzhong-news-psych': [
      { label: '校园新闻', pageId: 'page-lvzhong-news' },
      { label: '心理教育讲座', pageId: 'page-lvzhong-news-psych' },
    ],
    'page-lvzhong-news-coop': [
      { label: '校园新闻', pageId: 'page-lvzhong-news' },
      { label: '新希望合作', pageId: 'page-lvzhong-news-coop' },
    ],
    'page-lvzhong-news-visit': [
      { label: '校园新闻', pageId: 'page-lvzhong-news' },
      { label: '参观山河实验室', pageId: 'page-lvzhong-news-visit' },
    ],
    'page-lvzhong-teaching': [{ label: '教学科研', pageId: 'page-lvzhong-teaching' }],
    'page-lvzhong-moral': [{ label: '德育之窗', pageId: 'page-lvzhong-moral' }],
    'page-lvzhong-gallery': [{ label: '校园风光', pageId: 'page-lvzhong-gallery' }],
    'page-lvzhong-principal-mailbox': [{ label: '校长信箱', pageId: 'page-lvzhong-principal-mailbox' }],
    'page-lvzhong-qiangzhang': [
      { label: '通知公告', pageId: 'page-lvzhong-notice' },
      { label: '心理筛查通知', pageId: 'page-lvzhong-notice-screening' },
      { label: '内部系统登录', pageId: 'page-lvzhong-qiangzhang' },
    ],
    'page-lvzhong-agreement': [
      { label: '校务内部系统', pageId: 'page-lvzhong-qiangzhang' },
      { label: '合作协议', pageId: 'page-lvzhong-agreement' },
    ],
    'page-lvzhong-screening-pdf': [
      { label: '校务内部系统', pageId: 'page-lvzhong-qiangzhang' },
      { label: '筛查名单PDF', pageId: 'page-lvzhong-screening-pdf' },
    ],
    'page-lvzhong-contact': [
      { label: '校务内部系统', pageId: 'page-lvzhong-qiangzhang' },
      { label: '校长通讯录', pageId: 'page-lvzhong-contact' },
    ],
    'page-lvzhong-patrol': [
      { label: '校务内部系统', pageId: 'page-lvzhong-qiangzhang' },
      { label: '宿舍巡查记录', pageId: 'page-lvzhong-patrol' },
    ],
  }
  return map[pageId] ?? []
}
