/**
 * src/sites/site-xinxwang/Layout.tsx
 *
 * 站点公版版式：顶部条 + 主导航（含站内 pageId→路由跳转）+ <main> + 页脚。
 * 主导航项固定（首页/关于/招生/案例/合作/新闻/团队/心声/联系），
 * 当前页高亮。后台页（admin/financial）不出现在主导航，仅通过隐藏路径或站内说明进入。
 *
 * 仅依赖 react、react-router、@/sites/shared、@/types、本目录。不碰游戏系统。
 */
import type { ReactElement, ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import { slugByPageId } from './manifest'
import './site.css'

interface NavItem {
  pageId: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { pageId: 'page-xinxwang-home', label: '首页' },
  { pageId: 'page-xinxwang-about', label: '关于我们' },
  { pageId: 'page-xinxwang-admission', label: '招生信息' },
  { pageId: 'page-xinxwang-cases', label: '成功案例' },
  { pageId: 'page-xinxwang-cooperation', label: '合作单位' },
  { pageId: 'page-xinxwang-news', label: '新闻动态' },
  { pageId: 'page-xinxwang-team', label: '教师团队' },
  { pageId: 'page-xinxwang-voices', label: '家长心声' },
  { pageId: 'page-xinxwang-contact', label: '联系我们' },
]

/**
 * 把站内 pageId 转成**纯 slug**（首页退化为空串）。
 *
 * 返回值不再含 `./` 前缀——调用方须经 sitePath(base, pageIdToPath(pageId))
 * 拼成绝对站点路径再交给 &lt;Link to&gt;，避免孤立 Routes 的相对 to 解析在
 * 站内多次跳转后累积成 /list/list。
 */
export function pageIdToPath(pageId: string): string {
  return slugByPageId.get(pageId) ?? ''
}

export function Layout({ children, hideFrame }: { children: ReactNode; hideFrame?: boolean }): ReactElement {
  const loc = useLocation()
  const base = useSiteBase()
  // 当前激活导航项：按 path 首段匹配。站内根是 splat，故 useLocation().pathname 末段是站内路径。
  const pathTail = loc.pathname.replace(/^.*\/site\/site-xinxwang\/?/, '')
  const activeSeg = pathTail.split('?')[0].split('#')[0]
  // 当前命中哪个 pageId（用于导航高亮）
  const activePageId = (() => {
    for (const item of NAV_ITEMS) {
      const slug = slugByPageId.get(item.pageId) ?? ''
      const seg = slug ? slug.split('/')[0] : ''
      if (seg && (activeSeg === seg || activeSeg.startsWith(seg + '/'))) return item.pageId
      if (!slug && (activeSeg === '' )) return item.pageId
    }
    return ''
  })()

  if (hideFrame) {
    // 后台登录/财务页用清爽单列，不显示主打航与页脚喧宾夺主
    return <div className="xw-root">{children}</div>
  }

  return (
    <div className="xw-root">
      <div className="xw-topbar">
        <div className="xw-topbar-inner">
          <span>长沙专业青少年行为矫正机构 · 诚信办学20年</span>
          <span>
            <span>咨询热线：0731-88220188</span>
          </span>
        </div>
      </div>

      <header className="xw-header">
        <div className="xw-header-inner">
          <Link to={base} className="xw-brand">
            <span className="xw-brand-logo">新</span>
            <span>
              <div className="xw-brand-name">新希望成长中心</div>
              <div className="xw-brand-sub">XINXWANG GROWTH CENTER</div>
            </span>
          </Link>
          <nav className="xw-nav">
            {NAV_ITEMS.map((it) => (
              <Link
                key={it.pageId}
                to={sitePath(base, pageIdToPath(it.pageId))}
                className={activePageId === it.pageId ? 'is-active' : undefined}
              >
                {it.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="xw-main">{children}</main>

      <footer className="xw-footer">
        <div className="xw-footer-inner">
          <div>
            <h4>新希望成长中心</h4>
            <p>改变孩子，从这里开始</p>
            <p>长沙专业青少年行为矫正机构</p>
          </div>
          <div>
            <h4>联系方式</h4>
            <p>地址：湖南省长沙市望城区高塘岭街道兴业路66号</p>
            <p>电话：0731-88220188</p>
            <p>邮箱：contact@xinxwang-center.com</p>
          </div>
          <div>
            <h4>快速导航</h4>
            <p>
              <Link to={sitePath(base, 'about')} style={{ color: '#9fc4ca' }}>关于我们</Link>
              {' · '}
              <Link to={sitePath(base, 'admission')} style={{ color: '#9fc4ca' }}>招生信息</Link>
              {' · '}
              <Link to={sitePath(base, 'contact')} style={{ color: '#9fc4ca' }}>联系我们</Link>
            </p>
            <p>
              <Link to={sitePath(base, 'news')} style={{ color: '#9fc4ca' }}>新闻动态</Link>
              {' · '}
              <Link to={sitePath(base, 'cooperation')} style={{ color: '#9fc4ca' }}>合作单位</Link>
            </p>
          </div>
        </div>
        <div className="xw-footer-bottom">
          © 2005-2026 新希望成长中心 · 湘ICP备2023026841号 · 湘公网安备43010402000876号
          <br />
          网站内容仅供宣传参考，入营须签订正式协议
        </div>
      </footer>
    </div>
  )
}
