/**
 * src/engine/hooks/useClue.ts
 *
 * React hook 封装 ClueRegistry（CLAUDE.md §hooks + "查看即取证"机制）。
 */

import { useCallback, useState, useEffect } from 'react'
import { onView, drainToasts, getRegisteredClues, previewMatched, registerClue, type ClueViewResult } from '@/engine/clue/ClueRegistry'
import type { ViewPayload } from '@/data/loader'
import { useGameStore } from '@/engine/store/gameStore'
import { on } from '@/engine/eventBus'

export function useClue() {
  const registeredClueIds = useGameStore((s) => s.registeredClueIds)
  const [, force] = useState(0)
  // 订阅线索注册事件触发重渲染
  useEffect(() => {
    return on('clueRegistered', () => force((n) => n + 1))
  }, [])

  const view = useCallback(async (payload: ViewPayload, domEl?: HTMLElement | null): Promise<ClueViewResult> => {
    const result = await onView(payload, domEl)
    // 触发重渲染以反映注册变化
    force((n) => n + 1)
    return result
  }, [])

  const register = useCallback((clueId: string) => {
    const ok = registerClue(clueId)
    force((n) => n + 1)
    return ok
  }, [])

  return {
    registeredClueIds,
    registeredClues: getRegisteredClues(),
    view,
    register,
    preview: (payload: ViewPayload) => previewMatched(payload),
    drainToasts,
  }
}
