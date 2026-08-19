/**
 * src/engine/hooks/usePuzzle.ts
 *
 * React hook 封装 PuzzleService（CLAUDE.md §hooks）。
 */

import { useCallback, useState } from 'react'
import { submit as submitPuzzle, dryMatch, isSolved, getWrongAttempts, type SubmitResult } from '@/engine/puzzle/PuzzleService'
import type { PuzzleInput } from '@/engine/puzzle/validators'
import { useGameStore } from '@/engine/store/gameStore'

export function usePuzzle(puzzleId: string) {
  const solved = useGameStore((s) => s.solvedPuzzleIds.includes(puzzleId))
  const attempts = useGameStore((s) => s.puzzleAttempts[puzzleId] ?? 0)
  const finished = useGameStore((s) => s.finished)
  const [lastResult, setLastResult] = useState<SubmitResult | null>(null)

  const submit = useCallback(
    (value: PuzzleInput): SubmitResult => {
      const res = submitPuzzle(puzzleId, value)
      setLastResult(res)
      return res
    },
    [puzzleId],
  )

  return {
    solved,
    attempts,
    finished,
    submit,
    dryMatchValue: (value: PuzzleInput) => dryMatch(puzzleId, value),
    isSolved: () => isSolved(puzzleId),
    getWrongAttempts: () => getWrongAttempts(puzzleId),
    lastResult,
    /** 解锁状态（来自 store，供 UI 决定是否可输入）。 */
    locked: finished,
  }
}
