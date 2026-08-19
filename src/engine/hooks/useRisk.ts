/**
 * src/engine/hooks/useRisk.ts
 *
 * 订阅风险值 + 红边心跳状态（CLAUDE.md §hooks + §6.8）。
 */

import { useEffect, useState } from 'react'
import { useGameStore } from '@/engine/store/gameStore'
import { isRedAlert, getThresholds } from '@/engine/risk/RiskService'
import { on } from '@/engine/eventBus'

export function useRisk() {
  const risk = useGameStore((s) => s.risk)
  const [, force] = useState(0)

  const thresholds = getThresholds()
  const red = isRedAlert()
  const maxed = risk >= thresholds.badEndingAt

  useEffect(() => {
    return on('riskChanged', () => force((n) => n + 1))
  }, [])

  return {
    risk,
    redAlert: red,
    riskMaxed: maxed,
    thresholds,
    /** 进度 0..1（risk / max）。 */
    progress: thresholds.max > 0 ? risk / thresholds.max : 0,
  }
}
