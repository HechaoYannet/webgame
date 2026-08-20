/**
 * site-shanhe-med —— 山河医科大学官方网站。
 *
 * 多页面普通高校官网：首页 / 科研动态 / 科研子页 / 机构设置 / 师资 /
 * 实验室 / 招聘 / 论文 / 新闻 / 联系方式 / 实验室后台（含登录）。
 *
 * 路由：挂在 /site/site-shanhe-med/ 星号下，SiteRouter 已把请求派发到本根。
 * 站内用相对路径做导航（react-router v8 的 Routes + Link + useNavigate）。
 *
 * 边界：仅 import react、react-router、本目录文件、@/sites/shared/*、@/types。
 * 不碰游戏系统（@/engine、@/game、@/data/loader、@/ui、src/apps、@/sites/sitePage）。
 *
 * 后台登录：page-shanhe-lab-admin 的 loginForm 块 puzzleId=puzzle-lab-backend。
 * 登录通过即 navigate 到 admin 下经费报告页与受试者页。无任何外部效果。
 *
 * 注意：代码注释里禁止出现星紧接斜杠的字符序列，故路径通配均用文字描述。
 */
import { useEffect, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router'
import { checkLogin } from '@/sites/shared/answerCheck'
import { getCachedPageContent, getPageContent, type SitePage } from '@/sites/shared/pageContent'
import { PlaceholderImage, PlaceholderPdf } from '@/sites/shared/placeholder'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import type { PageBlock, PageId } from '@/types'

export const siteId = 'site-shanhe-med'

/** pageId → 站内相对路径片段（构成站内路由地址）。 */
const PAGE_ID_TO_PATH: Record<string, string> = {
  'page-shanhe-home': '',
  'page-shanhe-research': 'research',
  'page-shanhe-research-breakthrough': 'research/breakthrough',
  'page-shanhe-research-crystal': 'research/crystal-paper',
  'page-shanhe-structure': 'structure',
  'page-shanhe-faculty': 'faculty',
  'page-shanhe-lab': 'lab',
  'page-shanhe-recruit': 'lab/recruit',
  'page-shanhe-publications': 'publications',
  'page-shanhe-news-funding': 'news/funding-2025yfc',
  'page-shanhe-news-award': 'news/energy-award',
  'page-shanhe-contact': 'contact',
  'page-shanhe-lab-admin': 'admin',
  'page-lab-funding-report': 'admin/funding-report',
  'page-lab-subject-list': 'admin/subject-list',
}

/** 顶栏主导航（首页 nav block 的子集，本真高校导航）。 */
const MAIN_NAV: Array<{ label: string; path: string }> = [
  { label: '首页', path: '' },
  { label: '科研动态', path: 'research' },
  { label: '机构设置', path: 'structure' },
  { label: '师资队伍', path: 'faculty' },
  { label: '论文发表', path: 'publications' },
  { label: '联系方式', path: 'contact' },
]

export default function ShanheMedSite(): JSX.Element {
  return (
    <div style={rootStyle}>
      <SiteHeader />
      <Routes>
        <Route index element={<ContentPage pageId="page-shanhe-home" />} />
        <Route path="research" element={<ContentPage pageId="page-shanhe-research" />} />
        <Route path="research/breakthrough" element={<ContentPage pageId="page-shanhe-research-breakthrough" />} />
        <Route path="research/crystal-paper" element={<ContentPage pageId="page-shanhe-research-crystal" />} />
        <Route path="structure" element={<ContentPage pageId="page-shanhe-structure" />} />
        <Route path="faculty" element={<ContentPage pageId="page-shanhe-faculty" />} />
        <Route path="lab" element={<ContentPage pageId="page-shanhe-lab" />} />
        <Route path="lab/recruit" element={<ContentPage pageId="page-shanhe-recruit" />} />
        <Route path="publications" element={<ContentPage pageId="page-shanhe-publications" />} />
        <Route path="news/funding-2025yfc" element={<ContentPage pageId="page-shanhe-news-funding" />} />
        <Route path="news/energy-award" element={<ContentPage pageId="page-shanhe-news-award" />} />
        <Route path="contact" element={<ContentPage pageId="page-shanhe-contact" />} />
        <Route path="admin" element={<LabAdminLogin />} />
        <Route path="admin/funding-report" element={<LabAdminRequired><ContentPage pageId="page-lab-funding-report" /></LabAdminRequired>} />
        <Route path="admin/subject-list" element={<LabAdminRequired><ContentPage pageId="page-lab-subject-list" /></LabAdminRequired>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <SiteFooter />
    </div>
  )
}

/* ============ 站点外壳 ============ */

function SiteHeader(): JSX.Element {
  const base = useSiteBase()
  return (
    <header style={headerStyle}>
      <div style={headerInnerStyle}>
        <Link to={sitePath(base, '')} style={brandStyle}>
          <span style={brandMarkStyle}>山河</span>
          <span style={brandTextStyle}>
            <strong>山河医科大学</strong>
            <span style={brandSubStyle}>Shanhe Medical University</span>
          </span>
        </Link>
        <nav style={topNavStyle}>
          {MAIN_NAV.map((item) => (
            <Link key={item.path} to={sitePath(base, item.path)} style={topNavLinkStyle}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}

function SiteFooter(): JSX.Element {
  return (
    <footer style={footerStyle}>
      <div style={footerInnerStyle}>
        <div>地址：某省某市某区山河医科大学</div>
        <div>实验室邮箱：lab@shanhe-med.cn</div>
        <div style={footerCopyStyle}>© 2026 山河医科大学 版权所有 · 科研立校 · 服务社会</div>
      </div>
    </footer>
  )
}

function NotFound(): JSX.Element {
  return (
    <main style={mainStyle}>
      <div style={loadingStyle}>
        <h2 style={{ marginTop: 0 }}>404 — 页面不存在</h2>
        <p>请通过上方导航返回首页。</p>
      </div>
    </main>
  )
}

/* ============ 通用内容页：取 page JSON 并本真渲染 blocks ============ */

function ContentPage({ pageId }: { pageId: PageId }): JSX.Element {
  const [page, setPage] = useState<SitePage | null | undefined>(undefined)
  useEffect(() => {
    const cached = getCachedPageContent(pageId)
    if (cached) {
      setPage(cached)
      return
    }
    void getPageContent(pageId).then((p) => setPage(p))
  }, [pageId])

  if (page === undefined) {
    return (
      <main style={mainStyle}>
        <div style={loadingStyle}>加载中…</div>
      </main>
    )
  }
  if (page === null) {
    return (
      <main style={mainStyle}>
        <div style={loadingStyle}>该页面暂时无法访问。</div>
      </main>
    )
  }
  return (
    <main style={mainStyle}>
      <article style={articleStyle}>
        <h1 style={pageTitleStyle}>{page.title}</h1>
        <PageBlocks blocks={page.blocks} />
      </article>
    </main>
  )
}

function PageBlocks({ blocks }: { blocks: PageBlock[] }): JSX.Element {
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </>
  )
}

function BlockView({ block }: { block: PageBlock }): JSX.Element | null {
  const base = useSiteBase()
  switch (block.type) {
    case 'hero':
      return (
        <section style={heroStyle}>
          {block.imageAssetId && (
            <PlaceholderImage assetId={block.imageAssetId} alt={block.heading} style={heroImgStyle} />
          )}
          <div style={heroTextStyle}>
            <h1 style={heroHeadingStyle}>{block.heading}</h1>
            {block.subheading && <p style={heroSubStyle}>{block.subheading}</p>}
          </div>
        </section>
      )
    case 'paragraph':
      return <p style={paraStyle}>{block.text}</p>
    case 'callout':
      return <CalloutView variant={block.variant} text={block.text} />
    case 'image':
      return (
        <figure style={figureStyle}>
          <PlaceholderImage assetId={block.assetId} alt={block.caption ?? ''} style={imageStyle} caption={block.caption} />
          {block.caption && <figcaption style={figcaptionStyle}>{block.caption}</figcaption>}
        </figure>
      )
    case 'table':
      return <TableView headers={block.headers} rows={block.rows} />
    case 'nav':
      return (
        <nav style={inlineNavStyle}>
          {block.links.map((lnk, i) => (
            <Link key={i} to={sitePath(base, pageIdToPath(lnk.pageId))} style={inlineNavLinkStyle}>
              {lnk.label}
            </Link>
          ))}
        </nav>
      )
    case 'articleList':
      return (
        <ul style={articleListStyle}>
          {block.items.map((item, i) => (
            <li key={i} style={articleListItemStyle}>
              <Link to={sitePath(base, pageIdToPath(item.pageId))} style={articleListTitleStyle}>
                {item.title}
              </Link>
              {item.date && <span style={articleListDateStyle}>{item.date}</span>}
            </li>
          ))}
        </ul>
      )
    case 'sourceComment':
      // 源码注释块：本真高校官网里它以 HTML 注释形式隐藏在页面源码中。
      // 仿真实站点：用低对比的注释段落呈现 sourceComment.comment 文本，linkPageId 给出可跳转线索。
      return <SourceCommentView comment={block.comment} linkPageId={block.linkPageId} />
    case 'form':
      return <FormView formId={block.formId} message={block.onSubmitMessage} />
    case 'pdfViewer':
      return (
        <div style={pdfWrapStyle}>
          <PlaceholderPdf assetId={block.assetId} style={{ minHeight: 420 }} />
        </div>
      )
    case 'loginForm':
      // loginForm 在通用页里不直接渲染（后台登录页 LabAdminLogin 专门处理）。
      return null
    default:
      return null
  }
}

function CalloutView({ variant, text }: { variant: 'info' | 'warning' | 'danger'; text: string }): JSX.Element {
  const style = calloutBaseStyle(variant)
  return <div style={style}>{text}</div>
}

function calloutBaseStyle(variant: 'info' | 'warning' | 'danger'): CSSProperties {
  const map: Record<'info' | 'warning' | 'danger', { border: string; bg: string; color: string }> = {
    info: { border: '#16599a', bg: '#eef5fb', color: '#1d4e7d' },
    warning: { border: '#b8860b', bg: '#fff8e6', color: '#7a5a05' },
    danger: { border: '#a13030', bg: '#fceaea', color: '#7a1818' },
  }
  const c = map[variant]
  return {
    background: c.bg,
    borderLeft: `4px solid ${c.border}`,
    color: c.color,
    padding: '14px 18px',
    borderRadius: 4,
    margin: '18px 0',
    fontSize: 15,
    lineHeight: 1.7,
  }
}

function TableView({ headers, rows }: { headers: string[]; rows: string[][] }): JSX.Element {
  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={thStyle}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={ri % 2 === 1 ? trAltStyle : undefined}>
              {row.map((cell, ci) => (
                <td key={ci} style={tdStyle}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SourceCommentView({ comment, linkPageId }: { comment: string; linkPageId?: PageId }): JSX.Element | null {
  const navigate = useNavigate()
  const base = useSiteBase()
  const targetPath = linkPageId ? sitePath(base, pageIdToPath(linkPageId)) : undefined
  return (
    <div style={sourceCommentWrapStyle}>
      <pre style={sourceCommentTextStyle}>{comment}</pre>
      {targetPath && (
        <button
          type="button"
          style={sourceCommentLinkStyle}
          onClick={() => navigate(targetPath)}
        >
          前往相关页面 →
        </button>
      )}
    </div>
  )
}

function FormView({ formId, message }: { formId: string; message: string }): JSX.Element {
  const [submitted, setSubmitted] = useState(false)
  return (
    <form
      style={formStyle}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setSubmitted(true)
      }}
      data-form-id={formId}
    >
      <label style={formLabelStyle}>姓名</label>
      <input style={formInputStyle} type="text" name="name" />
      <label style={formLabelStyle}>邮箱</label>
      <input style={formInputStyle} type="email" name="email" />
      <label style={formLabelStyle}>内容</label>
      <textarea style={formTextareaStyle} name="message" rows={4} />
      <button type="submit" style={formButtonStyle}>提交</button>
      {submitted && <p style={formMessageStyle}>{message}</p>}
    </form>
  )
}

/* ============ 实验室后台登录页 ============ */

function LabAdminLogin(): JSX.Element {
  const navigate = useNavigate()
  const base = useSiteBase()
  const [page, setPage] = useState<SitePage | null | undefined>(undefined)
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void getPageContent('page-shanhe-lab-admin').then((p) => setPage(p))
  }, [])

  const token = page?.loginTokens?.[0] ?? 'puzzle-lab-backend'

  function onSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    const ok = checkLogin(token, password)
    if (ok) {
      sessionStorage.setItem(SHANHE_ADMIN_KEY, '1')
      navigate(sitePath(base, 'admin/funding-report'))
    } else {
      setError('账号或密码错误。')
    }
  }

  return (
    <main style={mainStyle}>
      <div style={adminLoginCardStyle}>
        <h2 style={adminLoginTitleStyle}>生物能源实验室 管理系统</h2>
        <p style={adminLoginHintStyle}>管理员登录。测试账号：admin。密码提示：基金号 2025YFC0123456 的后 6 位。</p>
        <form style={adminLoginFormStyle} onSubmit={onSubmit}>
          <label style={formLabelStyle}>账号</label>
          <input
            style={formInputStyle}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <label style={formLabelStyle}>密码</label>
          <input
            style={formInputStyle}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button type="submit" style={formButtonStyle}>登录</button>
          {error && <p style={formErrorStyle}>{error}</p>}
        </form>
        <div style={adminLoginFooterStyle}>
          <Link to={sitePath(base, '')} style={adminLoginBackStyle}>← 返回实验室官网</Link>
        </div>
      </div>
    </main>
  )
}

const SHANHE_ADMIN_KEY = 'shanhe-med-admin-ok'

/** 后台守卫：未登录跳回登录页。 */
function LabAdminRequired({ children }: { children: ReactNode }): JSX.Element {
  const base = useSiteBase()
  const ok = sessionStorage.getItem(SHANHE_ADMIN_KEY) === '1'
  if (!ok) {
    return (
      <main style={mainStyle}>
        <div style={loadingStyle}>
          <p>请先登录实验室管理系统。</p>
          <Link to={sitePath(base, 'admin')} style={adminLoginBackStyle}>前往登录页</Link>
        </div>
      </main>
    )
  }
  return <>{children}</>
}

/* ============ 路由辅助 ============ */

/** pageId → 站内相对路径（未知 pageId 退化为到达首页）。 */
function pageIdToPath(pageId: PageId): string {
  return PAGE_ID_TO_PATH[pageId] ?? ''
}

/* ============ 样式 ============ */

const rootStyle: CSSProperties = {
  width: '100%',
  minHeight: '100vh',
  background: '#f5f7fa',
  color: '#1f2a36',
  fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  display: 'flex',
  flexDirection: 'column',
}

const headerStyle: CSSProperties = {
  background: '#7a1f1f',
  borderBottom: '3px solid #c9a14a',
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
}
const headerInnerStyle: CSSProperties = {
  maxWidth: 1080,
  margin: '0 auto',
  padding: '14px 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 12,
}
const brandStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  textDecoration: 'none',
  color: '#fff',
}
const brandMarkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 42,
  height: 42,
  borderRadius: 6,
  background: '#c9a14a',
  color: '#3a0e0e',
  fontWeight: 800,
  fontSize: 18,
  letterSpacing: 1,
}
const brandTextStyle: CSSProperties = { display: 'flex', flexDirection: 'column', lineHeight: 1.2 }
const brandSubStyle: CSSProperties = { fontSize: 11, color: '#f0d9a8', letterSpacing: 0.5 }
const topNavStyle: CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap' }
const topNavLinkStyle: CSSProperties = {
  color: '#fbf3e0',
  textDecoration: 'none',
  fontSize: 15,
  padding: '6px 10px',
  borderRadius: 4,
}
const mainStyle: CSSProperties = { flex: 1, width: '100%' }
const articleStyle: CSSProperties = { maxWidth: 920, margin: '0 auto', padding: '32px 24px 56px' }
const pageTitleStyle: CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  color: '#5a1414',
  borderBottom: '1px solid #e4d6b8',
  paddingBottom: 12,
  margin: '0 0 22px',
}
const paraStyle: CSSProperties = { fontSize: 16, lineHeight: 1.9, color: '#2c3a48', margin: '14px 0' }
const heroStyle: CSSProperties = {
  position: 'relative',
  marginBottom: 28,
  borderRadius: 8,
  overflow: 'hidden',
  boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
}
const heroImgStyle: CSSProperties = { width: '100%', height: 320, objectFit: 'cover', display: 'block' }
const heroTextStyle: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(58,14,14,0) 0%, rgba(58,14,14,0.78) 100%)',
  padding: '80px 28px 26px',
  marginTop: '-120px',
  position: 'relative',
}
const heroHeadingStyle: CSSProperties = { fontSize: 30, fontWeight: 700, color: '#fff', margin: '0 0 6px' }
const heroSubStyle: CSSProperties = { fontSize: 16, color: '#f0e6d2', margin: 0 }
const figureStyle: CSSProperties = { margin: '20px 0', textAlign: 'center' }
const imageStyle: CSSProperties = { width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 6 }
const figcaptionStyle: CSSProperties = { fontSize: 13, color: '#7a8896', marginTop: 8 }
const tableWrapStyle: CSSProperties = { overflowX: 'auto', margin: '18px 0' }
const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#fff',
  fontSize: 15,
  border: '1px solid #e1e6ec',
}
const thStyle: CSSProperties = {
  background: '#5a1414',
  color: '#fff',
  padding: '10px 12px',
  textAlign: 'left',
  fontWeight: 600,
  border: '1px solid #5a1414',
}
const trAltStyle: CSSProperties = { background: '#f6f1e6' }
const tdStyle: CSSProperties = { padding: '10px 12px', border: '1px solid #e1e6ec', verticalAlign: 'top' }
const inlineNavStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  margin: '16px 0',
  padding: '10px 14px',
  background: '#fbf6ea',
  border: '1px solid #ead9b8',
  borderRadius: 6,
}
const inlineNavLinkStyle: CSSProperties = {
  color: '#5a1414',
  textDecoration: 'none',
  fontSize: 14,
  padding: '3px 8px',
  borderRadius: 4,
  background: '#fff',
  border: '1px solid #ecdcb8',
}
const articleListStyle: CSSProperties = { listStyle: 'none', padding: 0, margin: '16px 0' }
const articleListItemStyle: CSSProperties = {
  padding: '14px 0',
  borderBottom: '1px dashed #e0d6c0',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}
