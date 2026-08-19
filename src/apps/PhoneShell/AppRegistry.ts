/**
 * src/apps/PhoneShell/AppRegistry.ts
 *
 * AppRegistry — 自动聚合机制（核心并行关键，CLAUDE.md agent 定义强制规则 1）。
 *
 * 用 import.meta.glob 扫描 src/apps 下各 App 子目录的 manifest.ts，自动收集。
 * 绝不硬编码 App 列表——新 App 加目录即注册。
 *
 * glob 路径相对本文件（src/apps/PhoneShell/AppRegistry.ts）。
 * 各 App 在自己目录 src/apps/<App>/manifest.ts，相对本文件即向上一级 + 子目录，
 * 故 glob pattern 取 ".." 下任意子目录的 manifest.ts（见下方 const GLOB）。
 * 该 pattern 不会匹配 PhoneShell 自身（PhoneShell 是外壳，不声明 manifest）。
 *
 * manifest.Component 类型为 unknown（types/index.ts 与 React 解耦）。这里把
 * 各 App manifest 里的 React.lazy 包裹组件 cast 回 LazyExoticComponent 使用。
 * （各 App 自己写 lazy wrapping，本文件只做聚合 + cast。）
 *
 * 注意：glob pattern 中含星号-斜杠序列，勿在块注释里直接写出该 pattern，
 * 否则会提前结束注释。pattern 仅出现在代码字符串里。
 */
import type { ComponentType, LazyExoticComponent } from 'react'
import type { AppManifest, ChapterId, PuzzleId } from '@/types'
import { useChapter, useSolvedPuzzles } from '@/utils/shellState'

/**
 * glob 收集所有 manifest 模块（eager：同步可用；不指定 import 故拿到整个 module 命名空间）。
 *
 * 各 App agent 的 manifest.ts 既可能用 default export 也可能用 named export
 * （如 export const WechatAppManifest）。本 registry 兼容两种：优先取 default，
 * 其次扫描模块所有导出里第一个符合 AppManifest 形状的对象。
 *
 * glob pattern 必须是字符串字面量（Vite 在构建期静态分析，不接受变量）。
 * pattern 相对本文件（src/apps/PhoneShell/）向上一级到 src/apps，匹配各 App 子目录的 manifest.ts，
 * 不会匹配 PhoneShell 自身（外壳无 manifest）。相对路径即 ".." 下子目录的 manifest.ts。
 */
const manifestModules = import.meta.glob('../*/manifest.ts', {
  eager: true,
}) as Record<string, Record<string, unknown> | undefined>

/** 判断一个值是否为 AppManifest 形状（鸭子类型，容错聚合）。 */
function looksLikeManifest(v: unknown): v is AppManifest {
  if (!v || typeof v !== 'object') return false
  const m = v as Record<string, unknown>
  return (
    typeof m.appId === 'string' &&
    typeof m.title === 'string' &&
    typeof m.icon === 'string' &&
    typeof m.route === 'string' &&
    'Component' in m &&
    typeof m.availableFrom === 'string'
  )
}

/** 从一个 manifest 模块里取出 AppManifest（兼容 default / named export）。 */
function extractManifest(mod: Record<string, unknown> | undefined): AppManifest | undefined {
  if (!mod) return undefined
  // 1) default export
  if (looksLikeManifest(mod.default)) return mod.default as AppManifest
  // 2) 任意 named export（跳过 __esModule 等内部键）
  for (const [key, val] of Object.entries(mod)) {
    if (key === 'default' || key === '__esModule') continue
    if (looksLikeManifest(val)) return val as AppManifest
  }
  return undefined
}

/** 已聚合的原始 manifest 列表（去重 / 容错过滤）。 */
export const rawManifests: AppManifest[] = (() => {
  const list: AppManifest[] = []
  const seen = new Set<string>()
  for (const [, mod] of Object.entries(manifestModules)) {
    const man = extractManifest(mod)
    if (!man) continue
    if (!man.appId || seen.has(man.appId)) continue
    seen.add(man.appId)
    list.push(man)
  }
  // 按 appId 排序，保证桌面图标顺序稳定
  list.sort((a, b) => a.appId.localeCompare(b.appId))
  return list
})()

/** 渲染用的 App 组件类型（lazy 包裹后）。 */
export type AppComponent = LazyExoticComponent<ComponentType<unknown>>

export interface AppEntry extends AppManifest {
  /** 已 cast 为 lazy 组件（manifest.Component 从 unknown cast 回）。 */
  LazyComponent: AppComponent
}

/** 聚合并 cast Component 字段后的条目。 */
export const apps: AppEntry[] = rawManifests.map((m) => ({
  ...m,
  LazyComponent: m.Component as unknown as AppComponent,
}))

/** appId -> AppEntry 索引。 */
export const appById: ReadonlyMap<string, AppEntry> = (() => {
  const map = new Map<string, AppEntry>()
  for (const a of apps) map.set(a.appId, a)
  return map
})()

/**
 * 桌面图标可见性 + 顺序（按 availableFrom 章节 + hiddenUntilPuzzleId 过滤）。
 *  受 engine 当前章节/已解谜题驱动。
 */
export function useVisibleApps(): AppEntry[] {
  const { currentChapterId } = useChapter()
  const solved = useSolvedPuzzles()
  return apps.filter((a) => {
    // 章节可用性
    if (!isChapterAvailable(a.availableFrom, currentChapterId)) return false
    // 解谜前隐藏
    if (a.hiddenUntilPuzzleId && !solved.has(a.hiddenUntilPuzzleId)) return false
    return true
  })
}

/** 章节序号比较（ch-prologue=0, ch-1..5=1..5, ch-finale=6）。
 *  仅用于桌面可用性的粗过滤，精确章节推进由 engine ChapterDirector 负责。 */
function chapterOrder(chapterId: ChapterId): number {
  switch (chapterId) {
    case 'ch-prologue':
      return 0
    case 'ch-1':
      return 1
    case 'ch-2':
      return 2
    case 'ch-3':
      return 3
    case 'ch-4':
      return 4
    case 'ch-5':
      return 5
    case 'ch-finale':
      return 6
    default:
      return 0
  }
}

function isChapterAvailable(availableFrom: ChapterId, current: ChapterId): boolean {
  return chapterOrder(current) >= chapterOrder(availableFrom)
}

/** 调试用：列出 glob 实际命中的路径（开发期排查 App 未注册）。 */
export function debugGlobPaths(): string[] {
  return Object.keys(manifestModules).sort()
}

/** 调试用：某 puzzleId 隐藏的 App（验证 hiddenUntilPuzzleId 配置）。 */
export function appsHiddenUntil(puzzleId: PuzzleId): AppEntry[] {
  return apps.filter((a) => a.hiddenUntilPuzzleId === puzzleId)
}
