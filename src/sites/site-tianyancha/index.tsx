/**
 * site-tianyancha —— 仿天眼查 企业工商信息查询站。
 *
 * 两页内容（经 getPageContent 取自 public/data/browser/pages/）:
 *  - page-tianyancha       新希望成长中心工商信息（public，本站默认落地页）
 *  - page-tianyancha-chen  陈建国关联企业（仅从 page-tianyancha 的关联企业链入）
 *
 * 无 loginForm block —— 本站无后台，无任何访问门控。
 *
 * 站点根挂在 /site/site-tianyancha/星号 下。站内用相对 <Routes>（react-router 路由匹配
 * 正常），但**导航链接/重定向用绝对站点路径**（sitePath(base, ...)），避免孤立 Routes
 * 的 <Link to> 相对解析累积成 /company/company。<Route path="..."> 保持相对不变。
 *
 * 边界（强制）: 仅 import react / react-router / @/sites/shared 子目录 / @/types / 本目录。
 * 严禁 import @/engine、@/game、@/data/loader、@/ui、@/utils、src/apps、@/sites/sitePage。
 */
import { useEffect, useState, type CSSProperties, type ReactElement } from 'react'
import { Routes, Route, useParams, Link, Navigate } from 'react-router'
import { getPageContent, type SitePage } from '@/sites/shared/pageContent'
import { PlaceholderImage } from '@/sites/shared/placeholder'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import type { PageBlock } from '@/types'
import { manifest } from './manifest'

export const siteId = manifest.siteId

/** 本站所有页面 id → 对应站内相对路径（源自 manifest，站内导航仅在此表内跳转）。 */
const PAGE_ROUTES: Record<string, string> = Object.fromEntries(
  manifest.pageRoutes.map((r) => [r.pageId, r.path]),
)

