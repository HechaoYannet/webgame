/**
 * src/engine/store/gameStore.ts
 *
 * 游戏运行态（Zustand 5 persist 柯里化形式，CLAUDE.md §2 强制）。
 *
 * 对外暴露**语义化 action**（CLAUDE.md §4.2）：
 *   solvePuzzle(id) / registerClue(id) / collectEvidence(id) / addRisk(n) /
 *   removeRisk(n) / attemptPuzzle(id) / visitPage(id) / visitThread(id) /
 *   viewMessage(id) / viewMoment(id) / startCountdown(id, sec) / expireCountdown(id) /
 *   advanceChapter(id) / completeObjective(id) / pushEnding(id) / resetGame()
 *
 * App 组件不直接改 state 字段，全经这些 action 收口。
 *
 * 关键约束：
 *  - 倒计时持久化 startedAt 时间戳（非剩余秒，§6.6），刷新后按 (now-startedAt) 算真实剩余。
 *  - 倒计时归零 / 风险满 100 → bad 结局不可回退：pushEnding 后 finished=true，所有 action no-op。
 *  - addRisk >=100 触发 bad（由 RiskService 调用本 store）。
 *  - visitPage 首次记录某 pageId 时触发本 store 的 onPageFirstVisit 钩子（ChapterDirector 监听执行 onViewEffects）。
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  ChapterId,
  ClueId,
  EndingId,
  EvidenceId,
  GameState,
  ISODateString,
  PageId,
  PuzzleId,
  ThreadId,
} from '@/types'
import { SAVE_KEY, SAVE_VERSION, ensureGameStateShape } from './persistence'

function newGameState(): GameState {
  const now = new Date().toISOString() as ISODateString
  return {
    saveId: `save-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    version: '1',
    currentChapterId: 'ch-prologue',
    completedObjectives: [],
    solvedPuzzleIds: [],
    puzzleAttempts: {},
    unlockedPageIds: [],
    unlockedThreadIds: [],
    unlockedAssetIds: [],
    registeredClueIds: [],
    collectedEvidenceIds: [],
    risk: 0,
    countdowns: {},
    shownHintIds: [],
    lastHintAt: undefined,
    visitedPages: [],
    visitedThreads: [],
    viewedMessages: [],
    viewedMoments: [],
    endingId: undefined,
    finished: false,
  }
}

/** 首次访问页面事件的 payload（供 ChapterDirector 监听执行 onViewEffects）。 */
export interface PageFirstVisitEvent {
  pageId: PageId
  /** 由本 store 在 action 层挂上的 effects，调用方（ChapterDirector）消费。 */
  pendingOnViewEffects: boolean
}

export interface GameStoreState extends GameState {
  // ===== actions =====
  /** 记录一次谜题尝试（无论成败）。返回当前该谜题累计错误次数。 */
  attemptPuzzle: (puzzleId: PuzzleId) => number
  /** 标记谜题已解：加 solvedPuzzleIds、解锁关联 thread/page/asset、注册关联证据。返回是否首次解。 */
  solvePuzzle: (puzzleId: PuzzleId, opts?: { unlockedThreadIds?: ThreadId[]; unlockedPageIds?: PageId[]; unlockedAssetIds?: string[]; registerEvidenceIds?: EvidenceId[]; completeObjectiveId?: string }) => boolean
  /** 注册线索（查看即取证）。返回是否首次注册。 */
  registerClue: (clueId: ClueId) => boolean
  /** 收集证据。返回是否首次收集。 */
  collectEvidence: (evidenceId: EvidenceId) => boolean
  /** 完成目标。 */
  completeObjective: (objectiveId: string) => void
  /** 加风险（n 可负）。返回新风险值。 */
  addRisk: (n: number) => number
  /** 减风险。 */
  removeRisk: (n: number) => number
  /** 直接设置风险值（RiskService 内部用，钳到 0..100）。 */
  setRisk: (n: number) => number
  /** 记录访问页面。返回是否首次访问（true 时 ChapterDirector 应执行 onViewEffects）。 */
  visitPage: (pageId: PageId) => boolean
  /** 记录访问会话。返回是否首次访问。 */
  visitThread: (threadId: ThreadId) => boolean
  /** 记录查看消息。返回是否首次查看。 */
  viewMessage: (messageId: string) => boolean
  /** 记录查看朋友圈/QQ空间动态。返回是否首次查看。 */
  viewMoment: (momentId: string) => boolean
  /** 启动倒计时（持久化 startedAt 时间戳）。若已存在同 id 且未过期则不覆盖（避免重置）。 */
  startCountdown: (id: string, durationSec: number) => void
  /** 标记倒计时已过期（不可回退，§6.6）。 */
  expireCountdown: (id: string) => void
  /** 推进章节。 */
  advanceChapter: (chapterId: ChapterId) => void
  /** 推送结局（不可回退：设 finished=true）。 */
  pushEnding: (endingId: EndingId) => void
  /** 显示提示后记录。 */
  markHintShown: (hintId: string) => void
  /** 解锁 asset。 */
  unlockAsset: (assetId: string) => void
  /** 解锁 page（手动，非解谜路径）。 */
  unlockPage: (pageId: PageId) => void
  /** 解锁 thread（手动）。 */
  unlockThread: (threadId: ThreadId) => void
  /** 重置存档。 */
  resetGame: () => void
  /** 仅读取当前态（便于非 React 上下文）。 */
  getState: () => GameState
}

