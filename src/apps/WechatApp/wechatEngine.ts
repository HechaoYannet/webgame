/**
 * WechatApp/wechatEngine.ts — 微信侧极简转发层（迁移后）。
 *
 * 迁移后（玩家决策 2026-08-19：脱离 src/engine）：
 *  - useGameStore 改自 @/game/gameStore（极简结局状态机）。
 *  - 线索注册装饰机制废除：useClue 退化为 no-op，保留调用面以最小改动。
 *  - usePuzzle 不再走 engine PuzzleService.submit + EffectExecutor；改为
 *    checkAnswer(puzzleId, input) 校验 + useGameStore.getState().markPuzzleSolved 记录。
 *    "已解"判断 = useGameStore(solvedPuzzleIds.includes(id))。
 *  - 访问计数已废：useGameState 删除（不再追踪 visitedThreadIds）。
 *  - useNavigateToPage 保留：link.pageId 跳转走 @/sites/sitePage openSitePage(pageId)，
 *    签名不变（站内全屏站点路由新标签打开）。
 *  - useEngineBridge 空操作保留调用面（engine 已无回推事件）。
 *
 * 本文件仅做形状适配 + 命名统一，不持剧情/答案。
 */
import { useCallback } from 'react'
import { useGameStore } from '@/game/gameStore'
import { checkAnswer } from '@/game/answerCheck'
import { openSitePage } from '@/sites/sitePage'
import type { EvidenceId, PageId, PuzzleId, ThreadId } from '@/types'

/* ------------------------------------------------------------------ *
 * useClue —— 线索机制已废，no-op 保留调用面
 * ------------------------------------------------------------------ */

export interface ClueViewInput {
  kind: 'wechat-thread' | 'wechat-moment' | 'wechat-article'
  threadId?: ThreadId
  messageId?: string
  momentId?: string
  articleId?: string
  pageId?: PageId
}

export interface ClueApi {
  /** no-op：线索注册装饰已废，查看不再触发任何副作用。 */
  view: (input: ClueViewInput) => void
  /** 恒空（线索机制已废）。 */
  knownClueIds: readonly never[]
}

export function useClue(): ClueApi {
  const view = useCallback((_input: ClueViewInput) => {
    // 线索注册已废：查看不写状态、不收集证据、不截图。
  }, [])
  return { view, knownClueIds: [] }
}

/* ------------------------------------------------------------------ *
 * usePuzzle —— 论文 AI 解读上传（checkAnswer + markPuzzleSolved）
 * ------------------------------------------------------------------ */

export interface PuzzleSubmitInput {
  /** uploadAndInterpret 的"答案"是文件 assetId（puzzles.json 中 answer 即文件名）。 */
  answer?: string
  assetId?: string
  text?: string
}

export interface PuzzleApi {
  /**
   * 调 checkAnswer(puzzleId, value) 校验；通过则 markPuzzleSolved 记录已解。
   * 不再触发任何副作用（收集证据/推进章节由各自 App 显式调用 useGameStore action）。
   * 本组件不持答案，答案在 puzzles.json。
   */
  submit: (puzzleId: PuzzleId, payload?: PuzzleSubmitInput) => void
  /** 引擎实际收集到的证据 ID（useGameStore.collectedEvidenceIds 真源，只读）。 */
  collectedEvidenceIds: readonly EvidenceId[]
  /** puzzleId 是否已解（历史接口：曾驱动 isGeneratedContent 文章渲染；该机制已废弃）。 */
  isSolved: (puzzleId: PuzzleId) => boolean
}

export function usePuzzle(): PuzzleApi {
  const collectedEvidenceIds = useGameStore((s) => s.collectedEvidenceIds)
  // 订阅 solvedPuzzleIds 使 isSolved 在渲染期同步且响应式。
  const solvedPuzzleIds = useGameStore((s) => s.solvedPuzzleIds)
  const submit = useCallback((puzzleId: PuzzleId, payload?: PuzzleSubmitInput) => {
    const value = payload?.answer ?? payload?.assetId ?? payload?.text ?? ''
    const ok = checkAnswer(puzzleId, value)
    if (ok) {
      useGameStore.getState().markPuzzleSolved(puzzleId)
    }
  }, [])
  const isSolved = useCallback(
    (puzzleId: PuzzleId) => solvedPuzzleIds.includes(puzzleId),
    [solvedPuzzleIds],
  )
  return { submit, collectedEvidenceIds, isSolved }
}

/* ------------------------------------------------------------------ *
 * navigateToPage —— link.pageId 跳转（§6.4）：openSitePage 新标签打开站点根
 * ------------------------------------------------------------------ */

export function useNavigateToPage(): (pageId: PageId, fromThread?: ThreadId) => void {
  // 重写后：BrowserApp 已移除，调查网页走全屏站点路由新标签（openSitePage）。
  return useCallback((pageId: PageId, _fromThread?: ThreadId) => {
    openSitePage(pageId)
  }, [])
}

/* ------------------------------------------------------------------ *
 * useEngineBridge —— engine 直连后无副作用，空 hook 保留调用面。
 * ------------------------------------------------------------------ */

export function useEngineBridge(): void {
  // no-op
}
