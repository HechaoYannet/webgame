/**
 * src/engine/store/persistence.ts
 *
 * persist 配置 + 版本迁移（CLS 重写：玩家决策 2026-08-19）。
 *
 * Zustand persist 柯里化形式（CLAUDE.md §2，强制）：
 *   create<T>()(persist(fn, { name, storage: createJSONStorage(() => localStorage) }))
 *
 * 重写后的进度模型（玩家决策）：持久化只存检查点 PersistedCheckpoint，
 * 易变态字段（倒计时/查看记录/已显提示）不落盘——彻底修掉"刷新即坏结局"
 * （旧版把 countdowns.startedAt 落盘，刷新续算到 0 即触发 bad）。
 *
 * 倒计时不再持久化 startedAt：改为内存态，由页面首访 onViewEffects 每会话重新触发。
 */

import { createJSONStorage } from 'zustand/middleware'
import type { PersistStorage, StorageValue } from 'zustand/middleware'
import type { ISODateString, PersistedCheckpoint } from '@/types'

/** 存档版本号。每次 GameState 结构迁移需 +1 并补 migrate 迁移函数。
 *  v1→v2：移除风险值系统 + 线索注册装饰 + 持久化改为检查点子集（易变态字段不再落盘）。 */
export const SAVE_VERSION = 2
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

/** 向后兼容地用 createJSONStorage(()=>localStorage)（Zustand 5 推荐用法）。 */
export const jsonStorage = createJSONStorage(() => localStorage)

/**
 * GameState 迁移：当存档 version < 当前版本时逐级迁移。
 *  v0→v1：（初始版本，无前置结构变更）
 *  v1→v2：移除风险值/线索注册/易变态字段——只保留检查点子集 PersistedCheckpoint。
 */
export function migrateGameState(persisted: unknown, version: number): PersistedCheckpoint {
  let v = version
  let s = (persisted ?? {}) as Record<string, unknown>
  if (v < 1) {
    v = 1
  }
  if (v < 2) {
    // v1→v2：剥离废弃/易变态字段（risk / registeredClueIds / countdowns /
    // visited* / viewed* / shownHintIds），只留检查点。
    s = stripToCheckpoint(s)
    v = 2
  }
  return ensureGameStateShape(s)
}

/** v1→v2 迁移：只保留 PersistedCheckpoint 字段。 */
function stripToCheckpoint(s: Record<string, unknown>): Record<string, unknown> {
  const KEEP = [
    'saveId', 'createdAt', 'updatedAt', 'version', 'currentChapterId',
    'completedObjectives', 'solvedPuzzleIds', 'puzzleAttempts',
    'unlockedPageIds', 'unlockedThreadIds', 'unlockedAssetIds',
    'collectedEvidenceIds', 'endingId', 'finished',
  ] as const
  const out: Record<string, unknown> = {}
  for (const k of KEEP) {
    if (k in s) out[k] = s[k]
  }
  return out
}

/** 补全 PersistedCheckpoint 必需字段（迁移/补救用）。返回检查点形态。 */
export function ensureGameStateShape(s: Record<string, unknown>): PersistedCheckpoint {
  const now = new Date().toISOString() as ISODateString
  const defaults: PersistedCheckpoint = {
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
    endingId: undefined,
    finished: false,
  }
  return { ...defaults, ...s } as PersistedCheckpoint
}

// （重写后）已移除 WriteThrottle / saveThrottle：
// 重写后不再有高频 action（visit/view 系列已废，落盘只在解谜/取证/结局等关键节点），
// zustand persist 在这些低频动作上直接写盘即可，无需节流。
