/**
 * src/game/answerCheck.ts
 *
 * 谜题答案校验（"怎么验"在此，"是什么答案"在 public/data/puzzle/puzzles.json）。
 *
 * 重写后（玩家决策 2026-08-19）：引擎副作用链已删。本模块是唯一的答案校验入口，
 * 纯函数——不写任何状态、不触发任何副作用、不推进章节、不收集证据。
 *   - 网站登录表单调 checkAnswer(puzzleId, input)：成功只意味着"登录通过"，
 *     后续揭示站内后台页由站内导航负责（无游戏效果）。
 *   - 手机 App（QQ 登录、PDF 密码、终章证据勾选）调 checkAnswer 校验，
 *     由调用方自行决定后续动作（markPuzzleSolved / 显示内容 / pushEnding）。
 *
 * matchAnswer 五种策略搬迁自原 src/engine/puzzle/validators.ts（leaf 逻辑保留）。
 * checkAnswer 包装：按 puzzleId 从 loader 取 puzzle 再 matchAnswer。
 */
import type { AnswerMatchStrategy, EvidenceId, Puzzle } from '@/types'
import { getPuzzleById } from '@/data/loader'

export interface EvidenceSetInput {
  /** 玩家勾选的证据 id 列表（终章 puzzle-evidence-finale 用）。 */
  selected: EvidenceId[]
}

export type PuzzleInput = string | EvidenceSetInput

/**
 * 判定玩家输入是否匹配谜题答案。
 *
 * @param puzzle 谜题对象（含 answer 与 matchStrategy）
 * @param input password/pdfPassword/phoneNumber 传 string；evidenceSelection 传 EvidenceSetInput
 */
export function matchAnswer(puzzle: Puzzle, input: PuzzleInput): boolean {
  const strategy: AnswerMatchStrategy = puzzle.matchStrategy
  switch (strategy.kind) {
    case 'exact':
      return matchExact(asString(input), puzzle.answer, strategy)
    case 'oneOf':
      return matchOneOf(asString(input), strategy.accepted)
    case 'regex':
      return matchRegex(asString(input), strategy.pattern)
    case 'phoneNumber':
      return matchPhoneNumber(asString(input), strategy.normalizedDigits, puzzle.answer)
    case 'evidenceSet':
      return matchEvidenceSet(asEvidenceSet(input), strategy.requiredEvidenceIds, strategy.minLength)
  }
}

/**
 * 按 puzzleId 校验：从 puzzles.json 取该谜题再 matchAnswer。返回是否通过。
 * 纯函数，无副作用。谜题未找到返回 false。
 */
export function checkAnswer(puzzleId: string, input: PuzzleInput): boolean {
  const puzzle = getPuzzleById(puzzleId)
  if (!puzzle) return false
  return matchAnswer(puzzle, input)
}

/** 终章证据勾选是否达标（≥5 全部 requiredEvidenceIds）。 */
export function isFinaleSelectionSufficient(selected: EvidenceId[]): boolean {
  return checkAnswer('puzzle-evidence-finale', { selected })
}

function asString(input: PuzzleInput): string {
  if (typeof input === 'string') return input
  return ''
}

function asEvidenceSet(input: PuzzleInput): EvidenceSetInput {
  if (typeof input === 'object' && input !== null && 'selected' in input) {
    return input as EvidenceSetInput
  }
  return { selected: [] }
}

function matchExact(value: string, expected: string | string[], opts: { caseSensitive?: boolean; trim?: boolean }): boolean {
  const expectedStr = Array.isArray(expected) ? (expected[0] ?? '') : expected
  let a = value
  let b = expectedStr
  if (opts.trim !== false) {
    a = a.trim()
    b = b.trim()
  }
  if (opts.caseSensitive !== true) {
    a = a.toLowerCase()
    b = b.toLowerCase()
  }
  return a === b
}

function matchOneOf(value: string, accepted: string[]): boolean {
  const v = value.trim().toLowerCase()
  return accepted.some((acc) => acc.trim().toLowerCase() === v)
}

function matchRegex(value: string, pattern: string): boolean {
  try {
    const re = new RegExp(pattern)
    return re.test(value)
  } catch {
    // 非法正则退化为精确匹配
    return value.trim() === pattern.trim()
  }
}

/** 归一化：只保留数字。 */
function normalizeDigits(s: string): string {
  return s.replace(/\D+/g, '')
}

/** phoneNumber 校验：归一化后取后 normalizedDigits 位比较（举报电话 0731-88888888 用）。 */
function matchPhoneNumber(value: string, normalizedDigits: number, expected: string | string[]): boolean {
  const expectedStr = Array.isArray(expected) ? (expected[0] ?? '') : expected
  const vDigits = normalizeDigits(value)
  const eDigits = normalizeDigits(expectedStr)
  if (vDigits.length < normalizedDigits || eDigits.length < normalizedDigits) return false
  const vTail = vDigits.slice(-normalizedDigits)
  const eTail = eDigits.slice(-normalizedDigits)
  return vTail === eTail
}

/** evidenceSet 校验：总数 >= minLength 且 requiredEvidenceIds 全部命中。 */
function matchEvidenceSet(selected: EvidenceSetInput, required: EvidenceId[], minLength: number): boolean {
  const chosen = new Set(selected.selected)
  if (chosen.size < minLength) return false
  return required.every((id) => chosen.has(id))
}
