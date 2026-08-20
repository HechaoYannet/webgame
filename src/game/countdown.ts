/**
 * src/game/countdown.ts
 *
 * 倒计时算术（搬迁自 src/engine/countdown/CountdownService.ts，剥离 pushEnding 耦合）。
 *
 * 重写后（玩家决策 2026-08-19）：
 *   - 倒计时不再由网页 onViewEffects 触发，改由手机内"启动举报倒计时"动作触发。
 *   - 倒计时仅内存（partialize 不落盘）：刷新即清，危机解除——彻底修掉"刷新即坏结局"。
 *   - **expireCountdown 仅标记过期，不再直写 pushEnding('bad')**（旧版耦合在此）。
 *     倒计时归零 → 本模块标记 expired，由手机外壳监听 expired 变化调 pushEnding('bad')。
 *     单一职责：倒计时模块不管结局。
 *
 * 唯一倒计时 id：countdown-finale（终章 3 分钟）。
 */
import { useGameStore, type CountdownEntry } from './gameStore'

export interface CountdownInfo {
  id: string
  remainingSec: number
  durationSec: number
  expired: boolean
  /** 进度 0..1（remaining/duration，UI 进度条用）。 */
  progress: number
}

/** 启动倒计时（store 内部已防重复：未过期的同 id 不覆盖）。 */
export function startCountdown(id: string, durationSec: number): void {
  useGameStore.getState().startCountdown(id, durationSec)
}

/** 标记过期（不可回退）。注意：不在此触发结局——由手机外壳监听后调 pushEnding。 */
export function expireCountdown(id: string): void {
  const store = useGameStore.getState()
  const c = store.countdowns?.[id]
  if (!c || c.expired) return
  store.expireCountdown(id)
}

/** 取某倒计时条目原始数据。 */
export function getCountdownEntry(id: string): CountdownEntry | undefined {
  return useGameStore.getState().countdowns?.[id]
}

/** 计算真实剩余秒（按 now-startedAt 算，非存剩余秒）。 */
export function getRemaining(id: string, now: number = Date.now()): number {
  const c = useGameStore.getState().countdowns?.[id]
  if (!c) return 0
  if (c.expired) return 0
  const startedAtMs = new Date(c.startedAt).getTime()
  const elapsed = Math.max(0, (now - startedAtMs) / 1000)
  return Math.max(0, c.durationSec - elapsed)
}

/** 是否激活（剩余>0 且未过期）。 */
export function isActive(id: string, now: number = Date.now()): boolean {
  const c = useGameStore.getState().countdowns?.[id]
  if (!c || c.expired) return false
  return getRemaining(id, now) > 0
}

/** 是否已过期。 */
export function isExpired(id: string): boolean {
  const c = useGameStore.getState().countdowns?.[id]
  return c?.expired ?? false
}

/** 查询某倒计时信息（含真实剩余秒 + 进度）。 */
export function getCountdownInfo(id: string, now: number = Date.now()): CountdownInfo | null {
  const c = useGameStore.getState().countdowns?.[id]
  if (!c) return null
  const remainingSec = getRemaining(id, now)
  return {
    id,
    remainingSec,
    durationSec: c.durationSec,
    expired: c.expired,
    progress: c.durationSec > 0 ? remainingSec / c.durationSec : 0,
  }
}

/**
 * tick：定时调用，检测倒计时归零。
 * UI 的 useCountdown hook 内部 setInterval 调本函数；归零自动 expire（仅标记，结局由外壳推）。
 */
export function tick(id: string, now: number = Date.now()): CountdownInfo | null {
  const info = getCountdownInfo(id, now)
  if (!info) return null
  if (info.remainingSec <= 0 && !info.expired) {
    expireCountdown(id)
    return { ...info, expired: true, remainingSec: 0, progress: 0 }
  }
  return info
}
