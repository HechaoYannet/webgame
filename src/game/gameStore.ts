/**
 * src/game/gameStore.ts
 *
 * 极简结局状态机（玩家决策 2026-08-19："保留极简结局状态机"）。
 *
 * 取代旧引擎 gameStore（ChapterDirector/RiskService/ClueRegistry/EffectExecutor/PuzzleService
 * 已废）。本 store 只承载三件事：
 *   1. 证据清单（荣誉制勾选）——终章勾选 ≥5 关键证据→真结局。
 *   2. 3 分钟倒计时 countdowns（仅内存，不落盘）——归零→坏结局。
 *   3. 已解谜题（仅推进剧情，如 QQ 登录→解锁 QQ 会话消息出现）+ 当前章节（消息出现时间表）+ 结局。
 *
 * 持久化只存检查点 MinimalCheckpoint（5 字段）。倒计时内存态：刷新即清，
 * 彻底修掉"刷新即坏结局"。pushEnding 不可逆（finished=true 后所有动作 no-op）。
 *
 * Zustand 5 柯里化 persist（CLAUDE.md §2 强制）。
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ChapterId, EndingId, EvidenceId, ISODateString, PuzzleId } from '@/types'
import {
  SAVE_KEY,
  SAVE_VERSION,
  migrateGameState,
  ensureCheckpointShape,
  type MinimalCheckpoint,
} from './persistence'

/** 倒计时条目（内存态）。startedAt=ISO 字符串，durationSec=总秒，expired=是否归零。 */
export interface CountdownEntry {
  startedAt: ISODateString
  durationSec: number
  expired: boolean
}

/** 运行态：检查点字段 + 内存态倒计时。 */
export interface GameState extends MinimalCheckpoint {
  /** 内存态：倒计时。partialize 不输出 → 刷新清空。 */
  countdowns?: Record<string, CountdownEntry>
}

export interface GameStoreState extends GameState {
  // ===== actions =====
  /** 勾选/取消勾选证据（荣誉制）。 */
  toggleEvidence: (id: EvidenceId) => void
  /** 标记谜题已解（仅剧情推进，如 QQ 登录）。返回是否首次。 */
  markPuzzleSolved: (puzzleId: PuzzleId) => boolean
  /** 推进章节（由收集关键证据驱动，不改 App/页面可见性）。 */
  advanceChapter: (chapterId: ChapterId) => void
  /** 启动倒计时（仅写内存；未过期的同 id 不覆盖）。 */
  startCountdown: (id: string, durationSec: number) => void
  /** 标记倒计时过期（不可回退；不在此触发结局）。 */
  expireCountdown: (id: string) => void
  /** 推送结局（不可回退：设 finished=true）。 */
  pushEnding: (endingId: EndingId) => void
  /** 重置存档。 */
  resetGame: () => void
  /** 非 React 上下文读运行态。 */
  getState: () => GameState
}

function newGameState(): GameState {
  return {
    collectedEvidenceIds: [],
    solvedPuzzleIds: [],
    currentChapterId: 'ch-prologue',
    endingId: undefined,
    finished: false,
    // 内存态
    countdowns: {},
  }
}

export const useGameStore = create<GameStoreState>()(
  persist(
    (set, get) => ({
      ...newGameState(),

      toggleEvidence: (id) => {
        set((s) => {
          const has = s.collectedEvidenceIds.includes(id)
          return {
            collectedEvidenceIds: has
              ? s.collectedEvidenceIds.filter((x) => x !== id)
              : [...s.collectedEvidenceIds, id],
          }
        })
      },

      markPuzzleSolved: (puzzleId) => {
        const already = get().solvedPuzzleIds.includes(puzzleId)
        if (!already) {
          set((s) => ({ solvedPuzzleIds: [...s.solvedPuzzleIds, puzzleId] }))
        }
        return !already
      },

      advanceChapter: (chapterId) => {
        set(() => ({ currentChapterId: chapterId }))
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
          return { countdowns: { ...(s.countdowns ?? {}), [id]: { ...c, expired: true } } }
        })
      },

      pushEnding: (endingId) => {
        // 不可回退
        if (get().finished) return
        set(() => ({ endingId, finished: true }))
      },

      resetGame: () => {
        set(() => ({ ...newGameState() }))
      },

      getState: () => {
        const s = get()
        const {
          toggleEvidence: _a, markPuzzleSolved: _b, advanceChapter: _c, startCountdown: _d,
          expireCountdown: _e, pushEnding: _f, resetGame: _g, getState: _h,
          ...rest
        } = s
        return rest as GameState
      },
    }),
    {
      name: SAVE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: SAVE_VERSION,
      // 持久化只存检查点 MinimalCheckpoint：剥离 actions 与内存态 countdowns。
      partialize: (s) => {
        const {
          toggleEvidence: _a, markPuzzleSolved: _b, advanceChapter: _c, startCountdown: _d,
          expireCountdown: _e, pushEnding: _f, resetGame: _g, getState: _h,
          countdowns: _cd,
          ...rest
        } = s
        return rest
      },
      migrate: (persisted, version) => {
        const cp = migrateGameState(persisted, version)
        return ensureCheckpointShape(cp) as unknown as GameStoreState
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // 重水合后兜底：保证检查点字段齐全、不残留旧引擎 risk/clue/unlocked 字段。
        const ensured = ensureCheckpointShape(state as unknown as Record<string, unknown>)
        Object.assign(state, { ...ensured, countdowns: {} })
      },
    },
  ),
)

/** 非 React 上下文用（countdown/evidence 等模块内调 action）。 */
export function getGameStore(): GameStoreState {
  return useGameStore.getState()
}
