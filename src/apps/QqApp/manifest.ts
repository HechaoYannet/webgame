/**
 * src/apps/QqApp/manifest.ts
 *
 * QQ App 清单（CLAUDE.md §3 + §4.2，frontend-qq 独占）。
 * 由 PhoneShell 的 AppRegistry 用 import.meta.glob 收集各 apps 子目录 manifest
 * 自动聚合，零跨目录耦合。
 *
 * Component 字段为 unknown（src/types 与 React 解耦），PhoneShell 在注册处
 * 用 React.lazy 包裹后 cast 回组件类型——manifest 里直接传 lazy(...) 即可。
 */
import { lazy } from 'react'
import type { AppManifest } from '@/types'

export const QqAppManifest: AppManifest = {
  appId: 'qq',
  title: 'QQ',
  icon: 'qq.png',
  route: '/app/qq',
  Component: lazy(() => import('./QqApp')),
  availableFrom: 'ch-prologue',
}
