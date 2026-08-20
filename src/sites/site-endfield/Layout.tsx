/**
 * site-endfield 站点外壳布局：顶栏 + 主区 + 页脚。
 *
 * 所有页面共用本布局。activePath 用于高亮当前导航项。
 */
import type { ReactElement, ReactNode } from 'react'
import { NavList } from './index'

export interface LayoutProps {
  activePath: string
  children: ReactNode
}

export function Layout({ activePath: _activePath, children }: LayoutProps): ReactElement {
  return (
    <div className="site-endfield">
      <header className="site-endfield__topnav">
        <span className="site-endfield__logo">明日方舟：终末地</span>
        <NavList />
      </header>
      <main className="site-endfield__main">{children}</main>
      <footer className="site-endfield__footer">
        © 2026 鹰角网络 HYPERGRYPH · 终末地项目组 · endfield.hypergryph.com
      </footer>
    </div>
  )
}
