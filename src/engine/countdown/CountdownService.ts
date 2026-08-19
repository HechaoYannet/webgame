/**
 * src/engine/countdown/CountdownService.ts
 *
 * 倒计时服务（CLAUDE.md §6.6 + SCHEMA.md §13）。
 *
 * 关键设计：
 *  - 持久化 startedAt 时间戳（非剩余秒），刷新后按 (now-startedAt) 算真实剩余。
 *  - tick 节流（默认 250ms）：UI 用 useCountdown 订阅。
 *  - 到期触发 EndingTrigger.countdownExpired → bad 结局，不可回退。
 *
 * 终章场景：page-lab-funding-report.onViewEffects.startCountdown(180s, countdown-finale)
 * 与 sms-zhangqiang-threat、doorbell-dao-visit、audio-heartbeat 同步触发。
 */

import { getGameStore, getRemainingSec, hasActiveCountdown } from '@/engine/store/gameStore'
import { emit } from '@/engine/eventBus'

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
  const store = getGameStore()
  store.startCountdown(id, durationSec)
  emit('countdownStarted', { countdownId: id, durationSec })
}

/** 标记过期并尝试触发对应 bad 结局。 */
export function expireCountdown(id: string): void {
  const store = getGameStore()
  const c = store.countdowns[id]
  if (!c || c.expired) return
  store.expireCountdown(id)
  emit('countdownExpired', { countdownId: id })

  // 倒计时归零 → bad 结局不可回退（§6.6）。
  // 通过 endings.json 反查 trigger.kind==='countdownExpired' && countdownId===id 的 ending。
  // 这里直接 push bad（本项目唯一倒计时 countdown-finale 对应 bad 结局）。
  // 多倒计时场景：loader.getEndingById 反查 trigger；当前只有 bad。
  store.pushEnding('bad')
  emit('endingPushed', { endingId: 'bad' })
}

/** 查询某倒计时信息（含真实剩余秒）。 */
export function getCountdownInfo(id: string, now: number = Date.now()): CountdownInfo | null {
  const store = getGameStore()
  const c = store.countdowns[id]
  if (!c) return null
  const remainingSec = getRemainingSec(id, now)
  return {
    id,
    remainingSec,
    durationSec: c.durationSec,
    expired: c.expired,
    progress: c.durationSec > 0 ? remainingSec / c.durationSec : 0,
  }
}

/** 真实剩余秒（同 store.getRemainingSec，便于 service 层封装）。 */
export function getRemaining(id: string, now: number = Date.now()): number {
  return getRemainingSec(id, now)
}

/** 是否激活（剩余>0 且未过期）。 */
export function isActive(id: string, now: number = Date.now()): boolean {
  return hasActiveCountdown(id, now)
}

/** 是否已过期。 */
export function isExpired(id: string): boolean {
  const c = getGameStore().countdowns[id]
  return c?.expired ?? false
}

/**
 * tick：每帧/定时调用，检测倒计时归零。
 * UI 的 useCountdown hook 内部 setInterval 调本函数；归零自动 expire。
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
