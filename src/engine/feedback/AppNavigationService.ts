/**
 * src/engine/feedback/AppNavigationService.ts
 *
 * App 打开导航（CLAUDE.md §6.4 + call-scripts.json endEffects openNewsApp/openApp）。
 *
 * openApp(appId)：路由跳转打开某 App（HashRouter 内 push）。
 * openNewsApp(endingId)：真结局专用，打开新闻 App 播放破案播报（endings.json good.epilogueBlocks）。
 *
 * 路由跳转由前端注入 navigate 函数（phone-shell 在初始化时绑定 useNavigate 实例），
 * 本 service 不直接依赖 react-router，保持引擎纯函数性。
 */

import type { EndingId } from '@/types'

let _navigate: ((path: string) => void) | null = null
let _currentAppListener: ((appId: string | null) => void) | null = null
let _currentApp: string | null = null

/** 注入路由跳转函数（phone-shell 用 useNavigate 绑定）。 */
export function bindNavigate(fn: (path: string) => void): void {
  _navigate = fn
}

/** 注入当前 App 变化监听（用于 openApp 后通知 UI 切换）。 */
export function bindAppListener(fn: (appId: string | null) => void): void {
  _currentAppListener = fn
}

/**
 * 打开某 App（按 appId 路由跳转）。
 * 路由约定：`/app/<appId>`（HashRouter，CLAUDE.md §2）。
 */
export function openApp(appId: string): void {
  _currentApp = appId
  if (_currentAppListener) _currentAppListener(appId)
  if (_navigate) {
    _navigate(`/app/${appId}`)
  } else {
    console.warn('[AppNavigationService] navigate 未绑定，openApp 跳过路由')
  }
}

/**
 * 打开新闻 App（真结局专用）。
 * endingId 通常为 'good'：打开新闻 App，正文用 endings.json good.epilogueBlocks。
 * news App 渲染时按 endingId 取 endings 对应 epilogue。
 */
export function openNewsApp(endingId: EndingId): void {
  // 新闻 App route：/app/news（phone-apps agent 提供 NewsApp，或 phone-shell 内置）
  _currentApp = 'news'
  // 把 endingId 透传给 news App（通过 sessionStorage 轻传递，刷新即失效，符合一次性结局播报）
  try {
    sessionStorage.setItem('webgame-news-ending', endingId)
  } catch {
    // 无痕模式忽略
  }
  if (_currentAppListener) _currentAppListener('news')
  if (_navigate) {
    _navigate('/app/news')
  } else {
    console.warn('[AppNavigationService] navigate 未绑定，openNewsApp 跳过路由')
  }
}

export function getCurrentApp(): string | null {
  return _currentApp
}

export function getNewsEndingId(): EndingId | null {
  try {
    return (sessionStorage.getItem('webgame-news-ending') as EndingId) ?? null
  } catch {
    return null
  }
}
