/**
 * WechatApp/wechatEngine.ts — 直接对接 @/engine/hooks 的微信侧适配层。
 *
 * 背景（CLAUDE.md §3 / §4）：本 App 原 src/apps/WechatApp/engine.ts 是 Phase4 早期
 * frontend-engine 尚未落地时的 CustomEvent 桥接降级层——查看消息/朋友圈/文章只标记本地
 * 已读、派发 window 事件，不进 engine ClueRegistry，因此不触发线索本/证据自动收集/截图/
 * 备忘录连锁。该桥接层已删除，本文件替代它，所有副作用直接走 engine 真源。
 *
 * 职责（仅做形状适配，不持任何剧情/答案/线索表）：
 *  1. useClue —— 暴露 `view({kind:"wechat-thread"|"wechat-moment"|"wechat-article",...})`
 *     调用形态（与 src/types ClueSource.kind 对齐，组件调用面不变），内部映射到 engine
 *     useClue().view 的 ViewPayload（kind:"message"|"moment"|"article"）——ClueRegistry 查
 *     data/clustering/clue-map.json 决定注册哪条线索 + 关联证据收集 + 截图入相册 + 备忘录
 *     + toast（CLAUDE.md §6.4 / §4.2）。
 *  2. usePuzzle —— 按 puzzleId 封装 engine usePuzzle，供论文 AI 解读上传调用
 *     `submit("puzzle-upload-paper")`；引擎据 puzzles.json answer="paper-source-crystal.pdf"
 *     判定 + 执行 onSuccess（collectEvidence ev-paper-pdf + registerClue +
 *     advanceChapter ch-5，CLAUDE.md §6.5）。
 *  3. useGameState —— visitThread / viewMoment 走 engine gameStore（visitedThreads /
 *     viewedMoments 真源）；UI 局部 state（当前查看的 thread、朋友圈滚动位置等）保留。
 *  4. navigateToPage —— link.pageId 站内跳转（CLAUDE.md §6.4）：react-router push 到
 *     浏览器 App 并透传 pageId（sessionStorage 轻传递，模仿 openNewsApp 模式）。
 *
 * 见 src/utils/shellState.ts 的适配模式：engine hooks 是真源，本文件只做命名/形状统一。
 */
import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useClue as useEngineClue } from '@/engine/hooks/useClue'
import { useGameStore } from '@/engine/store/gameStore'
import type { ClueId, EvidenceId, PageId, PuzzleId, ThreadId } from '@/types'
import type { ViewPayload } from '@/data/loader'

/* ------------------------------------------------------------------ *
 * useClue —— ClueSource.kind 调用形态 → engine ViewPayload
 * ------------------------------------------------------------------ */

/** 组件侧调用形态（与 src/types ClueSource.kind 一一对应，便于复用现有调用点）。 */
export interface ClueViewInput {
  kind: 'wechat-thread' | 'wechat-moment' | 'wechat-article'
  threadId?: ThreadId
  messageId?: string
  momentId?: string
  articleId?: string
  // PageId 仅在 link 跳转用，此处保留以兼容旧调用面（不产生线索查看）
  pageId?: PageId
}

export interface ClueApi {
  /** 查看关键消息/朋友圈/文章 → engine ClueRegistry 查表决定注册线索/收集证据。 */
  view: (input: ClueViewInput) => void
  /** 已注册线索 ID（engine gameStore.registeredClueIds 真源，只读）。 */
  knownClueIds: readonly ClueId[]
}

/** 把微信侧 ClueViewInput 映射到 engine ViewPayload（数据层按 kind 查 clue-map）。 */
function toViewPayload(input: ClueViewInput): ViewPayload {
  switch (input.kind) {
    case 'wechat-thread':
      return { kind: 'message', threadId: input.threadId, messageId: input.messageId }
    case 'wechat-moment':
      return { kind: 'moment', momentId: input.momentId }
    case 'wechat-article':
      return { kind: 'article', articleId: input.articleId }
  }
}

export function useClue(): ClueApi {
  const clue = useEngineClue()
  const view = useCallback(
    (input: ClueViewInput) => {
      // engine useClue().view 内部查 clue-map.json：注册线索 + 关联证据 onView 收集 +
      // ScreenshotService 截图入相册 + 写备忘录 + toast。fire-and-forget（async，不阻塞 UI）。
      void clue.view(toViewPayload(input), null)
    },
    [clue],
  )
  return { view, knownClueIds: clue.registeredClueIds }
}

