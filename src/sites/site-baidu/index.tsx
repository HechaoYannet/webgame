/**
 * site-baidu —— 百度搜索 站点根。
 *
 * 仿百度视觉的纯前端搜索引擎：
 *  - 首页：百度 logo 文本 + 搜索框 + 常用入口导航。
 *  - 结果页：按搜索索引模糊匹配，结果项点击在新标签打开对应站点根。
 *
 * 站内导航用 react-router v8 的与 Routes（hash 路由由宿主提供，根挂在
 * hash #/site/site-baidu 任意子路径）。仅两条站内路由：首页（空路径）与结果页（s）。
 *
 * 边界：仅 import react、react-router、@/sites/shared 子目录、@/types、本目录文件。
 * 不碰 @/engine、@/game、@/data/loader、@/ui、@/utils、src/apps、@/sites/sitePage。
 */
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, Routes, Route, useNavigate, useSearchParams } from 'react-router'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import { search, siteRootUrl, warmup, type SearchResult } from './search'

export const siteId = 'site-baidu'

export default function BaiduSite(): JSX.Element {
  // <Routes> 仅 match，无导航；<Link>/useNavigate 的目标 to 在子组件内调用
  // sitePath(useSiteBase(), 's')，转绝对站点路径，避免 /s?wd=... 解析脱离 /site/site-baidu。
  return (
    <div style={rootStyle}>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="s" element={<ResultPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
      <BaiduFooter />
    </div>
  )
}

function HomePage(): JSX.Element {
  const base = useSiteBase()
  const navigate = useNavigate()
  const [kw, setKw] = useState('')

  useEffect(() => {
    void warmup()
  }, [])

  function onSubmit(e: FormEvent): void {
    e.preventDefault()
    const q = kw.trim()
    if (!q) return
    navigate(`${sitePath(base, 's')}?wd=${encodeURIComponent(q)}`)
  }

  return (
    <main style={homeMainStyle}>
      <div style={homeCenterStyle}>
        <div style={logoStyle}>
          <span style={logoBlueStyle}>Baidu</span>
          <span style={logoRedStyle}>百度</span>
        </div>
        <form onSubmit={onSubmit} style={searchFormStyle}>
          <input
            type="text"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="请输入您要搜索的关键词"
            style={searchInputStyle}
            aria-label="百度搜索"
            autoFocus
          />
          <button type="submit" style={searchBtnStyle}>
            百度一下
          </button>
        </form>
        <nav style={homeNavStyle}>
          <span>新闻</span>
          <span>网页</span>
          <span>贴吧</span>
          <span>知道</span>
          <span>图片</span>
          <span>视频</span>
        </nav>
      </div>
    </main>
  )
}

function ResultPage(): JSX.Element {
  const base = useSiteBase()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const wd = params.get('wd') ?? ''

  const [kw, setKw] = useState(wd)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    setKw(wd)
    if (!wd.trim()) {
      setResults([])
      setSearched(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setSearched(false)
    void search(wd).then((rs) => {
      if (cancelled) return
      setResults(rs)
      setLoading(false)
      setSearched(true)
    })
    return () => {
      cancelled = true
    }
  }, [wd])

  function onSubmit(e: FormEvent): void {
    e.preventDefault()
    const q = kw.trim()
    if (!q) return
    navigate(`${sitePath(base, 's')}?wd=${encodeURIComponent(q)}`)
  }

  return (
    <div style={resultPageStyle}>
      <header style={resultHeaderStyle}>
        <div style={resultLogoStyle}>
          <span style={logoBlueStyle}>Baidu</span>
          <span style={logoRedStyle}>百度</span>
        </div>
        <form onSubmit={onSubmit} style={resultFormStyle}>
          <input
            type="text"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            style={searchInputStyle}
            aria-label="百度搜索"
          />
          <button type="submit" style={searchBtnStyle}>
            百度一下
          </button>
        </form>
        <Link to={base} style={backHomeLinkStyle}>
          返回首页
        </Link>
      </header>

      <section style={resultSectionStyle}>
        {loading && <div style={statusStyle}>搜索中…</div>}
        {!loading && searched && results.length === 0 && (
          <div style={statusStyle}>
            找不到与“{wd}”相关的网页。换个关键词试试。
          </div>
        )}
        {!loading && searched && results.length > 0 && (
          <div style={resultCountStyle}>
            百度为您找到相关结果约 {results.length} 个
          </div>
        )}
        {results.map((r) => (
          <ResultItem key={r.pageId} r={r} q={wd} />
        ))}
      </section>
    </div>
  )
}

function ResultItem({ r, q }: { r: SearchResult; q: string }): JSX.Element {
  function onClick(): void {
    // 用户手势内 window.open 新标签；noopener 避免泄漏 opener。
    window.open(siteRootUrl(r.siteId), '_blank', 'noopener')
  }

  return (
    <article style={itemStyle}>
      <div style={itemUrlStyle}>{r.baseUrl}</div>
      <h3 style={itemTitleWrapStyle}>
        <a
          href={siteRootUrl(r.siteId)}
          onClick={(e) => {
            // 阻止默认跳转（hash 重复刷新无意义），改新标签打开。
            e.preventDefault()
            onClick()
          }}
          style={itemTitleStyle}
          title={`点击新标签打开 ${r.siteName}`}
        >
          {highlight(r.siteName, q)}
        </a>
      </h3>
      <div style={itemDescStyle}>
        来源站点：{r.siteName}
      </div>
      <div style={itemKwStyle}>命中关键词：{r.matchedKeyword}</div>
    </article>
  )
}

function highlight(text: string, q: string): JSX.Element {
  const ql = q.toLowerCase()
  const tl = text.toLowerCase()
  const idx = tl.indexOf(ql)
  if (!ql || idx === -1) return <>{text}</>
  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + q.length)
  const after = text.slice(idx + q.length)
  return (
    <>
      {before}
      <span style={highlightStyle}>{match}</span>
      {after}
    </>
  )
}

