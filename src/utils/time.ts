/**
 * src/utils/time.ts
 *
 * 游戏内时间 & 倒计时计算（frontend-phone-shell 自有）。
 *
 * 设计（CLAUDE.md §6.6 + 交互设计 §二）：
 *  - 游戏内时间起点 2026-03-13 15:00（+08:00），现实时间 1x 递进，
 *    用于 StatusBar 假设系统时间。
 *  - 倒计时按 (now-startedAt) 算真实剩余，不落盘。
 *
 * 2026-08 修订（审核报告 2.E「时间格式五套并存」/「通知横幅用真实系统时间」）：
 *  - 所有游戏内时间显示统一按 +08:00 换算（gameParts），不随玩家机器本地时区漂移。
 *  - 统一出口：formatClock / formatGameTime / formatGameDate / formatGameDay /
 *    formatGameDateCn / formatShortDateTime；各 App 不再各写一套 fmt*。
 */

/** 游戏内时间起点：2026-03-13 15:00:00 +08:00。 */
export const GAME_START_ISO = '2026-03-13T15:00:00+08:00'
export const GAME_START_MS = Date.parse(GAME_START_ISO)

/** 本模块加载时刻 = 游戏内时钟的会话起点（刷新后从 15:00 重新起算）。 */
export const GAME_SESSION_START_MS = Date.now()

/** 游戏内「现在」的毫秒（起点 + 已流逝的真实时间）。通知横幅等用它，
 *  避免把玩家的真实系统日期印在手机上（出戏）。 */
export function gameNowMs(): number {
  return GAME_START_MS + (Date.now() - GAME_SESSION_START_MS)
}

/** 游戏时区偏移（+08:00）。所有游戏内时间显示统一按此换算，
 *  同一时间戳在任何机器上都显示同一游戏时刻（修掉时区漂移）。 */
const GAME_TZ_OFFSET_MIN = 8 * 60
const TZ_MS = GAME_TZ_OFFSET_MIN * 60_000

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

interface GameParts {
  month: number
  day: number
  hour: number
  minute: number
}

/** 把任意时刻统一换算成游戏时区（+08:00）的月/日/时/分。 */
function gameParts(ms: number): GameParts {
  const d = new Date(ms + TZ_MS)
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() }
}

/** 把毫秒数格式化为 HH:mm（游戏时区 +08:00，24h，无秒）。 */
export function formatClock(ms: number): string {
  const p = gameParts(ms)
  return pad2(p.hour) + ':' + pad2(p.minute)
}

/** 把秒数格式化为 mm:ss（倒计时用）；负数归零。 */
export function formatCountdown(secondsTotal: number): string {
  const s = Math.max(0, Math.floor(secondsTotal))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return pad2(m) + ':' + pad2(sec)
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

/** ISO → "MM-DD HH:mm"（游戏时区）。通知横幅 / 聊天列表最近消息。 */
export function formatShortDateTime(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const p = gameParts(t)
  return pad2(p.month) + '-' + pad2(p.day) + ' ' + pad2(p.hour) + ':' + pad2(p.minute)
}

/** ISO → "MM/DD"（游戏时区）。短信列表日期。 */
export function formatGameDate(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const p = gameParts(t)
  return pad2(p.month) + '/' + pad2(p.day)
}

/** ISO → "MM-DD"（游戏时区）。消息日期分隔条。 */
export function formatGameDay(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const p = gameParts(t)
  return pad2(p.month) + '-' + pad2(p.day)
}

/** ISO → "MM月DD日"（游戏时区）。 */
export function formatGameDateCn(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const p = gameParts(t)
  return p.month + '月' + p.day + '日'
}

/** ISO → "HH:mm"（游戏时区）。会话气泡 / 列表时间。 */
export function formatGameTime(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  return formatClock(t)
}

/** 兼容别名（历史调用方）：等价 formatGameTime。 */
export function formatTimeOnly(iso: string): string {
  return formatGameTime(iso)
}

/** 毫秒 → "YYYY-MM-DD HH:mm:ss"（游戏时区）。监控画面角标等需要"秒级盖章"的场景。 */
export function formatGameFullStamp(ms: number): string {
  const d = new Date(ms + TZ_MS)
  return (
    d.getUTCFullYear() +
    '-' +
    pad2(d.getUTCMonth() + 1) +
    '-' +
    pad2(d.getUTCDate()) +
    ' ' +
    pad2(d.getUTCHours()) +
    ':' +
    pad2(d.getUTCMinutes()) +
    ':' +
    pad2(d.getUTCSeconds())
  )
}