/* ------------------------------------------------------------------ *
 * usePuzzle —— 按 puzzleId 封装（论文 AI 解读用）
 * ------------------------------------------------------------------ */

export interface PuzzleSubmitInput {
  /** uploadAndInterpret 的"答案"是文件 assetId（puzzles.json 中 answer 即文件名）。 */
  answer?: string
  assetId?: string
  text?: string
}

export interface PuzzleApi {
  /**
   * 提交一个谜题。CLAUDE.md §6.5 论文 AI 解读：本 App 只负责"调 submit"，
   * 引擎据 puzzles.json answer 判定 + 执行 onSuccess（collectEvidence/registerClue/
   * advanceChapter）；不持答案、不自己生成文章内容。
   */
  submit: (puzzleId: PuzzleId, payload?: PuzzleSubmitInput) => void
  /** 引擎实际收集到的证据 ID（engine gameStore.collectedEvidenceIds 真源，只读）。 */
  collectedEvidenceIds: readonly EvidenceId[]
  /** puzzleId 是否已解（驱动 isGeneratedContent 文章渲染，CLAUDE.md §6.5）。 */
  isSolved: (puzzleId: PuzzleId) => boolean
}

export function usePuzzle(): PuzzleApi {
  const collectedEvidenceIds = useGameStore((s) => s.collectedEvidenceIds)
  const view = useCallback(
    (puzzleId: PuzzleId, payload?: PuzzleSubmitInput) => {
      // engine usePuzzle 是 hook-bound（需 puzzleId）；submit 走顶层 PuzzleService 直接调用。
      // 这里通过动态 import 避免引入额外 hook 参数约束，保持调用面与旧 bridge 一致。
      const value = payload?.answer ?? payload?.assetId ?? payload?.text ?? ''
      void submitPuzzleDirect(puzzleId, value)
    },
    [],
  )
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
    // 引擎或数据未就绪：静默，绝不破坏 UI（与 shellState.triggerClueView 同策略）
  }
}

/* ------------------------------------------------------------------ *
 * useGameState —— visitThread / viewMoment 走 engine gameStore 真源
 * ------------------------------------------------------------------ */

export interface GameStateApi {
  /** 标记会话已进入（engine visitedThreads，首次派发 pageFirstVisited 等连锁）。 */
  openThread: (threadId: ThreadId) => void
  /** 标记朋友圈已查看（engine viewedMoments）。 */
  viewMoment: (momentId: string) => void
  /** 已访问会话 ID（engine 真源，只读）。 */
  visitedThreadIds: readonly ThreadId[]
  viewedMomentIds: readonly string[]
}

export function useGameState(): GameStateApi {
  const visitedThreadIds = useGameStore((s) => s.visitedThreads)
  const viewedMomentIds = useGameStore((s) => s.viewedMoments)
  const openThread = useCallback((threadId: ThreadId) => {
    useGameStore.getState().visitThread(threadId)
  }, [])
  const viewMoment = useCallback((momentId: string) => {
    useGameStore.getState().viewMoment(momentId)
  }, [])
  return { openThread, viewMoment, visitedThreadIds, viewedMomentIds }
}

/* ------------------------------------------------------------------ *
 * navigateToPage —— link.pageId 站内跳转（CLAUDE.md §6.4）
 * ------------------------------------------------------------------ */

/** 站内伪造页跳转 hook：react-router push 到浏览器 App 并透传 pageId（sessionStorage 轻传递，
 *  模仿 openNewsApp 模式）。CLAUDE.md §6.4：link.pageId 存在则站内跳转，否则只显示 url 不外跳。 */
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
 * useEngineBridge —— 兼容旧调用面，现 engine 直连无需桥接；保留空 hook 不破坏调用点。
 * ------------------------------------------------------------------ */

/** 原桥接层监听引擎回推的占位 hook；engine 直连后无副作用，保留以兼容 WechatApp.tsx 调用。 */
export function useEngineBridge(): void {
  // engine hooks 自带事件订阅（useClue/useEvidence/useChapter 内部 on(clueRegistered) 等），
  // 本 App 无需额外绑定 window 事件桥接。空实现，保持调用点零改动。
}
