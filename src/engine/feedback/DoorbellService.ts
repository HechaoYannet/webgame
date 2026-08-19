/**
 * src/engine/feedback/DoorbellService.ts
 *
 * 智能门铃/摄像头事件推送（CLAUDE.md §三.3/§四.2 + phone/doorbell-events.json）。
 *
 * pushDoorbell(doorbellEventId)：打开门铃实时画面 + 循环敲击音频 + 震屏 + 红边脉冲。
 * doorbell-dao-visit 与 sms-zhangqiang-threat + countdown-finale(180s) + audio-heartbeat 同步到达
 * （由 page-lab-funding-report.onViewEffects 四件套触发）。
 *
 * 当前活动门铃事件用内部状态（内存态），UI useDoorbell 订阅渲染。
 */

import { getDoorbellEventById } from '@/data/loader'
import { emit } from '@/engine/eventBus'
import * as AudioService from './AudioService'
import { vibrate } from './HapticsService'
import { fullscreenAlert } from './AlertService'
import type { DoorbellEvent } from '@/types'

let _activeEventId: string | null = null
let _delivered: string[] = []
const _listeners = new Set<(activeId: string | null, delivered: string[]) => void>()

/** 推送门铃事件。返回是否成功。 */
export function pushDoorbell(doorbellEventId: string): boolean {
  const ev = getDoorbellEventById(doorbellEventId)
  if (!ev) {
    console.warn(`[DoorbellService] 门铃事件不存在: ${doorbellEventId}`)
    return false
  }
  _activeEventId = doorbellEventId
  if (!_delivered.includes(doorbellEventId)) _delivered.push(doorbellEventId)
  _listeners.forEach((fn) => fn(_activeEventId, [..._delivered]))
  emit('doorbellPushed', { doorbellEventId })

  // 副作用：循环敲击音频 + 震屏 + 红边告警
  if (ev.audio) {
    AudioService.play(ev.audio.assetId, ev.audio.loop ?? true)
  }
  vibrate('long')
  fullscreenAlert(ev.title, 'danger')
  // 红边脉冲、countdownBar 由 UI 根据 ev.deviceFeedback / ev.countdownBar 自行渲染
  return true
}

/** 关闭门铃实时画面（未停止音频循环——音频由倒计时/EffectExecutor.stopAudio 统一管）。 */
export function dismissDoorbell(): void {
  _activeEventId = null
  _listeners.forEach((fn) => fn(_activeEventId, [..._delivered]))
}

/** 当前活动门铃事件。 */
export function getActive(): DoorbellEvent | null {
  if (!_activeEventId) return null
  return getDoorbellEventById(_activeEventId) ?? null
}

export function getActiveId(): string | null {
  return _activeEventId
}

export function getDeliveredIds(): string[] {
  return [..._delivered]
}

export function subscribe(fn: (activeId: string | null, delivered: string[]) => void): () => void {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

export function resetDoorbell(): void {
  _activeEventId = null
  _delivered = []
  _listeners.forEach((fn) => fn(null, []))
}