function BaiduFooter(): JSX.Element {
  return (
    <footer style={footerStyle}>
      <div style={footerLineStyle}>
        <a href="#" onClick={(e) => e.preventDefault()} style={footerLinkStyle}>设为首页</a>
        <span style={footerDotStyle}>·</span>
        <a href="#" onClick={(e) => e.preventDefault()} style={footerLinkStyle}>关于百度</a>
        <span style={footerDotStyle}>·</span>
        <a href="#" onClick={(e) => e.preventDefault()} style={footerLinkStyle}>About Baidu</a>
        <span style={footerDotStyle}>·</span>
        <a href="#" onClick={(e) => e.preventDefault()} style={footerLinkStyle}>百度推广</a>
      </div>
      <div style={footerCopyStyle}>
        ©2026 Baidu <span style={footerDotStyle}>·</span> 使用百度前必读
        <span style={footerDotStyle}>·</span> 意见反馈 京 ICP 证 030173 号
      </div>
    </footer>
  )
}

const rootStyle: CSSProperties = {
  width: '100%',
  minHeight: '100vh',
  background: '#fff',
  color: '#222',
  fontFamily: 'Arial, "Microsoft YaHei", "PingFang SC", sans-serif',
  display: 'flex',
  flexDirection: 'column',
}
const homeMainStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  paddingTop: '16vh',
}
const homeCenterStyle: CSSProperties = {
  width: 640,
  maxWidth: '90vw',
  margin: '0 auto',
}
const logoStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: 44,
  fontWeight: 700,
  marginBottom: 24,
  letterSpacing: 1,
}
const logoBlueStyle: CSSProperties = { color: '#4e6ef2', marginRight: 8 }
const logoRedStyle: CSSProperties = { color: '#e8312f' }
const searchFormStyle: CSSProperties = {
  display: 'flex',
  border: '2px solid #c4c7ce',
  borderRadius: 10,
  overflow: 'hidden',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
}
const searchInputStyle: CSSProperties = {
  flex: 1,
  height: 44,
  border: 'none',
  outline: 'none',
  padding: '0 16px',
  fontSize: 16,
  background: '#fff',
  color: '#222',
}
const searchBtnStyle: CSSProperties = {
  width: 108,
  border: 'none',
  background: '#4e6ef2',
  color: '#fff',
  fontSize: 17,
  letterSpacing: 2,
  cursor: 'pointer',
}
const homeNavStyle: CSSProperties = {
  marginTop: 28,
  display: 'flex',
  gap: 24,
  justifyContent: 'center',
  color: '#626675',
  fontSize: 13,
}

const resultPageStyle: CSSProperties = { flex: 1 }
const resultHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 18,
  padding: '18px 32px',
  borderBottom: '1px solid #efefef',
  position: 'sticky',
  top: 0,
  background: '#fff',
  zIndex: 10,
}
const resultLogoStyle: CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  whiteSpace: 'nowrap',
}
const resultFormStyle: CSSProperties = {
  display: 'flex',
  border: '2px solid #c4c7ce',
  borderRadius: 10,
  overflow: 'hidden',
  flex: 1,
  maxWidth: 640,
}
const backHomeLinkStyle: CSSProperties = {
  color: '#626675',
  fontSize: 13,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}
const resultSectionStyle: CSSProperties = {
  maxWidth: 640,
  margin: '0 32px',
  padding: '18px 0 48px',
}
const resultCountStyle: CSSProperties = {
  color: '#9195a3',
  fontSize: 13,
  marginBottom: 16,
}
const statusStyle: CSSProperties = {
  padding: '32px 0',
  color: '#9195a3',
  fontSize: 14,
}

const itemStyle: CSSProperties = { marginBottom: 22 }
const itemUrlStyle: CSSProperties = {
  color: '#008000',
  fontSize: 12,
  marginBottom: 2,
}
const itemTitleWrapStyle: CSSProperties = { margin: '0 0 4px', fontSize: 18, fontWeight: 400 }
const itemTitleStyle: CSSProperties = {
  color: '#2440ea',
  textDecoration: 'none',
  cursor: 'pointer',
}
const itemDescStyle: CSSProperties = {
  color: '#333',
  fontSize: 13,
  lineHeight: 1.6,
  marginBottom: 2,
}
const itemKwStyle: CSSProperties = {
  color: '#9195a3',
  fontSize: 12,
}
const highlightStyle: CSSProperties = { color: '#e8312f' }

const footerStyle: CSSProperties = {
  borderTop: '1px solid #efefef',
  padding: '14px 0 24px',
  textAlign: 'center',
  color: '#9195a3',
  fontSize: 12,
  lineHeight: 1.9,
}
const footerLineStyle: CSSProperties = { marginBottom: 4 }
const footerLinkStyle: CSSProperties = { color: '#9195a3', textDecoration: 'none', margin: '0 6px' }
const footerDotStyle: CSSProperties = { margin: '0 4px', color: '#ccc' }
const footerCopyStyle: CSSProperties = {}
