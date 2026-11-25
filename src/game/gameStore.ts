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
  /** 勾选/取消勾选证据（历史遗留接口；现由 collectEvidence 自动归档）。 */
  toggleEvidence: (id: EvidenceId) => void
  /** 收集证据（查看关键内容自动归档；幂等）。 */
  collectEvidence: (id: EvidenceId) => void
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

// ===== 跨标签同步（E2E-1 修复）=====
// 真网站以「新标签页」打开：每个标签页各持一份 zustand 内存快照。若不合并，
// 手机标签页会用旧快照覆盖网页侧刚归档的证据（实测：QQ 登录一次就把
// collectedEvidenceIds 抹回空数组）。这里对 localStorage 的 storage 事件做
// 「并集合并」——证据/已解谜题取并集，章节取更靠后，结局不可回退——再写回。
// 合并幂等：收敛后 sameCheckpoint 为真，不再写回，不会死循环。
// 清档用 BroadcastChannel 显式广播（并集合并无法表达"删除"）。

const CHAPTER_RANK: Record<string, number> = {
  'ch-prologue': 0,
  'ch-1': 1,
  'ch-2': 2,
  'ch-3': 3,
  'ch-4': 4,
  'ch-5': 5,
  'ch-finale': 6,
}

function chapterRank(id: string | undefined): number {
  return CHAPTER_RANK[id ?? ''] ?? 0
}

function unionIds(a: readonly string[] | undefined, b: readonly string[] | undefined): string[] {
  const s = new Set<string>(a ?? [])
  for (const x of b ?? []) s.add(x)
  return Array.from(s)
}

/** 合并两份检查点：并集 + 取更靠后的章节 + 结局不可回退。导出供测试。 */
export function mergeCheckpoints(cur: MinimalCheckpoint, incoming: MinimalCheckpoint): MinimalCheckpoint {
  const curCh = cur.currentChapterId ?? 'ch-prologue'
  const incCh = incoming.currentChapterId ?? 'ch-prologue'
  return {
    collectedEvidenceIds: unionIds(cur.collectedEvidenceIds, incoming.collectedEvidenceIds),
    solvedPuzzleIds: unionIds(cur.solvedPuzzleIds, incoming.solvedPuzzleIds),
    currentChapterId: chapterRank(incCh) > chapterRank(curCh) ? incCh : curCh,
    endingId: cur.endingId ?? incoming.endingId,
    finished: Boolean(cur.finished) || Boolean(incoming.finished),
  }
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

function sameCheckpoint(a: MinimalCheckpoint, b: MinimalCheckpoint): boolean {
  return (
    a.finished === b.finished &&
    a.endingId === b.endingId &&
    a.currentChapterId === b.currentChapterId &&
    sameIds(a.collectedEvidenceIds, b.collectedEvidenceIds) &&
    sameIds(a.solvedPuzzleIds, b.solvedPuzzleIds)
  )
}

function isEmptyCheckpoint(cp: MinimalCheckpoint): boolean {
  return cp.collectedEvidenceIds.length === 0 && cp.solvedPuzzleIds.length === 0 && !cp.finished
}

const SYNC_CHANNEL = 'webgame-sync'
const syncChannel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(SYNC_CHANNEL) : null

/** 解析 persist 写入的 { state, version } 包装（兼容裸对象）。 */
function readPersistedState(raw: string | null): unknown {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && 'state' in (parsed as Record<string, unknown>)) {
      return (parsed as Record<string, unknown>).state
    }
    return parsed
  } catch {
    return null
  }
}

/** 把远端检查点并入本地（并集合并；空检查点视为清档）。导出供测试。 */
export function applyRemoteCheckpoint(raw: unknown): void {
  if (raw === null || raw === undefined) return
  const incoming = ensureCheckpointShape(raw)
  if (isEmptyCheckpoint(incoming)) {
    if (!isEmptyCheckpoint(useGameStore.getState())) useGameStore.getState().resetGame()
    return
  }
  const cur = useGameStore.getState()
  const merged = mergeCheckpoints(cur, incoming)
  if (sameCheckpoint(cur, merged)) return
  useGameStore.setState(merged)
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

      collectEvidence: (id) => {
        set((s) => {
          if (s.collectedEvidenceIds.includes(id)) return s
          return { collectedEvidenceIds: [...s.collectedEvidenceIds, id] }
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
        // 广播清档：并集合并无法删除，必须显式通知其它标签页。
        syncChannel?.postMessage({ type: 'reset' })
      },

      getState: () => {
        const s = get()
        const {
          toggleEvidence: _a, collectEvidence: _a2, markPuzzleSolved: _b, advanceChapter: _c,
          startCountdown: _d, expireCountdown: _e, pushEnding: _f, resetGame: _g, getState: _h,
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
          toggleEvidence: _a, collectEvidence: _a2, markPuzzleSolved: _b, advanceChapter: _c,
          startCountdown: _d, expireCountdown: _e, pushEnding: _f, resetGame: _g, getState: _h,
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

// ===== 跨标签事件接线（模块加载即生效，每个标签页一次）=====
if (typeof window !== 'undefined') {
  // storage 事件只在「其它」标签页触发（写入方自己收不到），正好用作远端通知。
  window.addEventListener('storage', (e) => {
    if (e.key !== SAVE_KEY) return
    if (e.newValue === null) {
      if (!isEmptyCheckpoint(useGameStore.getState())) useGameStore.getState().resetGame()
      return
    }
    applyRemoteCheckpoint(readPersistedState(e.newValue))
  })
}

syncChannel?.addEventListener('message', (e: MessageEvent) => {
  const data = e.data as { type?: string } | null
  if (data?.type === 'reset') {
    if (!isEmptyCheckpoint(useGameStore.getState())) useGameStore.getState().resetGame()
  }
})
