/**
 * src/engine/store/gameStore.ts
 *
 * 游戏运行态（Zustand 5 persist 柯里化形式，CLAUDE.md §2 强制）。
 *
 * 重写后（玩家决策 2026-08-19）：
 *  - 持久化只存检查点 PersistedCheckpoint（章节/已解谜题/已收集证据/解锁/结局）。
 *  - 易变态字段（countdowns / visited* / viewed* / shownHintIds）只在内存，partialize 不输出。
 *  - 已移除：风险值（risk/addRisk/removeRisk/setRisk）、线索注册（registerClue/registeredClueIds）、
 *    访问计数类 action（visitPage/visitThread/viewMessage/viewMoment —— "查看即取证"装饰已废，
 *    查看不再写状态；页面首访效果改由 usePageViewEffects hook 触发）。
 *
 * 对外暴露**语义化 action**：solvePuzzle / collectEvidence / attemptPuzzle /
 * advanceChapter / startCountdown / expireCountdown / pushEnding / unlockAsset /
 * unlockPage / unlockThread / completeObjective / markHintShown / resetGame。
 *
 * 关键约束：
 *  - 倒计时只存内存（不再落盘 startedAt）：刷新后 countdowns={} → 无活跃倒计时 → 不会触发坏结局。
 *  - 倒计时归零 → bad 结局不可回退：pushEnding 后 finished=true，所有 action no-op。
 *  - expireCountdown 由 CountdownService 调，store 本身不判定结局（保持单一职责）。
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

/** 运行态默认值（含易变态字段，全部留内存）。 */
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
    collectedEvidenceIds: [],
    // 易变态（内存）
    countdowns: {},
    shownHintIds: [],
    visitedPages: [],
    visitedThreads: [],
    viewedMessages: [],
    viewedMoments: [],
    endingId: undefined,
    finished: false,
  }
}

export interface GameStoreState extends GameState {
  // ===== actions =====
  /** 记录一次谜题尝试（无论成败）。返回当前该谜题累计错误次数。 */
  attemptPuzzle: (puzzleId: PuzzleId) => number
  /** 标记谜题已解：加 solvedPuzzleIds、解锁关联 thread/page/asset、收集关联证据。返回是否首次解。 */
  solvePuzzle: (puzzleId: PuzzleId, opts?: { unlockedThreadIds?: ThreadId[]; unlockedPageIds?: PageId[]; unlockedAssetIds?: string[]; registerEvidenceIds?: EvidenceId[]; completeObjectiveId?: string }) => boolean
  /** 收集证据。返回是否首次收集。 */
  collectEvidence: (evidenceId: EvidenceId) => boolean
  /** 完成目标。 */
  completeObjective: (objectiveId: string) => void
  /** 记录访问页面（纯内存，不落盘；返回是否首次以供调用方决定是否触发 onViewEffects）。 */
  visitPage: (pageId: PageId) => boolean
  /** 记录访问会话（纯内存）。返回是否首次。 */
  visitThread: (threadId: ThreadId) => boolean
  /** 记录查看消息（纯内存）。返回是否首次。 */
  viewMessage: (messageId: string) => boolean
  /** 记录查看朋友圈/QQ空间动态（纯内存）。返回是否首次。 */
  viewMoment: (momentId: string) => boolean
  /** 启动倒计时（仅写内存）。若已存在同 id 且未过期则不覆盖。 */
  startCountdown: (id: string, durationSec: number) => void
  /** 标记倒计时已过期（不可回退）。 */
  expireCountdown: (id: string) => void
  /** 推进章节。 */
  advanceChapter: (chapterId: ChapterId) => void
  /** 推送结局（不可回退：设 finished=true）。 */
  pushEnding: (endingId: EndingId) => void
  /** 显示提示后记录（纯内存）。 */
  markHintShown: (hintId: string) => void
  /** 解锁 asset。 */
  unlockAsset: (assetId: string) => void
  /** 解锁 page（手动，非解谜路径）。 */
  unlockPage: (pageId: PageId) => void
  /** 解锁 thread（手动）。 */
  unlockThread: (threadId: ThreadId) => void
  /** 重置存档。 */
  resetGame: () => void
  /** 仅读取当前运行态（便于非 React 上下文）。 */
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

      visitPage: (pageId) => {
        const exists = (get().visitedPages ?? []).includes(pageId)
        if (exists) return false
        set((s) => ({ visitedPages: [...(s.visitedPages ?? []), pageId] }))
        return true
      },

