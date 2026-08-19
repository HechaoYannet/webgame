/**
 * src/engine/evidence/EvidenceService.ts
 *
 * 证据收集/查询/终章清单（CLAUDE.md §4.2 + §7）。
 *
 * 收集调用 gameStore.collectEvidence（去重），并 emit evidenceCollected。
 * 终章清单：getAllEvidence() 中 isKey===true 的为 5 项关键证据；终章 puzzle-evidence-finale
 * 的 matchStrategy.evidenceSet 要求 requiredEvidenceIds（5 项）齐备且总长 >=5。
 */

import { getGameStore } from '@/engine/store/gameStore'
import { emit } from '@/engine/eventBus'
import { getEvidenceById, getAllEvidence, getPuzzleById } from '@/data/loader'
import type { Evidence, EvidenceId } from '@/types'

/** 收集证据。返回是否首次收集。 */
export function collect(evidenceId: EvidenceId): boolean {
  const store = getGameStore()
  const first = store.collectEvidence(evidenceId)
  if (first) {
    emit('evidenceCollected', { evidenceId })
  }
  return first
}

/** 是否已收集。 */
export function isCollected(evidenceId: EvidenceId): boolean {
  return getGameStore().collectedEvidenceIds.includes(evidenceId)
}

/** 已收集的证据 id 列表（稳定顺序，按收集先后）。 */
export function getCollectedIds(): EvidenceId[] {
  return getGameStore().collectedEvidenceIds
}

/** 已收集的证据对象列表（供证据库 UI）。 */
export function getCollected(): Evidence[] {
  const ids = getCollectedIds()
  const out: Evidence[] = []
  for (const id of ids) {
    const e = getEvidenceById(id)
    if (e) out.push(e)
  }
  return out
}

/** 全部证据清单（含未收集，证据库全集）。 */
export function listAll(): Evidence[] {
  return getAllEvidence()
}

/** 5 项关键证据。 */
export function getKeyEvidence(): Evidence[] {
  return getAllEvidence().filter((e) => e.isKey)
}

/**
 * 终章达标判定：终章 puzzle-evidence-finale 的 evidenceSet requiredEvidenceIds 全部已收集。
 * UI 在终章勾选界面用本函数显示"是否达标"提示。
 */
export function isFinaleSatisfied(): boolean {
  const puzzle = getPuzzleById('puzzle-evidence-finale')
  if (!puzzle || puzzle.matchStrategy.kind !== 'evidenceSet') return false
  const required = puzzle.matchStrategy.requiredEvidenceIds
  const collected = new Set(getCollectedIds())
  return required.every((id) => collected.has(id))
}

/** 终章可勾选的证据：已收集的（可选 + 关键）。 */
export function getSelectableForFinale(): Evidence[] {
  const collected = getCollected()
  return collected
}

/** 终章 puzzle.requiredEvidenceIds（用于 UI 高亮关键项）。 */
export function getRequiredForFinale(): EvidenceId[] {
  const puzzle = getPuzzleById('puzzle-evidence-finale')
  if (!puzzle || puzzle.matchStrategy.kind !== 'evidenceSet') return []
  return puzzle.matchStrategy.requiredEvidenceIds
}
