/**
 * src/engine/feedback/SmsService.ts
 *
 * 短信推送服务（CLAUDE.md §三/§四 + phone/sms.json）。
 *
 * pushSms(smsEventId)：把 phone/sms.json 中的事件加入"已送达收件箱"，触发短信 App 通知 + toast。
 * 收件箱用内部状态（不落 localStorage——短信事件由 EffectExecutor 重放，存档恢复后谜题 onEnterEffects 重新触发，
 * 但 SMS 作为一次性副作用不重放，故内存态足够）。
 */

import { getSmsEventById } from '@/data/loader'
import { emit } from '@/engine/eventBus'
import { toast } from './AlertService'
import type { SmsEvent } from '@/types'

/** 已送达的 SMS 事件 id 列表（按送达顺序）。 */
const _delivered: string[] = []
const _listeners = new Set<(ids: string[]) => void>()

/** 推送短信事件。返回是否成功（事件存在且未重复到达）。 */
export function pushSms(smsEventId: string): boolean {
  const ev = getSmsEventById(smsEventId)
  if (!ev) {
    console.warn(`[SmsService] sms 事件不存在: ${smsEventId}`)
    return false
  }
  if (_delivered.includes(smsEventId)) return false
  _delivered.push(smsEventId)
  _listeners.forEach((fn) => fn([..._delivered]))
  emit('smsPushed', { smsEventId })
  // toast 反馈（按 alertStyle）
  const variant = ev.alertStyle ?? 'info'
  toast(`短信：${ev.body.slice(0, 24)}${ev.body.length > 24 ? '…' : ''}`, variant === 'success' ? 'success' : variant === 'danger' ? 'danger' : variant === 'warning' ? 'warning' : 'info')
  return true
}

/** 已送达短信事件列表（对象）。 */
export function getDelivered(): SmsEvent[] {
  const out: SmsEvent[] = []
  for (const id of _delivered) {
    const ev = getSmsEventById(id)
    if (ev) out.push(ev)
  }
  return out
}

export function getDeliveredIds(): string[] {
  return [..._delivered]
}

export function subscribeDelivered(fn: (ids: string[]) => void): () => void {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

export function resetSms(): void {
  _delivered.length = 0
  _listeners.forEach((fn) => fn([]))
}
