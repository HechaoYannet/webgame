/**
 * site-hnedu —— 湖南省教育厅门户网站（政务门户视觉）。
 *
 * 单内容页：page-hnedu（民办教育机构专项检查通报 / 2025 年度民办学校黑名单）。
 * 站点根挂在 /site/site-hnedu 星号路由，内部用 <Routes> 做相对路径导航。
 * 所有页面任意访客可访问，无门控；本站无 loginForm 块，故无登录后台。
 *
 * 边界：仅 import react、react-router、@/sites/shared 子目录、@/types、本目录文件。
 * 与游戏系统完全解耦。
 */
import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router'
import { getPageContent, type SitePage } from '@/sites/shared/pageContent'
import { PlaceholderImage } from '@/sites/shared/placeholder'
import { checkLogin } from '@/sites/shared/answerCheck'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import type { PageBlock } from '@/types'
import { manifest } from './manifest'
import './site.css'

export const siteId = manifest.siteId

/** 内容页 id 常量（对应 public/data/browser/pages/page-hnedu.json）。 */
const PRIMARY_PAGE_ID = 'page-hnedu'

export default function HneduSite(): JSX.Element {
  return (
    <div className="hn-root">
      <TopBar />
      <MainNav />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/notice" element={<NoticePage />} />
        <Route path="/notice/screening" element={<NoticeDetailPage />} />
        <Route path="/gov" element={<GovInfoPage />} />
        <Route path="/zwgk" element={<PlaceholderPage title="政务公开" />} />
        <Route path="/bszn" element={<PlaceholderPage title="办事指南" />} />
        <Route path="/hdjl" element={<PlaceholderPage title="互动交流" />} />
        <Route path="/jyzx" element={<PlaceholderPage title="教育资讯" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Footer />
    </div>
  )
}

/* ============ 顶部条 + 主导航 ============ */

function TopBar(): JSX.Element {
  return (
    <div className="hn-topbar">
      湖南省教育厅门户 · 政务服务 · 湖南省人民政府主办
    </div>
  )
}

interface NavItem {
  /** 相对站点段（经 sitePath(base,...) 转绝对站点路径，避免孤立 Routes 相对解析累积）。 */
  to: string
  label: string
  dim?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '', label: '首页' },
  { to: 'gov', label: '机构概况' },
  { to: 'zwgk', label: '政务公开', dim: true },
  { to: 'notice', label: '通知公告' },
  { to: 'bszn', label: '办事指南', dim: true },
  { to: 'jyzx', label: '教育资讯', dim: true },
  { to: 'hdjl', label: '互动交流', dim: true },
]