export const useGameStore = create<GameStoreState>()(
  persist(
    (set, get) => ({
      ...newGameState(),

      attemptPuzzle: (puzzleId) => {
        let next = 0
        set((s) => {
          const cur = s.puzzleAttempts[puzzleId] ?? 0
          next = cur + 1
          return {
            puzzleAttempts: { ...s.puzzleAttempts, [puzzleId]: next },
            updatedAt: new Date().toISOString() as ISODateString,
          }
        })
        return next
      },

      solvePuzzle: (puzzleId, opts) => {
        const before = get().solvedPuzzleIds
        const alreadySolved = before.includes(puzzleId)
        set((s) => {
          const solvedPuzzleIds = alreadySolved ? s.solvedPuzzleIds : [...s.solvedPuzzleIds, puzzleId]
          const unlockedThreadIds = opts?.unlockedThreadIds
            ? Array.from(new Set([...s.unlockedThreadIds, ...opts.unlockedThreadIds]))
            : s.unlockedThreadIds
          const unlockedPageIds = opts?.unlockedPageIds
            ? Array.from(new Set([...s.unlockedPageIds, ...opts.unlockedPageIds]))
            : s.unlockedPageIds
          const unlockedAssetIds = opts?.unlockedAssetIds
            ? Array.from(new Set([...s.unlockedAssetIds, ...opts.unlockedAssetIds]))
            : s.unlockedAssetIds
          const collectedEvidenceIds = opts?.registerEvidenceIds
            ? Array.from(new Set([...s.collectedEvidenceIds, ...opts.registerEvidenceIds]))
            : s.collectedEvidenceIds
          const completedObjectives = opts?.completeObjectiveId
            ? Array.from(new Set([...s.completedObjectives, opts.completeObjectiveId]))
            : s.completedObjectives
          return {
            solvedPuzzleIds,
            unlockedThreadIds,
            unlockedPageIds,
            unlockedAssetIds,
            collectedEvidenceIds,
            completedObjectives,
            updatedAt: new Date().toISOString() as ISODateString,
          }
        })
        return !alreadySolved
      },

      registerClue: (clueId) => {
        const exists = get().registeredClueIds.includes(clueId)
        if (exists) return false
        set((s) => ({
          registeredClueIds: [...s.registeredClueIds, clueId],
          updatedAt: new Date().toISOString() as ISODateString,
        }))
        return true
      },

      collectEvidence: (evidenceId) => {
        const exists = get().collectedEvidenceIds.includes(evidenceId)
        if (exists) return false
        set((s) => ({
          collectedEvidenceIds: [...s.collectedEvidenceIds, evidenceId],
          updatedAt: new Date().toISOString() as ISODateString,
        }))
        return true
      },

      completeObjective: (objectiveId) => {
        set((s) => ({
          completedObjectives: Array.from(new Set([...s.completedObjectives, objectiveId])),
          updatedAt: new Date().toISOString() as ISODateString,
        }))
      },

      addRisk: (n) => {
        let val = get().risk
        set((s) => {
          val = Math.max(0, Math.min(100, s.risk + n))
          return { risk: val, updatedAt: new Date().toISOString() as ISODateString }
        })
        return val
      },

      removeRisk: (n) => get().addRisk(-n),

      setRisk: (n) => {
        const val = Math.max(0, Math.min(100, n))
        set(() => ({ risk: val, updatedAt: new Date().toISOString() as ISODateString }))
        return val
      },

      visitPage: (pageId) => {
        const exists = get().visitedPages.includes(pageId)
        if (exists) return false
        set((s) => ({
          visitedPages: [...s.visitedPages, pageId],
          updatedAt: new Date().toISOString() as ISODateString,
        }))
        return true
      },

      visitThread: (threadId) => {
        const exists = get().visitedThreads.includes(threadId)
        if (exists) return false
        set((s) => ({
          visitedThreads: [...s.visitedThreads, threadId],
          updatedAt: new Date().toISOString() as ISODateString,
        }))
        return true
      },

      viewMessage: (messageId) => {
        const exists = get().viewedMessages.includes(messageId)
        if (exists) return false
        set((s) => ({
          viewedMessages: [...s.viewedMessages, messageId],
          updatedAt: new Date().toISOString() as ISODateString,
        }))
        return true
      },

      viewMoment: (momentId) => {
        const exists = get().viewedMoments.includes(momentId)
        if (exists) return false
        set((s) => ({
          viewedMoments: [...s.viewedMoments, momentId],
          updatedAt: new Date().toISOString() as ISODateString,
        }))
        return true
      },

      startCountdown: (id, durationSec) => {
        const existing = get().countdowns[id]
        // 已存在且未过期 → 不覆盖（避免重置已开始的倒计时，§6.6）
        if (existing && !existing.expired) return
        set((s) => ({
          countdowns: {
            ...s.countdowns,
            [id]: {
              startedAt: new Date().toISOString() as ISODateString,
              durationSec,
              expired: false,
            },
          },
          updatedAt: new Date().toISOString() as ISODateString,
        }))
      },

      expireCountdown: (id) => {
        set((s) => {
          const c = s.countdowns[id]
          if (!c) return s
          // 一旦过期不可回退
          return {
            countdowns: { ...s.countdowns, [id]: { ...c, expired: true } },
            updatedAt: new Date().toISOString() as ISODateString,
          }
        })
      },

      advanceChapter: (chapterId) => {
        set(() => ({ currentChapterId: chapterId, updatedAt: new Date().toISOString() as ISODateString }))
      },

      pushEnding: (endingId) => {
        // 不可回退：一旦 finished，后续 pushEnding 忽略
        if (get().finished) return
        set(() => ({
          endingId,
          finished: true,
          updatedAt: new Date().toISOString() as ISODateString,
        }))
      },

      markHintShown: (hintId) => {
        set((s) => ({
          shownHintIds: Array.from(new Set([...s.shownHintIds, hintId])),
          lastHintAt: new Date().toISOString() as ISODateString,
          updatedAt: new Date().toISOString() as ISODateString,
        }))
      },

      unlockAsset: (assetId) => {
        set((s) => ({
          unlockedAssetIds: Array.from(new Set([...s.unlockedAssetIds, assetId])),
          updatedAt: new Date().toISOString() as ISODateString,
        }))
      },

      unlockPage: (pageId) => {
        set((s) => ({
          unlockedPageIds: Array.from(new Set([...s.unlockedPageIds, pageId])),
          updatedAt: new Date().toISOString() as ISODateString,
        }))
      },

      unlockThread: (threadId) => {
        set((s) => ({
          unlockedThreadIds: Array.from(new Set([...s.unlockedThreadIds, threadId])),
          updatedAt: new Date().toISOString() as ISODateString,
        }))
      },

      resetGame: () => {
        set(() => ({ ...newGameState() }))
      },

      getState: () => {
        const s = get()
        // 剥离 actions，只返回 GameState 字段
        const {
          attemptPuzzle: _a, solvePuzzle: _b, registerClue: _c, collectEvidence: _d,
          completeObjective: _e, addRisk: _f, removeRisk: _g, setRisk: _h, visitPage: _i,
          visitThread: _j, viewMessage: _k, viewMoment: _l, startCountdown: _m,
          expireCountdown: _n, advanceChapter: _o, pushEnding: _p, markHintShown: _q,
          unlockAsset: _r, unlockPage: _s2, unlockThread: _t, resetGame: _u, getState: _v,
          ...rest
        } = s
        return rest as GameState
      },
    }),
    {
      name: SAVE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: SAVE_VERSION,
      // 只存 GameState 字段（partialize 自动剥离函数；这里显式构造保证干净）
      partialize: (s) => {
        const {
          attemptPuzzle: _a, solvePuzzle: _b, registerClue: _c, collectEvidence: _d,
          completeObjective: _e, addRisk: _f, removeRisk: _g, setRisk: _h, visitPage: _i,
          visitThread: _j, viewMessage: _k, viewMoment: _l, startCountdown: _m,
          expireCountdown: _n, advanceChapter: _o, pushEnding: _p, markHintShown: _q,
          unlockAsset: _r, unlockPage: _s2, unlockThread: _t, resetGame: _u, getState: _v,
          ...rest
        } = s
        return rest as unknown as GameState
      },
      migrate: (persisted, _version) => {
        // 迁移：补全/升级 GameState 结构
        const base = (persisted ?? {}) as Record<string, unknown>
        return ensureGameStateShape(base) as unknown as GameStoreState
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // 重水合后兜底：保证 GameState 字段齐全
        const ensured = ensureGameStateShape(state as unknown as Record<string, unknown>)
        Object.assign(state, ensured)
      },
    },
  ),
)

/** 非 React 上下文用（services 内调用 action）。 */
export function getGameStore(): GameStoreState {
  return useGameStore.getState()
}

/** 计算某倒计时的真实剩余秒（§6.6：按 now-startedAt 算，非存剩余秒）。 */
export function getRemainingSec(countdownId: string, now: number = Date.now()): number {
  const c = useGameStore.getState().countdowns[countdownId]
  if (!c) return 0
  if (c.expired) return 0
  const startedAtMs = new Date(c.startedAt).getTime()
  const elapsed = Math.max(0, (now - startedAtMs) / 1000)
  return Math.max(0, c.durationSec - elapsed)
}

/** 是否有活跃（未过期且剩余>0）倒计时。 */
export function hasActiveCountdown(countdownId: string, now: number = Date.now()): boolean {
  const c = useGameStore.getState().countdowns[countdownId]
  if (!c || c.expired) return false
  return getRemainingSec(countdownId, now) > 0
}
