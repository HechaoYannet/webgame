/**
 * src/utils/time.ts
 *
 * 游戏内时间 & 倒计时计算（frontend-phone-shell 自有）。
 *
 * 设计（CLAUDE.md §6.6 + 交互设计 §二）：
 *  - 游戏内时间起点 2026-03-13 15:00（+08:00），现实时间 1x 递进，
 *    用于 StatusBar 假设系统时间。
 *  - 倒计时持久化 startedAt 时间戳（非剩余秒），刷新后按 (now-startedAt)
 *    算真实剩余；超时不可回退（§6.6）。本文件只做纯计算，持久化由 engine 负责。
 */

/** 游戏内时间起点：2026-03-13 15:00:00 +08:00。 */
export const GAME_START_ISO = '2026-03-13T15:00:00+08:00'
export const GAME_START_MS = Date.parse(GAME_START_ISO)

/** 把毫秒数格式化为 HH:mm（24h，无秒）。 */
export function formatClock(ms: number): string {
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/** 把秒数格式化为 mm:ss（倒计时用）；负数归零。 */
export function formatCountdown(secondsTotal: number): string {
  const s = Math.max(0, Math.floor(secondsTotal))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/**
 * 按 (now - startedAt) 计算倒计时真实剩余秒数。
 * @param startedAtIso 开始时间戳 ISO
 * @param durationSec 总时长秒
 * @param now 当前毫秒（可选，便于测试）
 * @returns 剩余秒数；<=0 表示已超时（返回 0）
 */
export function countdownRemainingSec(
  startedAtIso: string,
  durationSec: number,
  now: number = Date.now(),
): number {
  const started = Date.parse(startedAtIso)
  if (Number.isNaN(started)) return 0
  const elapsedSec = (now - started) / 1000
  return Math.max(0, durationSec - elapsedSec)
}

/** 倒计时是否已超时（剩余 <= 0）。 */
export function isCountdownExpired(
  startedAtIso: string,
  durationSec: number,
  now: number = Date.now(),
): boolean {
  return countdownRemainingSec(startedAtIso, durationSec, now) <= 0
}

/** 把 ISO 字符串格式化为 "MM-DD HH:mm" 简短显示（消息/通知时间）。 */
export function formatShortDateTime(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const d = new Date(t)
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${mo}-${da} ${hh}:${mm}`
}

/** 把 ISO 字符串格式化为 "HH:mm"（聊天列表最近消息）。 */
export function formatTimeOnly(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  return formatClock(t)
}