function MainNav(): JSX.Element {
  const base = useSiteBase()
  return (
    <div className="hn-nav">
      <div className="hn-nav-inner">
        <div className="hn-brand">湖南省教育厅</div>
        <nav className="hn-nav-links">
          {NAV_ITEMS.map((it) => (
            <NavLink
              key={it.label}
              to={sitePath(base, it.to)}
              end={it.to === ''}
              className={({ isActive }) =>
                'hn-nav-link' + (isActive ? ' is-active' : '') + (it.dim ? ' is-dim' : '')
              }
            >
              {it.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

/* ============ 首页 ============ */

function HomePage(): JSX.Element {
  const [page, setPage] = useState<SitePage | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    void getPageContent(PRIMARY_PAGE_ID).then((p) => {
      if (alive) setPage(p)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <main className="hn-main">
      <BreadCrumb trail={[{ label: '首页' }]} />
      <div className="hn-content">
        <div className="hn-article">
          <PageBlocks page={page} loadingLabel="正在加载首页内容…" emptyLabel="暂时没有发布内容。" />
        </div>
        <aside className="hn-aside">
          <HomeSidebar />
        </aside>
      </div>
    </main>
  )
}

function HomeSidebar(): JSX.Element {
  const base = useSiteBase()
  return (
    <>
      <div className="hn-aside-card">
        <h3>最新公告</h3>
        <div className="hn-aside-sub">通知公告 · 政务公开</div>
        <ul className="hn-aside-list">
          <li>
            <Link to={sitePath(base, 'notice/screening')}>湖南省民办教育机构专项检查通报</Link>
            <span className="hn-aside-list-date">2025-03-10</span>
          </li>
          <li>
            <Link to={sitePath(base, 'notice')}>关于做好 2025 年度民办学校年检工作的通知</Link>
            <span className="hn-aside-list-date">2025-02-20</span>
          </li>
          <li>
            <Link to={sitePath(base, 'notice')}>关于规范校外培训机构办学的若干意见</Link>
            <span className="hn-aside-list-date">2025-01-15</span>
          </li>
        </ul>
      </div>
      <div className="hn-aside-card">
        <h3>政务咨询</h3>
        <div className="hn-bulletin">
          <strong>举报电话</strong>
          <br />
          教育违规办学投诉：0731-88888888
          <br />
          （工作日 9:00-17:00）
        </div>
      </div>
      <div className="hn-aside-card">
        <h3>常用服务</h3>
        <ul className="hn-aside-list">
          <li>
            <Link to={sitePath(base, 'bszn')}>民办学校办学许可证办理</Link>
          </li>
          <li>
            <Link to={sitePath(base, 'zwgk')}>公共企事业单位信息公开</Link>
          </li>
          <li>
            <Link to={sitePath(base, 'hdjl')}>厅长信箱</Link>
          </li>
        </ul>
      </div>
    </>
  )
}

/* ============ 通知公告列表页 ============ */

function NoticePage(): JSX.Element {
  const base = useSiteBase()
  return (
    <main className="hn-main">
      <BreadCrumb trail={[{ label: '首页', to: '' }, { label: '通知公告' }]} />
      <div className="hn-content">
        <div className="hn-article">
          <h1 className="hn-article-title">通知公告</h1>
          <div className="hn-article-meta">
            <span>省教育厅</span>
            <span>政策文件</span>
            <span>信息公开</span>
          </div>
          <ul className="hn-article-list">
            <li>
              <Link to={sitePath(base, 'notice/screening')}>湖南省民办教育机构专项检查通报</Link>
              <span className="hn-article-list-date">2025-03-10</span>
            </li>
            <li>
              <Link to={sitePath(base, 'notice')}>关于做好 2025 年度民办学校年检工作的通知</Link>
              <span className="hn-article-list-date">2025-02-20</span>
            </li>
            <li>
              <Link to={sitePath(base, 'notice')}>关于规范校外培训机构办学的若干意见</Link>
              <span className="hn-article-list-date">2025-01-15</span>
            </li>
            <li>
              <Link to={sitePath(base, 'notice')}>关于做好秋季学期开学安全工作的通知</Link>
              <span className="hn-article-list-date">2024-08-28</span>
            </li>
          </ul>
        </div>
        <aside className="hn-aside">
          <div className="hn-aside-card">
            <h3>分类</h3>
            <ul className="hn-aside-list">
              <li>
                <Link to={sitePath(base, 'notice')}>政策文件</Link>
              </li>
              <li>
                <Link to={sitePath(base, 'notice')}>通知公告</Link>
              </li>
              <li>
                <Link to={sitePath(base, 'notice')}>信息公开</Link>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  )
}

/* ============ 通报详情页（渲染 page-hnedu 真实内容） ============ */

function NoticeDetailPage(): JSX.Element {
  const [page, setPage] = useState<SitePage | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    void getPageContent(PRIMARY_PAGE_ID).then((p) => {
      if (alive) setPage(p)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <main className="hn-main">
      <BreadCrumb
        trail={[
          { label: '首页', to: '' },
          { label: '通知公告', to: 'notice' },
          { label: '民办教育机构专项检查通报' },
        ]}
      />
      <div className="hn-content">
        <div className="hn-article">
          {page ? (
            <article>
              <h1 className="hn-article-title">
                {page.title || '湖南省民办教育机构专项检查通报'}
              </h1>
              <div className="hn-article-meta">
                <span>来源：省教育厅民办教育处</span>
                <span>发布日期：2025-03-10</span>
                <span>文号：湘教通〔2025〕13 号</span>
              </div>
              <PageBlocks page={page} loadingLabel="正在加载公告内容…" emptyLabel="公告内容暂未发布。" />
            </article>
          ) : page === null ? (
            <div className="hn-loading">公告内容暂未发布。</div>
          ) : (
            <div className="hn-loading">正在加载公告内容…</div>
          )}
        </div>
        <aside className="hn-aside">
          <HomeSidebar />
        </aside>
      </div>
    </main>
  )
}

/* ============ 机构概况（机构简介，图文风格） ============ */

function GovInfoPage(): JSX.Element {
  return (
    <main className="hn-main">
      <BreadCrumb trail={[{ label: '首页', to: '' }, { label: '机构概况' }]} />
      <div className="hn-content">
        <div className="hn-article">
          <h1 className="hn-article-title">机构概况</h1>
          <div className="hn-article-meta">
            <span>省教育厅</span>
            <span>部门简介</span>
          </div>
          <p className="hn-paragraph">
            湖南省教育厅是湖南省人民政府主管全省教育事业的组成部门，负责贯彻国家教育方针、拟订全省教育发展规划、统筹管理各级各类教育、指导与监督民办教育机构办学行为。
          </p>
          <p className="hn-paragraph">
            主要职责包括：统筹全省基础教育、职业教育、高等教育与民办教育发展；负责民办学校办学许可审批与年检；组织开展教育专项检查与执法督查；受理群众对教育违规行为的投诉举报，并依法依规作出处理。
          </p>
          <div className="hn-callout">
            <div className="hn-callout-title">举报与投诉</div>
            如发现民办教育机构存在违规办学、超范围经营、虚假宣传等行为，可通过举报电话 0731-88888888
            向我厅民办教育处反映，我厅将依法核查处理。
          </div>
        </div>
        <aside className="hn-aside">
          <HomeSidebar />
        </aside>
      </div>
    </main>
  )
}

/* ============ 占位页（导航存在但暂无专题内容的栏目） ============ */

function PlaceholderPage({ title }: { title: string }): JSX.Element {
  return (
    <main className="hn-main">
      <BreadCrumb trail={[{ label: '首页', to: '' }, { label: title }]} />
      <div className="hn-content">
        <div className="hn-article">
          <h1 className="hn-article-title">{title}</h1>
          <div className="hn-article-meta">
            <span>省教育厅</span>
            <span>栏目建设</span>
          </div>
          <p className="hn-paragraph">本栏目内容正在建设中，请关注最新通知公告。</p>
        </div>
        <aside className="hn-aside">
          <HomeSidebar />
        </aside>
      </div>
    </main>
  )
}

function NotFoundPage(): JSX.Element {
  const base = useSiteBase()
  return (
    <main className="hn-main">
      <BreadCrumb trail={[{ label: '首页', to: '' }, { label: '页面未找到' }]} />
      <div className="hn-loading">
        <h2 style={{ marginBottom: 8 }}>404 — 您访问的页面不存在</h2>
        <Link to={base} style={{ color: '#0b3d91' }}>
          返回首页
        </Link>
      </div>
    </main>
  )
}

/* ============ 通用：面包屑 ============ */

interface Crumb {
  label: string
  /** 相对站点段（'' 表示站点根）。经 sitePath(base,...) 转绝对站点路径，避免孤立 Routes 相对解析累积。 */
  to?: string
}

function BreadCrumb({ trail }: { trail: Crumb[] }): JSX.Element {
  const base = useSiteBase()
  return (
    <div className="hn-crumb">
      {trail.map((c, i) => (
        <span key={i}>
          {i > 0 && <> &gt; </>}
          {c.to ? (
            <Link to={sitePath(base, c.to)}>{c.label}</Link>
          ) : (
            <span>{c.label}</span>
          )}
        </span>
      ))}
    </div>
  )
}

/* ============ 通用：渲染 PageBlock 数组（按本站视觉身份本真渲染） ============ */

interface PageBlocksProps {
  page: SitePage | null | undefined
  loadingLabel: string
  emptyLabel: string
}

function PageBlocks({ page, loadingLabel, emptyLabel }: PageBlocksProps): JSX.Element {
  if (page === undefined) {
    return <div className="hn-loading">{loadingLabel}</div>
  }
  if (page === null || !page.blocks.length) {
    return <div className="hn-loading">{emptyLabel}</div>
  }
  return (
    <>
      {page.blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </>
  )
}

function BlockView({ block }: { block: PageBlock }): JSX.Element | null {
  switch (block.type) {
    case 'hero':
      return (
        <header className="hn-hero">
          {block.imageAssetId && (
            <PlaceholderImage
              assetId={block.imageAssetId}
              alt={block.heading}
              className="hn-hero-img"
            />
          )}
          <h1 className="hn-hero-heading">{block.heading}</h1>
          {block.subheading && <p className="hn-hero-sub">{block.subheading}</p>}
        </header>
      )

    case 'paragraph':
      return <p className="hn-paragraph">{block.text}</p>

    case 'callout': {
      const variantClass =
        block.variant === 'warning'
          ? ' hn-callout-variant-warning'
          : block.variant === 'danger'
            ? ' hn-callout-variant-danger'
            : ''
      return (
        <div className={'hn-callout' + variantClass}>
          <div className="hn-callout-title">
            {block.variant === 'warning' ? '提示信息' : block.variant === 'danger' ? '重要警示' : '政务通报'}
          </div>
          {block.text}
        </div>
      )
    }

    case 'image':
      return (
        <figure className="hn-image-block">
          <PlaceholderImage
            assetId={block.assetId}
            alt={block.caption ?? ''}
            style={{ maxWidth: '100%', display: 'block', margin: '0 auto' }}
          />
          {block.caption && <figcaption className="hn-image-cap">{block.caption}</figcaption>}
        </figure>
      )

    case 'table':
      return (
        <div className="hn-table-wrap">
          <table className="hn-table">
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

    case 'nav': {
      return <NavBlockView links={block.links} />
    }

    case 'articleList':
      return <ArticleListView items={block.items} />

    case 'sourceComment': {
      return <SourceCommentView comment={block.comment} linkPageId={block.linkPageId} />
    }

    case 'pdfViewer':
      return (
        <div className="hn-pdf">
          PDF 文档附件（{block.assetId}）—— 请使用 Adobe Reader 阅读器查看全文。
        </div>
      )

    case 'form':
      return <SimpleForm formId={block.formId} message={block.onSubmitMessage} />

    case 'loginForm':
      return <LoginForm puzzleId={block.puzzleId} />

    default:
      return null
  }
}

/* nav / articleList / sourceComment 块需站内绝对链接，拆出子组件以便调用 useSiteBase。 */

function NavBlockView({
  links,
}: {
  links: Array<{ label: string; pageId: string }>
}): JSX.Element {
  const base = useSiteBase()
  return (
    <div className="hn-nav-block">
      <div className="hn-nav-block-title">相关链接</div>
      <ul className="hn-nav-block-links">
        {links.map((l, i) => (
          <li key={i}>
            <Link to={sitePath(base, pageToRoute(l.pageId))}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ArticleListView({
  items,
}: {
  items: Array<{ title: string; pageId: string; date?: string }>
}): JSX.Element {
  const base = useSiteBase()
  return (
    <ul className="hn-article-list">
      {items.map((item, i) => (
        <li key={i}>
          <Link to={sitePath(base, pageToRoute(item.pageId))}>{item.title}</Link>
          {item.date && <span className="hn-article-list-date">{item.date}</span>}
        </li>
      ))}
    </ul>
  )
}

function SourceCommentView({
  comment,
  linkPageId,
}: {
  comment: string
  linkPageId?: string
}): JSX.Element {
  const base = useSiteBase()
  const target = linkPageId ? sitePath(base, pageToRoute(linkPageId)) : undefined
  return (
    <div className="hn-source-comment">
      {comment}
      {target && (
        <>
          {' '}
          <Link to={target}>查看相关页面</Link>
        </>
      )}
    </div>
  )
}

/* ============ 通用表单（form 块：留言/咨询风格） ============ */

function SimpleForm({ formId, message }: { formId: string; message: string }): JSX.Element {
  const [submitted, setSubmitted] = useState(false)
  const [value, setValue] = useState('')
  return (
    <form
      className="hn-form"
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitted(true)
      }}
      data-form-id={formId}
    >
      <label htmlFor={`hn-form-${formId}`}>意见与建议</label>
      <input
        id={`hn-form-${formId}`}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="请输入您要反映的内容"
      />
      <button type="submit">提交</button>
      {submitted && <div className="hn-form-msg">{message}</div>}
    </form>
  )
}

/* ============ 登录表单（loginForm 块） ============ */
/* 本站 page-hnedu 当前无 loginForm 块，此组件仅为类型完备保留；若日后数据追加可自动启用。 */

function LoginForm({ puzzleId }: { puzzleId: string }): JSX.Element {
  const navigate = useNavigate()
  const base = useSiteBase()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="hn-form"
      onSubmit={(e) => {
        e.preventDefault()
        const ok = checkLogin(puzzleId, password)
        if (ok) {
          navigate(sitePath(base, 'gov'))
        } else {
          setError('账号或密码错误，请重试。')
        }
      }}
    >
      <label htmlFor={`hn-login-${puzzleId}`}>后台登录密码</label>
      <input
        id={`hn-login-${puzzleId}`}
        type="password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value)
          setError(null)
        }}
        placeholder="请输入登录密码"
      />
      <button type="submit">登录</button>
      {error && <div className="hn-form-msg">{error}</div>}
    </form>
  )
}

/* ============ 页脚 ============ */

function Footer(): JSX.Element {
  const base = useSiteBase()
  return (
    <footer className="hn-footer">
      <div className="hn-footer-inner">
        <div>
          <div>湖南省教育厅 · 湖南省人民政府主办</div>
          <div>地址：湖南省长沙市芙蓉区省政府院内 · 邮编：410000</div>
          <div>举报电话：0731-88888888（工作日 9:00-17:00）</div>
          <div className="hn-footer-copy">湘 ICP 备 00000000 号 · 湘公网安备 00000000000000 号</div>
        </div>
        <div className="hn-footer-links">
          <Link to={base}>网站首页</Link>
          <Link to={sitePath(base, 'zwgk')}>政务公开</Link>
          <Link to={sitePath(base, 'bszn')}>办事指南</Link>
          <Link to={sitePath(base, 'hdjl')}>互动交流</Link>
        </div>
      </div>
    </footer>
  )
}

/* ============ 辅助：pageId → 站内相对路由段 ============ */

/**
 * 把同站 pageId 映射为相对路由段（无前导斜杠，交由 sitePath(base, ...) 转绝对站点路径）。
 * 当前唯一真实内容页为 page-hnedu，映射至通报详情页段 notice/screening。
 * 其它 pageId 退化为降级段 notice（仍在本站内可访问），保证链接不悬空。
 */
function pageToRoute(pageId: string): string {
  if (pageId === PRIMARY_PAGE_ID) {
    return 'notice/screening'
  }
  // 未知 pageId 兜底到通知公告，避免悬空链接
  return 'notice'
}