const articleListTitleStyle: CSSProperties = {
  color: '#1d4e7d',
  textDecoration: 'none',
  fontSize: 16,
  fontWeight: 500,
}
const articleListDateStyle: CSSProperties = { color: '#8a8576', fontSize: 13 }
const sourceCommentWrapStyle: CSSProperties = {
  margin: '20px 0',
  padding: 12,
  background: '#efeef0',
  border: '1px dashed #c4c8cf',
  borderRadius: 4,
}
const sourceCommentTextStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'Consolas, "Courier New", monospace',
  fontSize: 12,
  color: '#8a8f98',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
}
const sourceCommentLinkStyle: CSSProperties = {
  marginTop: 8,
  background: 'none',
  border: 'none',
  color: '#5a1414',
  cursor: 'pointer',
  fontSize: 13,
  padding: 0,
  textDecoration: 'underline',
}
const formStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 480, margin: '20px 0' }
const formLabelStyle: CSSProperties = { fontSize: 14, color: '#455364', marginTop: 6 }
const formInputStyle: CSSProperties = {
  padding: '8px 10px',
  fontSize: 15,
  border: '1px solid #cfd6df',
  borderRadius: 4,
  background: '#fff',
}
const formTextareaStyle: CSSProperties = { ...formInputStyle, minHeight: 90, resize: 'vertical' }
const formButtonStyle: CSSProperties = {
  marginTop: 10,
  padding: '9px 18px',
  background: '#5a1414',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 15,
  cursor: 'pointer',
  alignSelf: 'flex-start',
}
const formMessageStyle: CSSProperties = {
  marginTop: 12,
  padding: '10px 14px',
  background: '#eef5fb',
  border: '1px solid #bcd6ee',
  borderRadius: 4,
  color: '#1d4e7d',
  fontSize: 14,
}
const formErrorStyle: CSSProperties = {
  marginTop: 8,
  padding: '8px 12px',
  background: '#fceaea',
  border: '1px solid #e8b9b9',
  borderRadius: 4,
  color: '#7a1818',
  fontSize: 14,
}
const pdfWrapStyle: CSSProperties = { margin: '20px 0', border: '1px solid #cfd6df', borderRadius: 6, overflow: 'hidden' }
const footerStyle: CSSProperties = { background: '#3a0e0e', color: '#cdbf9b', marginTop: 40 }
const footerInnerStyle: CSSProperties = {
  maxWidth: 1080,
  margin: '0 auto',
  padding: '26px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  lineHeight: 1.7,
}
const footerCopyStyle: CSSProperties = { marginTop: 8, color: '#9a8c6c', fontSize: 12 }
const loadingStyle: CSSProperties = {
  padding: 48,
  textAlign: 'center',
  color: '#7a8896',
  fontSize: 15,
  maxWidth: 920,
  margin: '0 auto',
}

const adminLoginCardStyle: CSSProperties = {
  maxWidth: 420,
  margin: '48px auto',
  background: '#fff',
  border: '1px solid #e1e6ec',
  borderRadius: 8,
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  padding: '28px 28px 22px',
}
const adminLoginTitleStyle: CSSProperties = { margin: '0 0 8px', fontSize: 20, color: '#5a1414' }
const adminLoginHintStyle: CSSProperties = {
  fontSize: 13,
  color: '#6c7684',
  margin: '0 0 18px',
  lineHeight: 1.6,
}
const adminLoginFormStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }
const adminLoginFooterStyle: CSSProperties = { marginTop: 18, textAlign: 'left' }
const adminLoginBackStyle: CSSProperties = { color: '#5a1414', textDecoration: 'none', fontSize: 14 }
