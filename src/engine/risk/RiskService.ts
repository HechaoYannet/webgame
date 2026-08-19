/**
 * src/engine/risk/RiskService.ts
 *
 * 风险值服务（CLAUDE.md §6.8 + SCHEMA.md §13）。
 *
 * 阈值（来自 data/meta/risk-events.json thresholds）：
 *  - risk 0..100
 *  - ==100 → bad 结局（riskMaxed），不可回退
 *  - >70  → 屏幕红边 + 心跳（AudioService 启动心跳循环）
 *
 * addRisk/removeRisk/setRisk 调 gameStore 落盘，并 emit riskChanged 事件。
 * UI 红边/心跳通过 useRisk hook 订阅 isRedAlert / risk 值。
 */

import { getGameStore } from '@/engine/store/gameStore'
import { emit } from '@/engine/eventBus'
import { getRiskEvents } from '@/data/loader'

export interface RiskThresholds {
  max: number
  badEndingAt: number
  redAlertAt: number
}

/** 当前阈值（从风险事件文件读，未加载时用 §6.8 默认值）。 */
export function getThresholds(): RiskThresholds {
  try {
    return getRiskEvents().thresholds
  } catch {
    // loader 未加载阶段兜底
    return { max: 100, badEndingAt: 100, redAlertAt: 70 }
  }
}

/** 加风险并触发结局/红边判定。返回新风险值。 */
export function addRisk(amount: number): number {
  const store = getGameStore()
  const before = store.risk
  const after = store.addRisk(amount)
  emit('riskChanged', { risk: after, delta: after - before })
  checkRiskConsequences(after, before)
  return after
}

/** 减风险（不含红边解除副作用 emit）。 */
export function removeRisk(amount: number): number {
  const store = getGameStore()
  const before = store.risk
  const after = store.removeRisk(amount)
  emit('riskChanged', { risk: after, delta: after - before })
  return after
}

/** 直接设风险值。 */
export function setRisk(value: number): number {
  const store = getGameStore()
  const before = store.risk
  const after = store.setRisk(value)
  emit('riskChanged', { risk: after, delta: after - before })
  checkRiskConsequences(after, before)
  return after
}

/** 风险值后果判定：==badEndingAt 推 bad 结局；>redAlertAt 触发心跳（音频）。 */
function checkRiskConsequences(after: number, _before: number): void {
  const thresholds = getThresholds()
  const store = getGameStore()

  // ==100 → bad 结局（不可回退，§6.8）
  if (after >= thresholds.badEndingAt) {
    store.pushEnding('bad')
    emit('endingPushed', { endingId: 'bad' })
    return
  }

  // 进入红边心跳区（before<=70 → after>70），由 AudioService 监听 riskChanged 自行启停心跳
  // 这里不直接调 AudioService，保持 service 解耦
}

/** 当前风险值。 */
export function getRisk(): number {
  return getGameStore().risk
}

/** 是否处于红边心跳区（risk > redAlertAt）。 */
export function isRedAlert(): boolean {
  return getRisk() > getThresholds().redAlertAt
}

/** 是否已达 bad 结局阈值。 */
export function isRiskMaxed(): boolean {
  return getRisk() >= getThresholds().badEndingAt
}
