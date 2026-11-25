/**
 * src/game/evidence.ts
 *
 * 证据查询/终章清单（搬迁自 src/engine/evidence/EvidenceService，剥离 eventBus）。
 *
 * 重写后（玩家决策 2026-08-19）：证据收集 = 相册勾选·荣誉制。本模块只做查询：
 *   - listAll / getKeyEvidence：证据库全集 / 5 项关键证据（来自 evidence-registry.json）。
 *   - getRequiredForFinale：终章 puzzle-evidence-finale 要求的 requiredEvidenceIds。
 *   - isFinaleSatisfied：玩家已勾选是否覆盖全部 requiredEvidenceIds。
 *
 * 勾选/取消勾选由 gameStore.toggleEvidence 处理；本模块不写状态。
 */
import { getEvidenceById, getAllEvidence, getPuzzleById } from '@/data/loader'
import type { Evidence, EvidenceId } from '@/types'
import { useGameStore } from './gameStore'

/** 收集证据（查看关键内容时自动归档；幂等）。 */
export function collectEvidence(evidenceId: EvidenceId): void {
  useGameStore.getState().collectEvidence(evidenceId)
}

/** 是否已收集。 */
export function isCollected(evidenceId: EvidenceId): boolean {
  return useGameStore.getState().collectedEvidenceIds.includes(evidenceId)
}

/** 已勾选的证据 id 列表（稳定顺序）。 */
export function getCollectedIds(): EvidenceId[] {
  return useGameStore.getState().collectedEvidenceIds
}

/** 已勾选的证据对象列表。 */
export function getCollected(): Evidence[] {
  const ids = getCollectedIds()
  const out: Evidence[] = []
  for (const id of ids) {
    const e = getEvidenceById(id)
    if (e) out.push(e)
  }
  return out
}

/** 全部证据清单（证据库全集）。 */
export function listAll(): Evidence[] {
  return getAllEvidence()
}

/** 5 项关键证据。 */
export function getKeyEvidence(): Evidence[] {
  return getAllEvidence().filter((e) => e.isKey)
}

/** 终章达标判定：requiredEvidenceIds 全部已勾选。 */
export function isFinaleSatisfied(): boolean {
  const puzzle = getPuzzleById('puzzle-evidence-finale')
  if (!puzzle || puzzle.matchStrategy.kind !== 'evidenceSet') return false
  const required = puzzle.matchStrategy.requiredEvidenceIds
  const collected = new Set(getCollectedIds())
  return required.every((id) => collected.has(id))
}

/** 终章 puzzle.requiredEvidenceIds（UI 高亮关键项用）。 */
export function getRequiredForFinale(): EvidenceId[] {
  const puzzle = getPuzzleById('puzzle-evidence-finale')
  if (!puzzle || puzzle.matchStrategy.kind !== 'evidenceSet') return []
  return puzzle.matchStrategy.requiredEvidenceIds
}
