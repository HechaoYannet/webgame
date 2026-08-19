/**
 * src/engine/feedback/AlertService.ts
 *
 * 全屏警告覆盖 PhoneShell + toast（CLAUDE.md agent 定义 §feedback）。
 *
 * - fullscreenAlert(text)：覆盖 PhoneShell 的全屏告警层（如倒计时红边告警）
 * - toast(text)：顶部短消息（线索/证据收集反馈）
 *
 * 状态用极轻量内部 store（不落 localStorage，刷新即清），UI useAlert/useToast 订阅。
 */

import { emit } from '@/engine/eventBus'

export interface FullscreenAlertState {
  id: number
  text: string
  variant: 'info' | 'warning' | 'danger'
  visible: boolean
}

let _alert: FullscreenAlertState = { id: 0, text: '', variant: 'info', visible: false }
const _alertListeners = new Set<(a: FullscreenAlertState) => void>()

let _toasts: { id: number; text: string; variant?: 'info' | 'success' | 'warning' | 'danger' }[] = []
const _toastListeners = new Set<(t: { id: number; text: string; variant?: 'info' | 'success' | 'warning' | 'danger' }[]) => void>()

let _seq = 0
function nextId(): number {
  _seq += 1
  return _seq
}

/** 全屏告警。variant 由调用方根据上下文选（默认 danger 配合倒计时）。 */
export function fullscreenAlert(text: string, variant: 'info' | 'warning' | 'danger' = 'danger'): void {
  _alert = { id: nextId(), text, variant, visible: true }
  _alertListeners.forEach((fn) => fn(_alert))
  emit('vibrate' as never, {} as never) // 触发震屏副作用（vibrate 事件由 phone-shell 监听做 CSS 抖动）
}

/** 关闭全屏告警。 */
export function dismissFullscreenAlert(): void {
  _alert = { ..._alert, visible: false }
  _alertListeners.forEach((fn) => fn(_alert))
}

/** 推 toast。 */
export function toast(text: string, variant: 'info' | 'success' | 'warning' | 'danger' = 'info'): void {
  const t = { id: nextId(), text, variant }
  _toasts = [..._toasts, t]
  _toastListeners.forEach((fn) => fn(_toasts))
  // 3.5s 后自动移除
  setTimeout(() => {
    _toasts = _toasts.filter((x) => x.id !== t.id)
    _toastListeners.forEach((fn) => fn(_toasts))
  }, 3500)
}

/** 一次推多条 toast。 */
export function toastAll(texts: string[], variant: 'info' | 'success' | 'warning' | 'danger' = 'info'): void {
  for (const t of texts) toast(t, variant)
}

export function getFullscreenAlert(): FullscreenAlertState {
  return _alert
}

export function getToasts(): readonly { id: number; text: string; variant?: 'info' | 'success' | 'warning' | 'danger' }[] {
  return _toasts
}

export function subscribeFullscreenAlert(fn: (a: FullscreenAlertState) => void): () => void {
  _alertListeners.add(fn)
  return () => _alertListeners.delete(fn)
}

export function subscribeToasts(fn: (t: { id: number; text: string; variant?: 'info' | 'success' | 'warning' | 'danger' }[]) => void): () => void {
  _toastListeners.add(fn)
  return () => _toastListeners.delete(fn)
}

/** 清空 alert 和 toasts（重置用）。 */
export function clearAlerts(): void {
  _alert = { id: 0, text: '', variant: 'info', visible: false }
  _toasts = []
  _alertListeners.forEach((fn) => fn(_alert))
  _toastListeners.forEach((fn) => fn(_toasts))
}