      visitThread: (threadId) => {
        const exists = (get().visitedThreads ?? []).includes(threadId)
        if (exists) return false
        set((s) => ({ visitedThreads: [...(s.visitedThreads ?? []), threadId] }))
        return true
      },

      viewMessage: (messageId) => {
        const exists = (get().viewedMessages ?? []).includes(messageId)
        if (exists) return false
        set((s) => ({ viewedMessages: [...(s.viewedMessages ?? []), messageId] }))
        return true
      },

      viewMoment: (momentId) => {
        const exists = (get().viewedMoments ?? []).includes(momentId)
        if (exists) return false
        set((s) => ({ viewedMoments: [...(s.viewedMoments ?? []), momentId] }))
        return true
      },

      startCountdown: (id, durationSec) => {
        const existing = get().countdowns?.[id]
        // 已存在且未过期 → 不覆盖（避免重置已开始的倒计时）
        if (existing && !existing.expired) return
        set((s) => ({
          countdowns: {
            ...(s.countdowns ?? {}),
            [id]: {
              startedAt: new Date().toISOString() as ISODateString,
              durationSec,
              expired: false,
            },
          },
        }))
      },

      expireCountdown: (id) => {
        set((s) => {
          const c = s.countdowns?.[id]
          if (!c) return s
          // 一旦过期不可回退
          return {
            countdowns: { ...(s.countdowns ?? {}), [id]: { ...c, expired: true } },
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
          shownHintIds: Array.from(new Set([...(s.shownHintIds ?? []), hintId])),
          lastHintAt: new Date().toISOString() as ISODateString,
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
          attemptPuzzle: _a, solvePuzzle: _b, collectEvidence: _c, completeObjective: _d,
          visitPage: _e, visitThread: _f, viewMessage: _g, viewMoment: _h, startCountdown: _i,
          expireCountdown: _j, advanceChapter: _k, pushEnding: _l, markHintShown: _m,
          unlockAsset: _n, unlockPage: _o, unlockThread: _p, resetGame: _q, getState: _r,
          ...rest
        } = s
        return rest as GameState
      },
    }),
    {
      name: SAVE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: SAVE_VERSION,
      // 持久化只存检查点 PersistedCheckpoint：剥离 actions 与易变态字段（countdowns/visited*/viewed*/shownHintIds）。
      // 易变态字段留在内存态但不落盘 → 刷新后回到检查点，倒计时不会"续算到 0 触发 bad"。
      partialize: (s) => {
        const {
          attemptPuzzle: _a, solvePuzzle: _b, collectEvidence: _c, completeObjective: _d,
          visitPage: _e, visitThread: _f, viewMessage: _g, viewMoment: _h, startCountdown: _i,
          expireCountdown: _j, advanceChapter: _k, pushEnding: _l, markHintShown: _m,
          unlockAsset: _n, unlockPage: _o, unlockThread: _p, resetGame: _q, getState: _r,
          countdowns: _cd, shownHintIds: _sh, visitedPages: _vp, visitedThreads: _vt,
          viewedMessages: _vm, viewedMoments: _vw, lastHintAt: _lh,
          ...rest
        } = s
        return rest
      },
      migrate: (persisted, _version) => {
        // 迁移：补全/升级到检查点结构（v1→v2 移除 risk/clue/易变态字段）
        const base = (persisted ?? {}) as Record<string, unknown>
        return ensureGameStateShape(base) as unknown as GameStoreState
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // 重水合后兜底：保证检查点字段齐全；易变态字段用内存默认值（已由 newGameState 兜底，
        // 但 rehydrate 会覆盖部分字段，这里确保不残留旧版 risk/registeredClueIds）。
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

/** 计算某倒计时的真实剩余秒（按 now-startedAt 算，非存剩余秒）。 */
export function getRemainingSec(countdownId: string, now: number = Date.now()): number {
  const c = useGameStore.getState().countdowns?.[countdownId]
  if (!c) return 0
  if (c.expired) return 0
  const startedAtMs = new Date(c.startedAt).getTime()
  const elapsed = Math.max(0, (now - startedAtMs) / 1000)
  return Math.max(0, c.durationSec - elapsed)
}

/** 是否有活跃（未过期且剩余>0）倒计时。 */
export function hasActiveCountdown(countdownId: string, now: number = Date.now()): boolean {
  const c = useGameStore.getState().countdowns?.[countdownId]
  if (!c || c.expired) return false
  return getRemainingSec(countdownId, now) > 0
}

// 保留 ClueId/EndingId 类型 re-export 给旧调用点（部分 action 签名已不带，但外部类型引用仍存在）。
export type { ClueId, EndingId}
