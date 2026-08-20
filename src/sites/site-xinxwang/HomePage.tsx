/**
 * src/sites/site-xinxwang/HomePage.tsx
 *
 * 首页定制：hero（带 banner 图）+ 统计数字条 + 机构简介（取 home page 的 nav+hero+
 * paragraph 块，并补一条 stats 条）。比纯 SitePage 更像真实机构官网首页。
 */
import { useEffect, useState, type ReactElement } from 'react'
import { Link } from 'react-router'
import { useSiteBase, sitePath } from '@/sites/shared/siteNav'
import { getPageContent, type SitePage as SitePageData } from '@/sites/shared/pageContent'
import { BlockRenderer } from './BlockRenderer'
import { Layout, pageIdToPath } from './Layout'

export function HomePage(): ReactElement {
  const base = useSiteBase()
  const [page, setPage] = useState<SitePageData | null>(null)

  useEffect(() => {
    void getPageContent('page-xinxwang-home').then(setPage)
  }, [])

  if (!page) {
    return (
      <Layout>
        <div className="xw-loading">页面加载中…</div>
      </Layout>
    )
  }

  // home 页 blocks: hero, nav, paragraph —— 按本真机构首页重排渲染
  const hero = page.blocks.find((b) => b.type === 'hero')
  const navBlock = page.blocks.find((b) => b.type === 'nav')
  const paras = page.blocks.filter((b) => b.type === 'paragraph')

  return (
    <Layout>
      {hero && <BlockRenderer blocks={[hero]} />}
      {navBlock && navBlock.type === 'nav' && (
        <nav className="xw-nav-block">
          {/* home 页的 nav 含全量栏目，去掉"首页"自身 */}
          {navBlock.links
            .filter((l) => l.pageId !== 'page-xinxwang-home')
            .map((l, i) => (
              <Link key={i} to={sitePath(base, pageIdToPath(l.pageId))}>
                {l.label}
              </Link>
            ))}
        </nav>
      )}

      {/* 机构统计数字条 */}
      <div className="xw-stats">
        <Stat num="20" label="年办学经验" />
        <Stat num="1000+" label="成功转化学员" />
        <Stat num="80" label="亩封闭校区" />
        <Stat num="12-18" label="岁招生对象" />
        <Stat num="20万" label="元/学期" />
      </div>

      {/* 简介 */}
      <div className="xw-intro-strip">
        {paras.map((p, i) =>
          p.type === 'paragraph' ? <p key={i} className="xw-para" style={{ margin: 0 }}>{p.text}</p> : null,
        )}
      </div>

      {/* 快捷入口卡 */}
      <div className="xw-image" style={{ background: '#fff', padding: 24, borderRadius: 8, border: '1px solid #d9dee1' }}>
        <h3 style={{ margin: '0 0 16px', color: '#1b5e6b', fontSize: 18, borderLeft: '4px solid #2e8b9a', paddingLeft: 12 }}>
          快捷服务入口
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Link to={sitePath(base, 'admission')} className="xw-form-submit" style={{ textDecoration: 'none', display: 'inline-block' }}>
            招生报名
          </Link>
          <Link to={sitePath(base, 'cases')} style={quickLinkStyle}>成功案例</Link>
          <Link to={sitePath(base, 'team')} style={quickLinkStyle}>教师团队</Link>
          <Link to={sitePath(base, 'voices')} style={quickLinkStyle}>家长心声</Link>
          <Link to={sitePath(base, 'contact')} style={quickLinkStyle}>联系我们</Link>
        </div>
      </div>
    </Layout>
  )
}

const quickLinkStyle = {
  textDecoration: 'none',
  display: 'inline-block',
  padding: '11px 22px',
  border: '1px solid #2e8b9a',
  color: '#1b5e6b',
  borderRadius: 4,
  fontSize: 14,
} as const

function Stat({ num, label }: { num: string; label: string }): ReactElement {
  return (
    <div className="xw-stat">
      <div className="xw-stat-num">{num}</div>
      <div className="xw-stat-label">{label}</div>
    </div>
  )
}
