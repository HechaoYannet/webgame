/**
 * site-hnga Layout —— 湖南省公安厅政务门户全站框架。
 *
 * 含：政务顶部条、警徽标题区、主导航、面包屑、主内容容器、页脚。
 * 仅依赖 react、react-router、@/types、本目录文件。无任何游戏系统耦合。
 */
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'

const NAV_ITEMS: Array<{ label: string; to: string }> = [
  { label: '首页', to: '' },
  { label: '机构概况', to: 'intro' },
  { label: '警务公开', to: 'open' },
  { label: '举报中心', to: 'report' },
  { label: '办事服务', to: 'service' },
  { label: '警民互动', to: 'interact' },
  { label: '信息公开', to: 'disclose' },
]

export interface LayoutProps {
  /** 当前激活的站内路径段（用于高亮导航），如 '' / 'report'。 */
  activePath?: string
  /** 面包屑节点（已含首页）。 */
  breadcrumb?: ReactNode
  /** 是否单栏（无右侧侧边栏）。 */
  singleColumn?: boolean
  /** 正文主区。 */
  children: ReactNode
  /** 右侧侧边栏（singleColumn=true 时忽略）。 */
  sidebar?: ReactNode
}

export default function Layout({
  activePath = '',
  breadcrumb,
  singleColumn = false,
  children,
  sidebar,
}: LayoutProps): JSX.Element {
  /**
   * 站内导航用绝对站点路径（sitePath(base, ...)）。路由 path 不变；只 Link/Navigate
   * 的目标 to 改绝对，避免孤立 Routes 相对解析累积成 /report/report。各子页面若需要
   * base 另行 useSiteBase() 取即可（hook 可在任意子组件用）。
   */
  const base = useSiteBase()
  return (
    <div className="hnga-root">
      {/* 顶部政务条 */}
      <div className="hnga-govbar">
        <div className="hnga-govbar-inner">
          <span>欢迎访问湖南省公安厅门户网站</span>
          <span>
            <Link to={sitePath(base, 'report')}>举报中心</Link>
            <span className="hnga-sep">|</span>
            <Link to={sitePath(base, 'service')}>办事大厅</Link>
            <span className="hnga-sep">|</span>
            <Link to={sitePath(base, 'interact')}>厅长信箱</Link>
          </span>
        </div>
      </div>

      {/* 标题区 */}
      <header className="hnga-header">
        <div className="hnga-header-inner">
          <div className="hnga-emblem" aria-hidden="true">
            警
          </div>
          <div className="hnga-title-block">
            <h1 className="hnga-title-cn">湖南省公安厅</h1>
            <p className="hnga-title-en">HUNAN PROVINCIAL PUBLIC SECURITY DEPARTMENT</p>
          </div>
          <form
            className="hnga-search"
            onSubmit={(e) => e.preventDefault()}
            role="search"
            aria-label="站内检索"
          >
            <input type="search" placeholder="请输入关键词检索" aria-label="检索词" />
            <button type="submit">检索</button>
          </form>
        </div>
      </header>

      {/* 主导航 */}
      <nav className="hnga-nav" aria-label="主导航">
        <div className="hnga-nav-inner">
          {NAV_ITEMS.map((item) => {
            // 高亮仍按 activePath 段比较（item.to 是站内相对段），与链接 to 的绝对化解耦
            const isActive = (activePath || '') === item.to
            return (
              <Link
                key={item.label}
                to={sitePath(base, item.to)}
                className={`hnga-nav-item${isActive ? ' is-active' : ''}`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* 主体 */}
      <div className={`hnga-main${singleColumn ? ' hnga-main-single' : ''}`}>
        <main className="hnga-content">
          {breadcrumb && <nav className="hnga-crumb" aria-label="面包屑">{breadcrumb}</nav>}
          {children}
        </main>
        {!singleColumn && <aside className="hnga-sidebar">{sidebar}</aside>}
      </div>

      {/* 页脚 */}
      <footer className="hnga-footer">
        <div className="hnga-footer-inner">
          <div className="hnga-footer-links">
            <Link to={sitePath(base, 'intro')}>关于我们</Link>
            <span className="hnga-sep">|</span>
            <Link to={sitePath(base, 'service')}>办事服务</Link>
            <span className="hnga-sep">|</span>
            <Link to={sitePath(base, 'report')}>举报中心</Link>
            <span className="hnga-sep">|</span>
            <Link to={sitePath(base, 'interact')}>厅长信箱</Link>
            <span className="hnga-sep">|</span>
            <Link to={sitePath(base, 'disclose')}>信息公开</Link>
          </div>
          <div>主办单位：湖南省公安厅　承办单位：湖南省公安厅宣传处</div>
          <div>地址：湖南省长沙市八一路　邮政编码：410001　联系电话：0731-88888888</div>
          <div className="hnga-footer-copy">
            湘ICP备12345678号　湘公网安备 43000002000001号　网站标识码：4300000038
          </div>
        </div>
      </footer>

      <GapStyle />
    </div>
  )
}

/**
 * 分隔符竖线的内联样式（注入一次，避免在 CSS 文件里再加规则而显得零散）。
 * 用 style 标签隔离类名，防止与其它站点冲突。
 */
function GapStyle(): JSX.Element {
  return (
    <style>{`.hnga-sep{margin:0 4px;color:#8fa8cc;}`}</style>
  )
}

/** 公共右栏侧边块（供页面组件复用）。 */
export function SideBlock({
  title,
  children,
  style,
}: {
  title: string
  children: ReactNode
  style?: CSSProperties
}): JSX.Element {
  return (
    <div className="hnga-side-block" style={style}>
      <div className="hnga-side-head">{title}</div>
      <div className="hnga-side-body">{children}</div>
    </div>
  )
}
