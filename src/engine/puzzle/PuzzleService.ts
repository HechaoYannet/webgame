/**
 * src/engine/puzzle/PuzzleService.ts
 *
 * 谜题提交核心流程（CLAUDE.md §4.2）。
 *
 * submit(puzzleId, value) →
 *   1. 从 loader 取 puzzle（不持硬编码答案）
 *   2. matchAnswer 校验
 *   3. 成功：
 *      - attemptPuzzle 记录（含已解也算一次）
 *      - solvePuzzle(id, { unlockedThreadIds/AssetIds/registersEvidenceIds, completeObjectiveId })
 *      - executeEffects(puzzle.onSuccess)
 *      - ChapterDirector 推进章节（由事件总线触发，本服务不直接调）
 *   4. 失败：
 *      - attemptPuzzle 计入错误次数
 *      - 风险累加：单一来源（REVIEW_REPORT H3）——若 onFailure 含 addRisk effect，
 *        风险只由 executeEffects(onFailure) 经 EffectExecutor→RiskService 统一加；
 *        否则回退到 store.addRisk(riskPerWrongAttempt)。绝不二者叠加。
 *      - attemptsToHint 命中 → markHintShown + 返回 hintIds（供 UI 弹提示）
 *      - lockoutAfterAttempts 命中 → 返回 locked: true
 *      - executeEffects(puzzle.onFailure)
 *
 * 返回 SubmitResult：UI 据此渲染成功/失败/锁定/提示。
 */

import type { ClueId, EvidenceId, Puzzle, PuzzleId } from '@/types'
import { getPuzzleById } from '@/data/loader'
import { getGameStore } from '@/engine/store/gameStore'
import { executeEffects } from './EffectExecutor'
import { matchAnswer, shouldShowHint, type PuzzleInput } from './validators'
import { emit as emitEngineEvent } from '@/engine/eventBus'

export interface SubmitResult {
  puzzleId: PuzzleId
  success: boolean
  /** 当前累计错误尝试次数。 */
  wrongAttempts: number
  /** 本次是否触发了提示（attemptsToHint 命中）。 */
  hintTriggered: boolean
  /** 命中提示的 hint id 列表（空数组表示无）。 */
  hintIds: string[]
  /** 是否被锁定（lockoutAfterAttempts 命中，UI 应禁用输入）。 */
  locked: boolean
  /** 旧存档首次解开此谜题（用于 UI 区分"已解"）。 */
  newlySolved: boolean
  /** 风险值变化（失败时为本次单次加风险值；H3 单一来源后不叠加）。 */
  riskDelta: number
  /** 错误信息（如 puzzle 不存在）。 */
  error?: string
}

/**
 * 提交谜题答案。
 * @param puzzleId 谜题 id
 * @param value 玩家输入（password 类传 string；evidenceSelection 传 { selected: EvidenceId[] }）
 */
