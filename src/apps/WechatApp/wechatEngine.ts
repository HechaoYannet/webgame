/**
 * WechatApp/wechatEngine.ts — 微信侧 engine 适配层（重写后）。
 *
 * 重写后（玩家决策 2026-08-19）：
 *  - 线索注册装饰机制（ClueRegistry）整体废除：useClue 退化为 no-op。查看消息/朋友圈/文章
 *    不再注册线索/自动收集证据/截图入相册。5 项关键证据全部由 puzzle.onSuccess.collectEvidence
 *    产出，故线索机制删除不影响任何结局可达性。
 *  - 访问计数（visitThread/viewMoment）不再持久化、纯本地 UI 态（且无副作用）；为最小改动，
 *    useGameState 的 openThread/viewMoment 退化为 no-op，返回空数组。
 *  - usePuzzle 保留（论文 AI 解读上传走 PuzzleService.submit → onSuccess.collectEvidence ev-paper-pdf
 *    + advanceChapter ch-5）。
 *  - useNavigateToPage 暂保留原伪浏览器跳转实现；Phase 5 改为真浏览器新标签页（公开页）/ 框内路由（状态页）。
 *
 * 本文件仅做形状适配 + 命名统一，不持剧情/答案。
 */
import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useGameStore } from '@/engine/store/gameStore'
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
 * usePuzzle —— 论文 AI 解读上传（保留）
 * ------------------------------------------------------------------ */

export interface PuzzleSubmitInput {
  /** uploadAndInterpret 的"答案"是文件 assetId（puzzles.json 中 answer 即文件名）。 */
  answer?: string
  assetId?: string
  text?: string
}

export interface PuzzleApi {
  /** 调 engine PuzzleService.submit；引擎据 puzzles.json answer 判定 + 执行 onSuccess（collectEvidence/advanceChapter）。不持答案。 */
  submit: (puzzleId: PuzzleId, payload?: PuzzleSubmitInput) => void
  /** 引擎实际收集到的证据 ID（engine gameStore.collectedEvidenceIds 真源，只读）。 */
  collectedEvidenceIds: readonly EvidenceId[]
  /** puzzleId 是否已解（驱动 isGeneratedContent 文章渲染，CLAUDE.md §6.5）。 */
  isSolved: (puzzleId: PuzzleId) => boolean
}

export function usePuzzle(): PuzzleApi {
  const collectedEvidenceIds = useGameStore((s) => s.collectedEvidenceIds)
  const view = useCallback((puzzleId: PuzzleId, payload?: PuzzleSubmitInput) => {
    const value = payload?.answer ?? payload?.assetId ?? payload?.text ?? ''
    void submitPuzzleDirect(puzzleId, value)
  }, [])
  const isSolved = useCallback(
    (puzzleId: PuzzleId) => useGameStore.getState().solvedPuzzleIds.includes(puzzleId),
    [],
  )
  return { submit: view, collectedEvidenceIds, isSolved }
}

/** 直接调用 engine PuzzleService.submit（非 hook 路径，供 usePuzzle().submit 使用）。 */
async function submitPuzzleDirect(puzzleId: PuzzleId, value: string): Promise<void> {
  try {
    const { submit } = await import('@/engine/puzzle/PuzzleService')
    submit(puzzleId, value)
  } catch {
    // 引擎或数据未就绪：静默，绝不破坏 UI
  }
}

/* ------------------------------------------------------------------ *
 * useGameState —— 访问计数已废（不持久化、无副作用），no-op 保留调用面
 * ------------------------------------------------------------------ */

export interface GameStateApi {
  /** no-op（访问计数已废，不再有连锁副作用）。 */
  openThread: (threadId: ThreadId) => void
  /** no-op。 */
  viewMoment: (momentId: string) => void
  /** 恒空数组（不再追踪）。 */
  visitedThreadIds: readonly ThreadId[]
  viewedMomentIds: readonly string[]
}

export function useGameState(): GameStateApi {
  const openThread = useCallback((_threadId: ThreadId) => {
    // 访问计数已废：不再写 gameStore（visitThread 也已改为纯内存且无副作用，这里直接 no-op）。
  }, [])
  const viewMoment = useCallback((_momentId: string) => {
    // 同上。
  }, [])
  return { openThread, viewMoment, visitedThreadIds: [], viewedMomentIds: [] }
}

/* ------------------------------------------------------------------ *
 * navigateToPage —— link.pageId 跳转（§6.4）
 * Phase 5 将改为：公开页 window.open 真标签页；状态页 hash 路由到 IntranetApp。
 * ------------------------------------------------------------------ */

export function useNavigateToPage(): (pageId: PageId, fromThread?: ThreadId) => void {
  const navigate = useNavigate()
  return useCallback(
    (pageId: PageId, _fromThread?: ThreadId) => {
      // 跨 App 站内跳转契约：pageId 经 sessionStorage 透传给 BrowserApp（轻量、刷新即失效）。
      try {
        sessionStorage.setItem('webgame-browser-pending-page', pageId)
      } catch {
        // 无痕模式忽略
      }
      // HashRouter：navigate 走 hash 段，CLAUDE.md §2 强制。
      navigate(`/app/browser?pageId=${encodeURIComponent(pageId)}`)
    },
    [navigate],
  )
}

/* ------------------------------------------------------------------ *
 * useEngineBridge —— engine 直连后无副作用，空 hook 保留调用面。
 * ------------------------------------------------------------------ */

export function useEngineBridge(): void {
  // no-op
}