export default function TianyanchaSite(): ReactElement {
  /**
   * 站点根挂在 /site/site-tianyancha/星号 下。站内用相对 <Routes>。
   * index（根）默认重定向到 company 落地页（page-tianyancha）。
   *
   * 导航链接/重定向用绝对站点路径（sitePath(base, ...)），避免孤立 Routes 的
   * <Link to> 相对解析累积成 /company/company。Route path 保持相对不变。
   */
  const base = useSiteBase()
  return (
    <div style={rootStyle}>
      <SiteHeader />
      <main style={mainStyle}>
        <Routes>
          <Route index element={<Navigate to={sitePath(base, 'company')} replace />} />
          <Route path="company" element={<PageView pageId="page-tianyancha" />} />
          <Route path="person/chen-jianguo" element={<PageView pageId="page-tianyancha-chen" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <SiteFooter />
    </div>
  )
}

/** 顶部导航条（天眼查式蓝色头 + 搜索框占位）。 */
function SiteHeader(): ReactElement {
  const base = useSiteBase()
  return (
    <header style={headerStyle}>
      <div style={headerInnerStyle}>
        <Link to={sitePath(base, 'company')} style={logoLinkStyle}>
          <span style={logoMarkStyle}>眼</span>
          <span style={logoTextStyle}>天眼查</span>
        </Link>
        <div style={searchBorderStyle}>
          <span style={searchIconStyle} aria-hidden>
            🔍
          </span>
          <input
            style={searchInputStyle}
            placeholder="查企业 / 查老板 / 查关系"
            aria-label="搜索"
            readOnly
          />
          <button type="button" style={searchBtnStyle} tabIndex={-1}>
            查一下
          </button>
        </div>
        <nav style={topNavStyle}>
          <span>首页</span>
          <span>APP下载</span>
          <span>登录</span>
        </nav>
      </div>
    </header>
  )
}

function SiteFooter(): ReactElement {
  return (
    <footer style={footerStyle}>
      <div>天眼查 · 企业工商信息查询平台</div>
      <div style={{ marginTop: 4 }}>数据来源：公开工商登记信息</div>
    </footer>
  )
}

/** 取单页并按本站视觉身份渲染其 blocks。 */
function PageView({ pageId }: { pageId: string }): ReactElement {
  const [page, setPage] = useState<SitePage | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    setLoading(true)
    void getPageContent(pageId).then((p) => {
      if (!alive) return
      setPage(p)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [pageId])

  if (loading) {
    return <div style={loadingStyle}>加载中…</div>
  }
  if (!page) {
    return <NotFound />
  }
  return <CompanyPageBody page={page} />
}

/** 单页正文: 面包屑 + 标题卡 + 块渲染。 */
function CompanyPageBody({ page }: { page: SitePage }): ReactElement {
  // 页面跳转目标 pageId 列表（用于 nav 等 block 的站内跳转）
  return (
    <div>
      <Breadcrumbs page={page} />
      <h1 style={pageTitleStyle}>{page.title}</h1>
      {page.blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
      <RelatedLinks currentPageId={page.id} />
    </div>
  )
}

/** 面包屑: 首页 > 当前页。 */
function Breadcrumbs({ page }: { page: SitePage }): ReactElement {
  const base = useSiteBase()
  return (
    <div style={breadcrumbStyle}>
      <Link to={sitePath(base, 'company')} style={breadcrumbLinkStyle}>
        首页
      </Link>
      <span style={breadcrumbSepStyle}>›</span>
      <span>{page.title.replace(/^天眼查 — /, '')}</span>
    </div>
  )
}

/** 页底同站关联页跳转（page-tianyancha ↔ page-tianyancha-chen）。 */
function RelatedLinks({ currentPageId }: { currentPageId: string }): ReactElement {
  const base = useSiteBase()
  const others = Object.entries(PAGE_ROUTES).filter(([pid]) => pid !== currentPageId)
  if (others.length === 0) return <></>
  return (
    <div style={relatedBoxStyle}>
      <div style={relatedTitleStyle}>相关结果</div>
      <ul style={relatedListStyle}>
        {others.map(([pid, route]) => (
          <li key={pid}>
            <Link to={sitePath(base, route)} style={relatedLinkStyle}>
              {pid === 'page-tianyancha' ? '新希望成长中心 — 工商信息' : '陈建国 — 关联企业'}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function NotFound(): ReactElement {
  const params = useParams<{ siteId: string }>()
  return (
    <div style={notFoundStyle}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>404</div>
      <div>页面未找到</div>
      {params.siteId && <div style={{ fontSize: 12, color: '#8b949e', marginTop: 6 }}>{params.siteId}</div>}
    </div>
  )
}

/** block 渲染器（按本站天眼查视觉身份本真呈现）。 */
function BlockView({ block }: { block: PageBlock }): ReactElement | null {
  const base = useSiteBase()
  switch (block.type) {
    case 'hero':
      return (
        <section style={heroStyle}>
          {block.imageAssetId && (
            <PlaceholderImage assetId={block.imageAssetId} alt={block.heading} style={heroImgStyle} />
          )}
          <h2 style={heroHeadingStyle}>{block.heading}</h2>
          {block.subheading && <p style={heroSubStyle}>{block.subheading}</p>}
        </section>
      )
    case 'paragraph':
      return <p style={paraStyle}>{block.text}</p>
    case 'callout': {
      const variant = block.variant
      const tone = calloutTone(variant)
      return (
        <div style={{ ...calloutBaseStyle, ...tone }}>
          <span style={{ fontWeight: 700, marginRight: 8 }}>{tone.label}</span>
          {block.text}
        </div>
      )
    }
    case 'image':
      return (
        <figure style={imageFigureStyle}>
          <PlaceholderImage
            assetId={block.assetId}
            alt={block.caption ?? block.assetId}
            caption={block.caption}
            style={imageStyle}
          />
          {block.caption && <figcaption style={imageCaptionStyle}>{block.caption}</figcaption>}
        </figure>
      )
    case 'table':
      return <DataTable headers={block.headers} rows={block.rows} />
    case 'nav':
      return <NavBlock links={block.links} />
    case 'articleList':
      return <ArticleListBlock items={block.items} />
    case 'form':
      return <FormBlock formId={block.formId} onSubmitMessage={block.onSubmitMessage} />
    case 'sourceComment':
      return (
        <div style={sourceCommentStyle}>
          <span style={{ color: '#8b949e' }}>来源备注：</span>
          {block.comment}
          {block.linkPageId && (
            <>
              {' '}
              <Link to={sitePath(base, routeForPage(block.linkPageId))} style={sourceLinkStyle}>
                查看来源页
              </Link>
            </>
          )}
        </div>
      )
    case 'pdfViewer':
      return (
        <div style={pdfBoxStyle}>
          <div style={{ marginBottom: 8, color: '#5a6473' }}>PDF 文档（{block.assetId}）</div>
          <PlaceholderImage assetId={block.assetId} alt={block.assetId} style={pdfPreviewStyle} />
        </div>
      )
    case 'loginForm':
      // 本站无 loginForm block；预留以防数据未来添加
      return null
    default:
      return null
  }
}

/** 工商信息表（天眼查式: 左列灰底字段名 + 右列值，首行表头深蓝）。 */
function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }): ReactElement {
  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        {headers.length > 0 && (
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={tableThStyle}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={ri % 2 === 0 ? tableRowEvenStyle : tableRowOddStyle}>
              {row.map((cell, ci) => (
                <td key={ci} style={ci === 0 ? tableTdLabelStyle : tableTdValueStyle}>
                  {renderCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 单元格内容: 对"陈建国""张强"等人名或企业名做轻度高亮。 */
function renderCell(text: string): ReactElement {
  const t = text
  const highlightKeywords = ['张强', '陈建国', '山河医科大学', '长沙新希望成长中心']
  const kw = highlightKeywords.find((k) => t.includes(k))
  if (!kw) return <>{t}</>
  const idx = t.indexOf(kw)
  return (
    <>
      {t.slice(0, idx)}
      <span style={cellHighlightStyle}>{kw}</span>
      {t.slice(idx + kw.length)}
    </>
  )
}

/** nav block: 站内跳转链接条。 */
function NavBlock({ links }: { links: Array<{ label: string; pageId: string }> }): ReactElement {
  const base = useSiteBase()
  return (
    <nav style={navBlockStyle}>
      {links.map((l, i) => (
        <Link key={i} to={sitePath(base, routeForPage(l.pageId))} style={navBlockLinkStyle}>
          {l.label}
        </Link>
      ))}
    </nav>
  )
}

/** articleList block: 同站其它文章列表。 */
function ArticleListBlock({
  items,
}: {
  items: Array<{ title: string; pageId: string; date?: string }>
}): ReactElement {
  const base = useSiteBase()
  return (
    <ul style={articleListStyle}>
      {items.map((it, i) => (
        <li key={i} style={articleListItemStyle}>
          <Link to={sitePath(base, routeForPage(it.pageId))} style={articleLinkStyle}>
            {it.title}
          </Link>
          {it.date && <span style={articleDateStyle}>{it.date}</span>}
        </li>
      ))}
    </ul>
  )
}

/** form block: 留言/举报类表单（本站未用，预留本真呈现）。 */
function FormBlock({ formId, onSubmitMessage }: { formId: string; onSubmitMessage: string }): ReactElement {
  const [submitted, setSubmitted] = useState(false)
  return (
    <div style={formBoxStyle}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setSubmitted(true)
        }}
      >
        <input style={formInputStyle} placeholder="请输入内容" aria-label={formId} />
        <button type="submit" style={formBtnStyle}>
          提交
        </button>
      </form>
      {submitted && <div style={formSubmittedStyle}>{onSubmitMessage}</div>}
    </div>
  )
}

/** 站内 pageId → 站内相对路径（本站两页可互跳）。返回相对段，由调用方经 sitePath 转绝对。 */
function routeForPage(pageId: string): string {
  if (PAGE_ROUTES[pageId]) return PAGE_ROUTES[pageId]
  // 未知 pageId 退回落地页，避免死链
  return 'company'
}

/** callout 颜色基调（info/warning/danger）。 */
function calloutTone(variant: 'info' | 'warning' | 'danger'): CSSProperties & { label: string } {
  switch (variant) {
    case 'danger':
      return {
        background: '#fff1f0',
        borderLeft: '4px solid #ff4d4f',
        color: '#a8071a',
        label: '风险提示',
      }
    case 'warning':
      return {
        background: '#fffbe6',
        borderLeft: '4px solid #faad14',
        color: '#874d00',
        label: '注意',
      }
    case 'info':
    default:
      return {
        background: '#e6f4ff',
        borderLeft: '4px solid #1677ff',
        color: '#0958d9',
        label: '提示',
      }
  }
}

// ===== 样式（天眼查式: 蓝白为主，企业信息卡式布局） =====

const rootStyle: CSSProperties = {
  width: '100%',
  minHeight: '100vh',
  background: '#f5f7fa',
  color: '#1f2329',
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif',
  display: 'flex',
  flexDirection: 'column',
}

const headerStyle: CSSProperties = {
  background: '#ffffff',
  borderBottom: '1px solid #e5e6eb',
  position: 'sticky',
  top: 0,
  zIndex: 10,
}
const headerInnerStyle: CSSProperties = {
  maxWidth: 1080,
  margin: '0 auto',
  padding: '12px 24px',
  display: 'flex',
  alignItems: 'center',
  gap: 24,
}
const logoLinkStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  textDecoration: 'none',
}
const logoMarkStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  background: '#1677ff',
  color: '#fff',
  fontWeight: 700,
  fontSize: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
const logoTextStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: 20,
  color: '#1677ff',
  letterSpacing: 1,
}
const searchBorderStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  border: '2px solid #1677ff',
  borderRadius: 4,
  overflow: 'hidden',
  background: '#fff',
  maxWidth: 560,
}
const searchIconStyle: CSSProperties = {
  paddingLeft: 12,
  paddingRight: 8,
  color: '#8b949e',
  fontSize: 14,
}
const searchInputStyle: CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  padding: '8px 4px',
  fontSize: 14,
  background: 'transparent',
  color: '#1f2329',
}
const searchBtnStyle: CSSProperties = {
  border: 'none',
  background: '#1677ff',
  color: '#fff',
  padding: '8px 18px',
  cursor: 'default',
  fontSize: 14,
}
const topNavStyle: CSSProperties = {
  display: 'flex',
  gap: 16,
  fontSize: 14,
  color: '#4e5969',
}

const mainStyle: CSSProperties = {
  maxWidth: 1080,
  width: '100%',
  margin: '0 auto',
  padding: '20px 24px 48px',
  flex: 1,
}

const loadingStyle: CSSProperties = {
  padding: 60,
  textAlign: 'center',
  color: '#8b949e',
  fontSize: 14,
}

const breadcrumbStyle: CSSProperties = {
  fontSize: 13,
  color: '#8b949e',
  marginBottom: 12,
}
const breadcrumbLinkStyle: CSSProperties = {
  color: '#1677ff',
  textDecoration: 'none',
}
const breadcrumbSepStyle: CSSProperties = { margin: '0 6px', color: '#c9cdd4' }

const pageTitleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: '#1f2329',
  margin: '0 0 16px',
  lineHeight: 1.4,
}

const heroStyle: CSSProperties = {
  background: '#fff',
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
  border: '1px solid #e5e6eb',
}
const heroImgStyle: CSSProperties = {
  width: '100%',
  maxHeight: 220,
  objectFit: 'cover',
  borderRadius: 6,
  marginBottom: 12,
}
const heroHeadingStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  margin: '0 0 6px',
  color: '#1f2329',
}
const heroSubStyle: CSSProperties = {
  fontSize: 14,
  color: '#4e5969',
  margin: 0,
}

const paraStyle: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.8,
  color: '#1f2329',
  margin: '12px 0',
  background: '#fff',
  padding: '12px 16px',
  borderRadius: 8,
  border: '1px solid #e5e6eb',
}

const calloutBaseStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  padding: '12px 16px',
  borderRadius: 6,
  margin: '12px 0',
  fontSize: 14,
  lineHeight: 1.7,
}

const imageFigureStyle: CSSProperties = {
  margin: '16px 0',
  background: '#fff',
  borderRadius: 8,
  border: '1px solid #e5e6eb',
  padding: 12,
}
const imageStyle: CSSProperties = {
  width: '100%',
  maxHeight: 360,
  objectFit: 'cover',
  borderRadius: 6,
}
const imageCaptionStyle: CSSProperties = {
  fontSize: 13,
  color: '#8b949e',
  marginTop: 8,
  textAlign: 'center',
}

const tableWrapStyle: CSSProperties = {
  background: '#fff',
  borderRadius: 8,
  border: '1px solid #e5e6eb',
  overflow: 'hidden',
  margin: '12px 0 16px',
}
const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 14,
}
const tableThStyle: CSSProperties = {
  background: '#1677ff',
  color: '#fff',
  textAlign: 'left',
  padding: '10px 16px',
  fontWeight: 600,
  fontSize: 14,
}
const tableRowEvenStyle: CSSProperties = { background: '#ffffff' }
const tableRowOddStyle: CSSProperties = { background: '#fafbfc' }
const tableTdLabelStyle: CSSProperties = {
  padding: '12px 16px',
  color: '#4e5969',
  background: '#f7f8fa',
  fontWeight: 500,
  width: '32%',
  verticalAlign: 'top',
  borderRight: '1px solid #f0f1f3',
}
const tableTdValueStyle: CSSProperties = {
  padding: '12px 16px',
  color: '#1f2329',
  verticalAlign: 'top',
}
const cellHighlightStyle: CSSProperties = {
  color: '#1677ff',
  fontWeight: 600,
}

const navBlockStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
  padding: '12px 0',
  fontSize: 14,
}
const navBlockLinkStyle: CSSProperties = {
  color: '#1677ff',
  textDecoration: 'none',
}

const articleListStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: '12px 0',
  background: '#fff',
  borderRadius: 8,
  border: '1px solid #e5e6eb',
}
const articleListItemStyle: CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid #f0f1f3',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}
const articleLinkStyle: CSSProperties = {
  color: '#1f2329',
  textDecoration: 'none',
  fontSize: 14,
}
const articleDateStyle: CSSProperties = {
  color: '#8b949e',
  fontSize: 12,
}

