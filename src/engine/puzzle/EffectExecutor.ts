/**
 * src/engine/puzzle/EffectExecutor.ts
 *
 * PuzzleEffect 统一执行器（CLAUDE.md §4.2 "副作用清单统一执行"）。
 *
 * 消费 PuzzleEffect[]（puzzle.onSuccess / onFailure / page.onViewEffects /
 * chapter.onEnterEffects / callScript.branch.endEffects 等），逐条执行。
 *
 * 覆盖全部 PuzzleEffect 类型（types/index.ts）：
 *   addRisk / removeRisk / startCountdown / advanceChapter / pushSms / pushDoorbell /
 *   registerClue / collectEvidence / playAudio(loop) / stopAudio / vibrate /
 *   fullscreenAlert / pushEnding / openNewsApp / openApp
 *
 * 通过 effectHandlers 注入实际副作用（与 store/services 耦合），便于：
 *  1. 单元测试时注入 mock handlers。
 *  2. reviewer 离线验证时可直接断言 effect 序列。
 *
 * 副作用执行幂等性：registerClue/collectEvidence 在 store 内部去重，EffectExecutor 不重复去重。
 */

import type { PuzzleEffect } from '@/types'
import { getGameStore } from '@/engine/store/gameStore'

export interface EffectHandlers {
  addRisk: (amount: number) => void
  removeRisk: (amount: number) => void
  startCountdown: (id: string, durationSec: number) => void
  advanceChapter: (toChapterId: string) => void
  /** 推送短信事件（由 SmsService 把 phone/sms.json 的事件加入收件箱 + 通知）。 */
  pushSms: (smsEventId: string) => void
  /** 推送门铃事件（由 DoorbellService 打开来电/门铃画面 + 循环音频 + 震屏）。 */
  pushDoorbell: (doorbellEventId: string) => void
  registerClue: (clueId: string) => void
  collectEvidence: (evidenceId: string) => void
  /** 播放音频（loop 可循环，如心跳/门铃敲击）。 */
  playAudio: (assetId: string, loop?: boolean) => void
  /** 停止音频（assetId 缺省停全部）。 */
  stopAudio: (assetId?: string) => void
  vibrate: () => void
  /** 全屏警告覆盖 PhoneShell（如倒计时红边告警）。 */
  fullscreenAlert: (text: string) => void
  /** 推送结局（不可回退）。 */
  pushEnding: (endingId: 'good' | 'normal' | 'bad') => void
  /** 打开新闻 App 播放破案播报（真结局专用，good）。 */
  openNewsApp: (endingId: 'good' | 'normal' | 'bad') => void
  /** 打开任意 App（按 appId 路由跳转）。 */
  openApp: (appId: string) => void
}

let _handlers: EffectHandlers | null = null
let _log: { effect: PuzzleEffect; ts: number }[] = []
let _logging = false

/** 注入实际副作用处理器（由 engine/index.ts 在初始化时绑定 store+services）。 */
export function bindEffectHandlers(handlers: EffectHandlers): void {
  _handlers = handlers
}

/** 开启 effect 日志（reviewer 离线验证用）。 */
export function enableEffectLogging(on: boolean): void {
  _logging = on
  if (!on) _log = []
}

/** 取 effect 日志（测试验证用）。 */
export function getEffectLog(): readonly { effect: PuzzleEffect; ts: number }[] {
  return _log
}

/** 清除 effect 日志。 */
export function clearEffectLog(): void {
  _log = []
}

/** 游戏是否已结束（finished=true）。读取 store 快照，避免在加载前/SSR 期抛错。 */
function isGameFinished(): boolean {
  try {
    return getGameStore().finished
  } catch {
    // store 未初始化阶段兜底（如离线验证、SSR），视作未结束以不影响 effect 执行。
    return false
  }
}

/**
 * 执行一组 PuzzleEffect。失败副作用不会中断后续 effect（尽力执行）。
 * 仅在游戏未 finished 时执行（除 pushEnding 本身）；finished 后其余 effect 被忽略（兑现注释承诺，REVIEW_REPORT M3）。
 */
export function executeEffects(effects: readonly PuzzleEffect[] | undefined | null): void {
  if (!effects || effects.length === 0) return
  const h = _handlers
  if (!h) {
    console.warn('[EffectExecutor] handlers 未绑定，effect 被忽略')
    return
  }
  for (const e of effects) {
    // finished 守卫：游戏结束后除 pushEnding 本身外所有副作用一律跳过（兑现 docstring 承诺，防 pushEnding 后副作用继续写入 store）。
    // pushEnding 自身幂等（gameStore.pushEnding 已对 finished no-op），故仍允许 dispatch 以触发 endingPushed 事件。
    if (e.type !== 'pushEnding' && isGameFinished()) {
      break
    }
    if (_logging) _log.push({ effect: e, ts: Date.now() })
    try {
      dispatch(e, h)
    } catch (err) {
      console.error('[EffectExecutor] effect 执行失败，跳过', e, err)
    }
  }
}

function dispatch(e: PuzzleEffect, h: EffectHandlers): void {
  switch (e.type) {
    case 'addRisk':
      h.addRisk(e.amount)
      return
    case 'removeRisk':
      h.removeRisk(e.amount)
      return
    case 'startCountdown':
      h.startCountdown(e.id, e.durationSec)
      return
    case 'advanceChapter':
      h.advanceChapter(e.toChapterId)
      return
    case 'pushSms':
      h.pushSms(e.smsEventId)
      return
    case 'pushDoorbell':
      h.pushDoorbell(e.doorbellEventId)
      return
    case 'registerClue':
      h.registerClue(e.clueId)
      return
    case 'collectEvidence':
      h.collectEvidence(e.evidenceId)
      return
    case 'playAudio':
      h.playAudio(e.assetId, e.loop)
      return
    case 'stopAudio':
      h.stopAudio(e.assetId)
      return
    case 'vibrate':
      h.vibrate()
      return
    case 'fullscreenAlert':
      h.fullscreenAlert(e.text)
      return
    case 'pushEnding':
      h.pushEnding(e.endingId)
      return
    case 'openNewsApp':
      h.openNewsApp(e.endingId)
      return
    case 'openApp':
      h.openApp(e.appId)
      return
    default: {
      // exhaustive check
      const _exhaustive: never = e
      void _exhaustive
      return
    }
  }
}
