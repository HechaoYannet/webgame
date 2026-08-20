/**
 * src/game/persistence.ts
 *
 * 存档持久化配置 + 版本迁移（搬迁自 src/engine/store/persistence.ts，精简）。
 *
 * Zustand 5 柯里化 persist：create<T>()(persist(fn, { name, storage: createJSONStorage(() => localStorage) }))。
 *
 * 玩家决策 2026-08-19：只存检查点（collectedEvidenceIds / solvedPuzzleIds /
 * currentChapterId / endingId / finished），易变态字段（倒计时）不落盘——
 * 彻底修掉"刷新即坏结局"（旧版倒计时 startedAt 落盘，刷新续算到 0 触发 bad）。
 */
import { createJSONStorage } from 'zustand/middleware'
import type { PersistStorage, StorageValue } from 'zustand/middleware'
import type { EndingId } from '@/types'

/** 存档版本号。结构迁移时 +1 并补 migrate。 */
export const SAVE_VERSION = 3
export const SAVE_KEY = 'webgame-save'
export const SETTINGS_KEY = 'webgame-settings'

/** localStorage 适配器（柯里化 persist 要求 storage: PersistStorage）。 */
export const localStorageStorage: PersistStorage<unknown> = {
  getItem: (name): StorageValue<unknown> | null => {
    const raw = localStorage.getItem(name)
    if (!raw) return null
    try {
      return JSON.parse(raw) as StorageValue<unknown>
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, JSON.stringify(value))
    } catch (e) {
      // 配额满 / 无痕模式：静默降级，不阻塞游戏
      console.warn('[persistence] localStorage 写入失败，降级为内存态', e)
    }
  },
  removeItem: (name) => {
    localStorage.removeItem(name)
  },
}

/** 向后兼容地用 createJSONStorage(() => localStorage)。 */
export const jsonStorage = createJSONStorage(() => localStorage)

/** v2→v3 迁移：剥离旧引擎残留字段（risk / clue / unlocked* / visited* / viewed* /
 *  shownHintIds / completedObjectives / puzzleAttempts / countdowns），只留极简检查点。 */
const CHECKPOINT_KEYS = [
  'collectedEvidenceIds',
  'solvedPuzzleIds',
  'currentChapterId',
  'endingId',
  'finished',
] as const

export interface MinimalCheckpoint {
  collectedEvidenceIds: string[]
  solvedPuzzleIds: string[]
  currentChapterId: string
  endingId?: EndingId
  finished: boolean
}

/** 逐级迁移到当前版本。 */
export function migrateGameState(persisted: unknown, version: number): MinimalCheckpoint {
  const s = (persisted ?? {}) as Record<string, unknown>
  void version // 旧版本统一走 strip；保留参数供将来细粒度迁移
  return ensureCheckpointShape(stripToCheckpoint(s))
}

function stripToCheckpoint(s: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of CHECKPOINT_KEYS) {
    if (k in s) out[k] = s[k]
  }
  return out
}

/** 补全检查点必需字段（接受任意形状输入，回填缺省值）。 */
export function ensureCheckpointShape(s: unknown): MinimalCheckpoint {
  const input = (s ?? {}) as Record<string, unknown>
  const defaults: MinimalCheckpoint = {
    collectedEvidenceIds: [],
    solvedPuzzleIds: [],
    currentChapterId: 'ch-prologue',
    endingId: undefined,
    finished: false,
  }
  return { ...defaults, ...input } as MinimalCheckpoint
}
