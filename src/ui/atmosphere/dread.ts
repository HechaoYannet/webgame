/**
 * src/ui/atmosphere/dread.ts
 *
 * 「不安程度」的唯一计算入口。UI 里所有氛围效果（颗粒浓度、暗角、低语频率、
 * 录制红点、标签页标题）都只读这个 hook，避免各处各算一套。
 *
 * 来源是玩家看得见的进度，不是随机数：
 *   章节越靠后越强；证据看得越多越强；终章倒计时期间拉到最高；
 *   通关后归零（结局页面不再施加氛围压力）。
 */
import { useGameStore } from '@/game/gameStore'

/** 章节 → 基础不安等级。未列出的章节按 0 处理。 */
const CHAPTER_DREAD: Record<string, number> = {
  'ch-prologue': 0,
  'ch-1': 1,
  'ch-2': 1,
  'ch-3': 2,
  'ch-4': 2,
  'ch-5': 3,
  'ch-finale': 3,
}

export const FINALE_COUNTDOWN_ID = 'countdown-finale'

export interface DreadSnapshot {
  /** 0 平静 · 1 轻微 · 2 明显 · 3 终章 */
  level: number
  /** 0..1，供 inline style / CSS 变量使用 */
  intensity: number
  /** 终章倒计时是否正在跑 */
  finale: boolean
  chapterId: string
  evidenceCount: number
}

export interface DreadInput {
  chapterId: string
  evidenceCount: number
  finale: boolean
  finished: boolean
}

/** 纯函数：便于单测与在非 React 场景复用。 */
export function computeDread(input: DreadInput): number {
  if (input.finished) return 0
  if (input.finale) return 3
  let level = CHAPTER_DREAD[input.chapterId] ?? 0
  // 证据是"你越查越靠近"的度量：看得越多，屋子越不对劲。
  if (input.evidenceCount >= 4) level = Math.max(level, 2)
  if (input.evidenceCount >= 8) level = Math.max(level, 3)
  return Math.max(0, Math.min(3, level))
}

export function useDread(): DreadSnapshot {
  const chapterId = useGameStore((s) => s.currentChapterId)
  const evidenceCount = useGameStore((s) => s.collectedEvidenceIds.length)
  const countdown = useGameStore((s) => s.countdowns?.[FINALE_COUNTDOWN_ID])
  const finished = useGameStore((s) => s.finished)

  const finale = Boolean(countdown && !countdown.expired)
  const level = computeDread({ chapterId, evidenceCount, finale, finished })
  return { level, intensity: level / 3, finale, chapterId, evidenceCount }
}
