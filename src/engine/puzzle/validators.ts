/**
 * src/engine/puzzle/validators.ts
 *
 * AnswerMatchStrategy 判别器实现（CLAUDE.md §4.2 + SCHEMA.md §7）。
 *
 * 不持硬编码答案：答案从 puzzles.json 读（puzzle.answer），本模块只实现"怎么验"。
 *
 * 五种策略：
 *  - exact：精确匹配（可大小写/trim）
 *  - oneOf：多个可接受答案（如 QQ 密码 0328 容错 20260328，§6.1）
 *  - regex：正则匹配
 *  - phoneNumber：归一化后取 normalizedDigits 位比较（举报电话 0731-88888888）
 *  - evidenceSet：终章证据勾选，requiredEvidenceIds 全部命中且总长度 >= minLength
 */

import type { AnswerMatchStrategy, EvidenceId, Puzzle } from '@/types'

export interface EvidenceSetInput {
  /** 玩家勾选的证据 id 列表。 */
  selected: EvidenceId[]
}

export type PuzzleInput = string | EvidenceSetInput

/**
 * 判定玩家输入是否匹配谜题答案。
 *
 * @param puzzle 谜题对象（含 answer 与 matchStrategy）
 * @param input 玩家输入（password/pdfPassword/phoneNumber 传 string；evidenceSelection 传 EvidenceSetInput）
 * @returns 是否匹配
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

/**
 * phoneNumber 校验：归一化玩家输入与 answer，取后 normalizedDigits 位比较。
 * 用于举报电话 0731-88888888（玩家拨号 073188888888 与 answer 比对）。
 */
function matchPhoneNumber(value: string, normalizedDigits: number, expected: string | string[]): boolean {
  const expectedStr = Array.isArray(expected) ? (expected[0] ?? '') : expected
  const vDigits = normalizeDigits(value)
  const eDigits = normalizeDigits(expectedStr)
  if (vDigits.length < normalizedDigits || eDigits.length < normalizedDigits) return false
  const vTail = vDigits.slice(-normalizedDigits)
  const eTail = eDigits.slice(-normalizedDigits)
  return vTail === eTail
}

/**
 * evidenceSet 校验：玩家勾选需满足——
 *  1. 总数 >= minLength
 *  2. requiredEvidenceIds 全部被命中（§7：5 项关键证据齐备才进真结局）
 */
function matchEvidenceSet(selected: EvidenceSetInput, required: EvidenceId[], minLength: number): boolean {
  const chosen = new Set(selected.selected)
  if (chosen.size < minLength) return false
  // required 必须全部命中
  return required.every((id) => chosen.has(id))
}

/** 当 attemptsToHint 命中且玩家本次输错时，返回 true（PuzzleService 用于触发提示）。 */
export function shouldShowHint(puzzle: Puzzle, wrongAttempts: number): boolean {
  if (!puzzle.attemptsToHint) return false
  return wrongAttempts >= puzzle.attemptsToHint
}
