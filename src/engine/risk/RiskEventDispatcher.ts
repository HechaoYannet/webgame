/**
 * src/engine/risk/RiskEventDispatcher.ts
 *
 * 风险事件分发器（CLAUDE.md §6.8 + REVIEW_REPORT H4）。
 *
 * 背景：risk-events.json 中 events[] 含 askedContact / visitSensitivePage 两类叙事风险事件，
 * 原实现无任何消费方，属死数据（H4）。本分发器补救：按 event.trigger.kind 匹配触发条件后调
 * RiskService.addRisk 统一加风险（与谜题错答的风险来源同样经 RiskService，保证不重复扣）。
 *
 * 分发的两类（其余 trigger.kind 不在本分发器处理）：
 *  - visitSensitivePage：玩家首次访问某敏感页面时加风险。
 *      由 ChapterDirector.visitPage → gameStore.visitPage 返回 true（首次）→ emit pageFirstVisited 事件触发。
 *      注意：与 page.onViewEffects（倒计时四件套，不含 addRisk）正交，不冲突——
 *      onViewEffects 走 EffectExecutor 处理倒计时/短信/门铃/音频；本分发器单独加敏感访问风险（§6.8「+10访问敏感页面」）。
 *  - askedContact：玩家向某人物追问敏感关键词（如向张强追问「真相」）。
 *      本类不自动触发（触发点在 WechatApp/SmsApp 等不在本目录），
 *      仅暴露 riskOnAskedContact(characterId, keyword?) API 供外部调用。
 *
 * 幂等性：
 *  - visitSensitivePage：天然幂等——gameStore.visitPage 仅首访 emit pageFirstVisited，重复访问不再触发。
 *  - askedContact：同一 (characterId + keyword) 组合在本会话内只加一次风险（_askedContactFired 去重），
 *    避免玩家反复点同一选项刷风险到 100；不同 keyword 视为不同追问，分别计。
 */

import { getRiskEvents } from '@/data/loader'
import { getGameStore } from '@/engine/store/gameStore'
import { on } from '@/engine/eventBus'
import * as RiskService from './RiskService'
import type { RiskEvent } from '@/types'

let _initialized = false

/** 已触发过的 askedContact 组合（`${characterId}::${keyword ?? ''}`），同一组合本会话只计一次。 */
const _askedContactFired = new Set<string>()

/** 加载 risk-events.json 快照（容错：loader 未加载时返回空 events）。 */
function loadEvents(): readonly RiskEvent[] {
  try {
    return getRiskEvents().events ?? []
  } catch {
    return []
  }
}

/** 初始化（绑定 pageFirstVisited 订阅）。engine/index.ts 启动时调用一次。幂等。 */
export function initRiskEventDispatcher(): void {
  if (_initialized) return
  _initialized = true

  // 首次访问敏感页面 → 分发 visitSensitivePage 风险事件。
  // pageFirstVisited 由 gameStore.visitPage 首访 emit（ChapterDirector.visitPage 调用）。
  on('pageFirstVisited', ({ pageId }) => {
    dispatchVisitSensitivePage(pageId)
  })
}

/**
 * 分发 visitSensitivePage 类风险事件：查找 trigger.kind==visitSensitivePage 且 pageId 匹配者，
 * 命中则调 RiskService.addRisk(amount)。
 *
 * @param pageId 玩家首次访问的页面 id
 * @returns 触发的风险事件（未命中返回 undefined）
 */
export function dispatchVisitSensitivePage(pageId: string): RiskEvent | undefined {
  const store = getGameStore()
  if (store.finished) return undefined

  const events = loadEvents()
  const evt = events.find((e) => {
    if (e.trigger.kind !== 'visitSensitivePage') return false
    const eventPageId = (e.trigger as { pageId?: string }).pageId
    return eventPageId === pageId
  })
  if (!evt || evt.amount <= 0) return undefined

  RiskService.addRisk(evt.amount)
  return evt
}

/**
 * 分发 askedContact 类风险事件：供 WechatApp/SmsApp 在向某人物追问敏感关键词时调用。
 * 命中则调 RiskService.addRisk(amount)。
 *
 * 幂等：同一 (characterId + keyword) 组合本会话只加一次风险（避免反复点击刷风险）。
 *
 * @param characterId 被追问的人物 characterId（如 'char-zhangqiang'）
 * @param keyword 可选关键词（如 '真相'）；event.trigger.keyword 缺省时仅按 characterId 匹配
 * @returns 触发的风险事件（未命中或已触发过返回 undefined）
 */
export function riskOnAskedContact(characterId: string, keyword?: string): RiskEvent | undefined {
  const store = getGameStore()
  if (store.finished) return undefined

  // 同一组合本会话只计一次
  const dedupeKey = `${characterId}::${keyword ?? ''}`
  if (_askedContactFired.has(dedupeKey)) return undefined

  const events = loadEvents()
  const evt = events.find((e) => {
    if (e.trigger.kind !== 'askedContact') return false
    const t = e.trigger as { characterId?: string; keyword?: string }
    if (t.characterId !== characterId) return false
    // event 声明了 keyword 则必须严格匹配；未声明 keyword 则匹配任意对该人物的追问
    if (t.keyword !== undefined) return t.keyword === keyword
    return true
  })
  if (!evt || evt.amount <= 0) return undefined

  _askedContactFired.add(dedupeKey)
  RiskService.addRisk(evt.amount)
  return evt
}

/** 重置运行态（测试/新游戏用）。 */
export function resetRiskEventDispatcher(): void {
  _askedContactFired.clear()
}
