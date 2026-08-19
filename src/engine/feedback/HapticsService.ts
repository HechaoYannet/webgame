/**
 * src/engine/feedback/HapticsService.ts
 *
 * 震动反馈（CLAUDE.md agent 定义 §feedback）。
 * 移动端用 navigator.vibrate；桌面无震动能力时降级为 CSS 抖动 className（由 UI 监听 vibrate 事件加）。
 *
 * 受 settingsStore.vibrationEnabled 控制。
 */

import { getSettings } from '@/engine/store/settingsStore'

export type VibratePattern = 'short' | 'long' | 'double'

const PATTERN_MS: Record<VibratePattern, number | number[]> = {
  short: 30,
  long: 400,
  double: [50, 80, 50],
}

function canVibrateApi(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/** 触发震动。pattern 默认 'short'。 */
export function vibrate(pattern: VibratePattern = 'short'): void {
  const settings = getSettings()
  if (!settings.vibrationEnabled) return
  if (canVibrateApi()) {
    try {
      navigator.vibrate(PATTERN_MS[pattern])
    } catch {
      // 忽略权限/异常
    }
  }
  // 桌面降级：让 UI 监听后给 PhoneShell 加一个抖动 className（emit 'vibrate' 事件已通过 EffectExecutor.vibrate 触发）
  // 这里不再单独 emit，避免重复——vibrate 行为由调用方/EffectExecutor 统一 emit
}