export function submit(puzzleId: PuzzleId, value: PuzzleInput): SubmitResult {
  const store = getGameStore()

  // 游戏已结束 → 不再处理谜题
  if (store.finished) {
    return {
      puzzleId,
      success: false,
      wrongAttempts: store.puzzleAttempts[puzzleId] ?? 0,
      hintTriggered: false,
      hintIds: [],
      locked: true,
      newlySolved: false,
      riskDelta: 0,
      error: 'game-finished',
    }
  }

  const puzzle: Puzzle | undefined = getPuzzleById(puzzleId)
  if (!puzzle) {
    return {
      puzzleId,
      success: false,
      wrongAttempts: 0,
      hintTriggered: false,
      hintIds: [],
      locked: false,
      newlySolved: false,
      riskDelta: 0,
      error: `puzzle not found: ${puzzleId}`,
    }
  }

  // 已解过的谜题不重复扣风险（直接返回已解）
  const alreadySolved = store.solvedPuzzleIds.includes(puzzleId)

  const ok = matchAnswer(puzzle, value)

  if (ok) {
    const newlySolved = store.solvePuzzle(puzzleId, {
      unlockedThreadIds: puzzle.unlocksThreadIds,
      unlockedPageIds: puzzle.unlocksPageIds,
      unlockedAssetIds: puzzle.unlocksAssetIds,
      registerEvidenceIds: puzzle.registersEvidenceIds,
    })

    // 执行成功副作用
    executeEffects(puzzle.onSuccess)

    // 广播 puzzleSolved 事件（ChapterDirector / ClueRegistry 监听）
    emitEngineEvent('puzzleSolved', { puzzleId, newlySolved })

    return {
      puzzleId,
      success: true,
      wrongAttempts: store.puzzleAttempts[puzzleId] ?? 0,
      hintTriggered: false,
      hintIds: [],
      locked: false,
      newlySolved,
      riskDelta: 0,
    }
  }

  // 失败分支
  // 已解过的谜题输错不计风险、不锁定（避免反噬）
  if (alreadySolved) {
    return {
      puzzleId,
      success: false,
      wrongAttempts: store.puzzleAttempts[puzzleId] ?? 0,
      hintTriggered: false,
      hintIds: [],
      locked: false,
      newlySolved: false,
      riskDelta: 0,
    }
  }

  const wrongAttempts = store.attemptPuzzle(puzzleId)

  // 风险累加（CLAUDE.md §6.8）—— 单一来源，避免双计（REVIEW_REPORT H3）。
  // 优先以 onFailure.addRisk effect 为唯一风险来源（经 EffectExecutor→RiskService 统一加）；
  // 仅当 onFailure 不含 addRisk effect 时，才回退到直接调 store.addRisk(riskPerWrongAttempt)。
  // 保证单次错答只加一次风险，绝不叠加 riskPerWrongAttempt + onFailure.addRisk。
  const onFailureHasAddRisk = !!(puzzle.onFailure && puzzle.onFailure.some((e) => e.type === 'addRisk'))
  let riskDelta = 0
  if (onFailureHasAddRisk) {
    // 风险由下方 executeEffects(puzzle.onFailure) 统一加；
    // 此处只回填 riskDelta 供 SubmitResult 告知 UI（取首个 addRisk amount）。
    const addRiskEffect = puzzle.onFailure!.find((e) => e.type === 'addRisk') as
      | { type: 'addRisk'; amount: number }
      | undefined
    riskDelta = addRiskEffect ? addRiskEffect.amount : 0
  } else if (puzzle.riskPerWrongAttempt && puzzle.riskPerWrongAttempt > 0) {
    // onFailure 无 addRisk：用 riskPerWrongAttempt 作为唯一来源直加。
    store.addRisk(puzzle.riskPerWrongAttempt)
    riskDelta = puzzle.riskPerWrongAttempt
  }

  // 提示触发（attemptsToHint）
  let hintTriggered = false
  let hintIds: string[] = []
  if (shouldShowHint(puzzle, wrongAttempts)) {
    hintTriggered = true
    hintIds = puzzle.hintIds
    for (const hid of puzzle.hintIds) store.markHintShown(hid)
  }

  // 锁定判定（lockoutAfterAttempts）
  const locked = puzzle.lockoutAfterAttempts !== undefined && wrongAttempts >= puzzle.lockoutAfterAttempts

  // 执行失败副作用
  executeEffects(puzzle.onFailure)

  // 广播 puzzleFailed
  emitEngineEvent('puzzleFailed', { puzzleId, wrongAttempts, locked })

  return {
    puzzleId,
    success: false,
    wrongAttempts,
    hintTriggered,
    hintIds,
    locked,
    newlySolved: false,
    riskDelta,
  }
}

/** 仅校验不触发副作用（UI 预览/测试用）。 */
export function dryMatch(puzzleId: PuzzleId, value: PuzzleInput): boolean {
  const puzzle = getPuzzleById(puzzleId)
  if (!puzzle) return false
  return matchAnswer(puzzle, value)
}

/** 查询某谜题是否已解。 */
export function isSolved(puzzleId: PuzzleId): boolean {
  return getGameStore().solvedPuzzleIds.includes(puzzleId)
}

/** 查询某谜题当前错误尝试次数。 */
export function getWrongAttempts(puzzleId: PuzzleId): number {
  return getGameStore().puzzleAttempts[puzzleId] ?? 0
}

/** 重新导出 hint/evidence 相关 ID 类型别名供 hook 使用。 */
export type { ClueId, EvidenceId }