const formBoxStyle: CSSProperties = {
  margin: '12px 0',
  background: '#fff',
  borderRadius: 8,
  border: '1px solid #e5e6eb',
  padding: 16,
}
const formInputStyle: CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  border: '1px solid #e5e6eb',
  borderRadius: 4,
  fontSize: 14,
  marginRight: 8,
}
const formBtnStyle: CSSProperties = {
  border: 'none',
  background: '#1677ff',
  color: '#fff',
  padding: '8px 16px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 14,
}
const formSubmittedStyle: CSSProperties = {
  marginTop: 10,
  padding: '8px 12px',
  background: '#e6f4ff',
  color: '#0958d9',
  borderRadius: 4,
  fontSize: 13,
}

const sourceCommentStyle: CSSProperties = {
  fontSize: 12,
  color: '#8b949e',
  margin: '12px 0',
  padding: '8px 12px',
  background: '#f7f8fa',
  borderRadius: 4,
  borderLeft: '3px solid #c9cdd4',
}
const sourceLinkStyle: CSSProperties = {
  color: '#1677ff',
  textDecoration: 'none',
}

const pdfBoxStyle: CSSProperties = {
  margin: '12px 0',
  background: '#fff',
  borderRadius: 8,
  border: '1px solid #e5e6eb',
  padding: 16,
}
const pdfPreviewStyle: CSSProperties = {
  width: '100%',
  minHeight: 260,
  objectFit: 'contain',
  background: '#f7f8fa',
  borderRadius: 6,
}

const relatedBoxStyle: CSSProperties = {
  marginTop: 24,
  padding: '16px',
  background: '#fff',
  borderRadius: 8,
  border: '1px solid #e5e6eb',
}
const relatedTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: '#1f2329',
  marginBottom: 10,
}
const relatedListStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
}
const relatedLinkStyle: CSSProperties = {
  color: '#1677ff',
  textDecoration: 'none',
  fontSize: 14,
}

const footerStyle: CSSProperties = {
  textAlign: 'center',
  padding: '20px',
  color: '#8b949e',
  fontSize: 12,
  background: '#fff',
  borderTop: '1px solid #e5e6eb',
}

const notFoundStyle: CSSProperties = {
  textAlign: 'center',
  padding: '80px 24px',
  color: '#4e5969',
}
