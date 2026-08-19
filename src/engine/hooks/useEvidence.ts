/**
 * src/engine/hooks/useEvidence.ts
 *
 * 订阅证据收集状态 + 终章清单（CLAUDE.md §hooks + §7）。
 */

import { useEffect, useState } from 'react'
import { useGameStore } from '@/engine/store/gameStore'
import { getCollected, listAll, getKeyEvidence, isFinaleSatisfied, getRequiredForFinale } from '@/engine/evidence/EvidenceService'
import { on } from '@/engine/eventBus'

export function useEvidence() {
  const collectedEvidenceIds = useGameStore((s) => s.collectedEvidenceIds)
  const [, force] = useState(0)

  useEffect(() => {
    const u1 = on('evidenceCollected', () => force((n) => n + 1))
    const u2 = on('clueRegistered', () => force((n) => n + 1))
    return () => {
      u1()
      u2()
    }
  }, [])

  return {
    collectedEvidenceIds,
    collected: getCollected(),
    all: listAll(),
    keyEvidence: getKeyEvidence(),
    requiredForFinale: getRequiredForFinale(),
    finaleSatisfied: isFinaleSatisfied(),
  }
}
