/**
 * src/engine/store/persistence.ts
 *
 * persist 配置 + 版本迁移 + 自动存档节流（CLAUDE.md §2）。
 *
 * Zustand persist 柯里化形式（CLAUDE.md §2，强制）：
 *   create<T>()(persist(fn, { name, storage: createJSONStorage(() => localStorage) }))
 * partialize 只存 GameState 字段，不存 action / 临时派生态。
 *
 * 倒计时持久化 startedAt 时间戳而非剩余秒（§6.6），刷新后按 (now-startedAt) 算真实剩余。
 */

import { createJSONStorage } from 'zustand/middleware'
import type { PersistStorage, StorageValue } from 'zustand/middleware'
import type { GameState, ISODateString } from '@/types'

/** 存档版本号。每次 GameState 结构迁移需 +1 并补 migrate 迁移函数。 */
export const SAVE_VERSION = 1
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
 * 当前 version=1，无历史数据；预留 migrate 以便后续扩展结构时保持断点续玩。
 */
export function migrateGameState(persisted: unknown, version: number): GameState {
  // version 0 → 1：（初始版本，无前置结构变更）
  let v = version
  let s = persisted as Record<string, unknown>
  if (v < 1) {
    v = 1
    // 兜底补全字段，避免旧存档缺键运行时崩溃
    s = ensureGameStateShape(s)
  }
  return s as unknown as GameState
}

/** 补全 GameState 必需字段（迁移/补救用）。 */
export function ensureGameStateShape(s: Record<string, unknown>): Record<string, unknown> {
  const now = new Date().toISOString() as ISODateString
  const defaults: GameState = {
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
    visitedPages: [],
    visitedThreads: [],
    viewedMessages: [],
    viewedMoments: [],
    finished: false,
  }
  return { ...defaults, ...s }
}

/**
 * 自动存档节流：partialize 输出在写入 localStorage 前合并/限频。
 * Zustand persist 默认每次 state 变更都写盘；这里用写入节流避免高频 action（如 visitMessage）
 * 导致频繁 JSON.stringify。
 *
 * 用法：在 persist 配置里传 onRehydrateStorage 包装；节流由 store 内部 setUpdatedAt 控制。
 * 这里仅提供一个简单的时间窗口节流器，供 store 在高频 action 内调用。
 */
export class WriteThrottle {
  private lastWrite = 0
  private pending: (() => void) | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private minIntervalMs: number
  constructor(minIntervalMs = 800) {
    this.minIntervalMs = minIntervalMs
  }

  /** 立即写入（用于关键节点，如解谜、结局）。 */
  flushNow(fn: () => void): void {
    this.clear()
    fn()
    this.lastWrite = Date.now()
  }

  /** 节流写入：间隔未满则排队延后。 */
  throttled(fn: () => void): void {
    const now = Date.now()
    const elapsed = now - this.lastWrite
    if (elapsed >= this.minIntervalMs) {
      this.flushNow(fn)
      return
    }
    // 排队：保留最新 fn，到点执行一次
    this.pending = fn
    this.clear()
    this.timer = setTimeout(() => {
      if (this.pending) {
        const p = this.pending
        this.pending = null
        this.flushNow(p)
      }
    }, this.minIntervalMs - elapsed)
  }

  private clear(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}

/** 全局节流器单例（供 gameStore 高频 action 用）。 */
export const saveThrottle = new WriteThrottle(800)
