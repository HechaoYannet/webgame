/**
 * src/engine/hooks/useChapter.ts
 *
 * 订阅章节状态 + 开场独白（CLAUDE.md §hooks + §chapter）。
 */

import { useCallback, useEffect, useState } from 'react'
import { useGameStore } from '@/engine/store/gameStore'
import { getAllChapters, getChapterById, getMonologueByChapter } from '@/data/loader'
import { visitPage as chapterVisitPage, reevaluateChapters } from '@/engine/chapter/ChapterDirector'
import { on } from '@/engine/eventBus'
import type { Monologue } from '@/types'

export function useChapter() {
  const currentChapterId = useGameStore((s) => s.currentChapterId)
  const finished = useGameStore((s) => s.finished)
  const [, force] = useState(0)

  useEffect(() => {
    const u = on('chapterAdvanced', () => force((n) => n + 1))
    const u2 = on('puzzleSolved', () => force((n) => n + 1))
    const u3 = on('evidenceCollected', () => force((n) => n + 1))
    // 重写后已移除 clueRegistered 订阅：线索注册装饰机制废除。
    return () => {
      u()
      u2()
      u3()
    }
  }, [])

  const current = getChapterById(currentChapterId)
  const allChapters = getAllChapters()
  const monologue: Monologue | undefined = getMonologueByChapter(currentChapterId)

  /** 手动评估章节推进（UI 解谜/收集后可调）。 */
  const reevaluate = useCallback(() => reevaluateChapters(), [])

  /** 拜访页面（统一入口：触发首次 onViewEffects + 让 UI 调 ClueRegistry.view）。 */
  const visitPage = useCallback((pageId: string) => chapterVisitPage(pageId), [])

  return {
    currentChapterId,
    currentChapter: current,
    allChapters,
    monologue,
    finished,
    reevaluate,
    visitPage,
  }
}
