/**
 * src/engine/chapter/ChapterDirector.ts
 *
 * 章节导演（CLAUDE.md agent 定义 §chapter + 数据 §6 onViewEffects）。
 *
 * 职责：
 *  1. 监听 puzzleSolved/evidenceCollected/clueRegistered → 评估章节 enterCondition 推进章节
 *  2. 章节推进时 onEnterEffects 执行 + 触发开场独白
 *  3. **页面首次查看触发 WebPage.onViewEffects**（核心）：visitPage 首次记录某 pageId 时，
 *     执行该 page 的 onViewEffects（用于 page-lab-funding-report 倒计时四件套 §6）。
 *
 * onViewEffects 触发点：visitPageInternal(pageId) —— 由 ChapterDirector 统一收口
 * （gameStore.visitPage 返回是否首次；本 service 接 pageFirstVisited 事件后执行 onViewEffects）。
 *
 * 章节条件评估（ChapterCondition）：
 *   gameStart / puzzleSolved / evidenceCollected / clueRegistered / and[]
 */

import { getGameStore } from '@/engine/store/gameStore'
import { on, emit } from '@/engine/eventBus'
import { getAllChapters, getChapterById, getPage } from '@/data/loader'
import { executeEffects } from '@/engine/puzzle/EffectExecutor'
import type { ChapterCondition, ChapterId, PageId, WebPage, PuzzleEffect } from '@/types'

let _initialized = false
const _shownMonologueChapters = new Set<ChapterId>()

/** 初始化（绑定事件订阅）。engine/index.ts 启动时调用一次。 */
export function initChapterDirector(): void {
  if (_initialized) return
  _initialized = true

  on('puzzleSolved', () => reevaluateChapters())
  on('evidenceCollected', () => reevaluateChapters())
  // 重写后已移除 clueRegistered 订阅：线索注册装饰机制废除，registeredClueIds 不再存在。
  // 页面首次查看 → 执行 onViewEffects
  on('pageFirstVisited', ({ pageId }) => triggerOnViewEffects(pageId))
}

/** 评估全部章节的 enterCondition，推进到第一个可进入且未进入的章节。 */
export function reevaluateChapters(): void {
  const store = getGameStore()
  if (store.finished) return

  const chapters = [...getAllChapters()].sort((a, b) => a.index - b.index)
  const current = chapters.find((c) => c.id === store.currentChapterId)
  const currentIndex = current ? current.index : -1

  for (const ch of chapters) {
    if (ch.index <= currentIndex) continue
    if (evaluateCondition(ch.enterCondition)) {
      enterChapter(ch.id)
      return
    }
  }
}

/**
 * 评估章节条件（递归 and）。
 * 重写后：线索注册机制已废，clueRegistered 永为 false（数据里也无人再用此条件）。
 */
export function evaluateCondition(cond: ChapterCondition): boolean {
  const store = getGameStore()
  switch (cond.kind) {
    case 'gameStart':
      return true
    case 'puzzleSolved':
      return store.solvedPuzzleIds.includes(cond.puzzleId)
    case 'evidenceCollected':
      return store.collectedEvidenceIds.includes(cond.evidenceId)
    case 'clueRegistered':
      // 重写后线索注册已废；registeredClueIds 已从 GameState 移除。
      // 数据层若仍含 clueRegistered 条件（实际无），按 false 处理。
      return false
    case 'and':
      return cond.conditions.every(evaluateCondition)
    default: {
      const _exhaustive: never = cond
      void _exhaustive
      return false
    }
  }
}

/** 进入章节：advanceChapter + onEnterEffects + 开场独白。 */
export function enterChapter(chapterId: ChapterId): void {
  const store = getGameStore()
  if (store.finished) return
  const fromId = store.currentChapterId
  // 避免重复进入同一章节（首次进入才有意义）
  if (fromId === chapterId && _shownMonologueChapters.has(chapterId)) return

  const chapter = getChapterById(chapterId)
  if (!chapter) return

  store.advanceChapter(chapterId)
  emit('chapterAdvanced', { fromChapterId: fromId, toChapterId: chapterId })

  // 执行进入副作用
  if (chapter.onEnterEffects && chapter.onEnterEffects.length > 0) {
    executeEffects(chapter.onEnterEffects)
  }

  // 开场独白（onlyOnce）
  if (chapter.introMonologueId && !_shownMonologueChapters.has(chapterId)) {
    _shownMonologueChapters.add(chapterId)
    // 独白内容由 loader.getMonologueById 读取；UI useChapter 订阅 chapterAdvanced + currentChapterId 渲染
    emit('chapterAdvanced', { fromChapterId: fromId, toChapterId: chapterId })
  }
}

/**
 * 页面首次查看：执行 WebPage.onViewEffects。
 * gameStore.visitPage 返回 true（首次）→ UI/App 调本函数。
 * 本函数从 loader 取页面（若未缓存则 await），执行 onViewEffects。
 */
export async function triggerOnViewEffects(pageId: PageId): Promise<void> {
  const store = getGameStore()
  if (store.finished) return
  const page: WebPage | undefined = await getPage(pageId)
  const effects: PuzzleEffect[] | undefined = page?.onViewEffects
  if (effects && effects.length > 0) {
    executeEffects(effects)
  }
}

/**
 * visitPage 总入口（UI/App 调用）：
 *  1. gameStore.visitPage 记录是否首次
 *  2. 首次 → emit pageFirstVisited（本 director 自动执行 onViewEffects）
 *  3. 调 ClueRegistry onView({ kind:'page', pageId })（线索"查看即取证"）
 *
 * 返回是否首次访问。
 */
export function visitPage(pageId: PageId): boolean {
  const store = getGameStore()
  const isFirst = store.visitPage(pageId)
  if (isFirst) {
    emit('pageFirstVisited', { pageId })
  }
  // onView 线索注册由 ClueRegistry 负责；此处不重复，UI 用 useClue().view({
  //   kind:'page', pageId
  // }) 统一调 ClueRegistry.onView。
  return isFirst
}

/** 查询当前章节开场独白是否已展示（onlyOnce 控制）。 */
export function isMonologueShown(chapterId: ChapterId): boolean {
  return _shownMonologueChapters.has(chapterId)
}

/** 重置（测试/新游戏用）。 */
export function resetChapterDirector(): void {
  _shownMonologueChapters.clear()
}
