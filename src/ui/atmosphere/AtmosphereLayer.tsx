/**
 * src/ui/atmosphere/AtmosphereLayer.tsx
 *
 * 覆盖在手机屏幕内容之上的氛围层（pointer-events:none，不影响任何操作）。
 *
 * 它做四件事：
 *   1) 颗粒 / 呼吸的暗角 / 扫描线 / 缓慢下移的亮带 —— 让"屏幕"像一块旧监控回放；
 *   2) 低语：章节推进后，每隔 40~80 秒在屏幕底部浮出半句话，2.8 秒后自行消失；
 *   3) 故障：新证据归档的那一瞬间，整屏错位 260ms（"你看到的东西也看到了你"）；
 *   4) 标签页：切走时标题变成「（1）张强宿舍大逃杀」，回来时恢复 —— 经典的心理暗示，
 *      让玩家自己意识到"有一件事在等你"。
 *
 * 全部强度由 useDread 决定；通关后 level=0，氛围自动消失。
 */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useGameStore } from '@/game/gameStore'
import { useDread } from './dread'

const BASE_TITLE = '张强宿舍大逃杀'
const HIDDEN_TITLE = '（1）张强宿舍大逃杀'

/** 按等级解锁的低语池。都是"房间里多出来的一点点"，不涉及剧情事实。 */
const WHISPERS: string[][] = [
  ['走廊里有脚步声。', '窗外没有风。'],
  ['有人刚看过这些。', '你数过房间里的人吗。', '电池在变少。'],
  ['不要回头。', '门没关。', '他在等你说完。'],
]

function pickWhisper(level: number): string {
  const pool: string[] = []
  for (let i = 0; i <= Math.min(level, WHISPERS.length - 1); i += 1) pool.push(...WHISPERS[i])
  return pool[Math.floor(Math.random() * pool.length)] ?? ''
}

export function AtmosphereLayer() {
  const { level } = useDread()
  const [whisper, setWhisper] = useState<{ id: number; text: string } | null>(null)
  const [glitching, setGlitching] = useState(false)

  // 开局第一次：还在最平静的章节时，也先来一句。只在本组件挂载后 18 秒出现一次。
  useEffect(() => {
    if (level > 0) return
    const t = window.setTimeout(() => setWhisper({ id: Date.now(), text: '门没有锁。' }), 18_000)
    return () => window.clearTimeout(t)
  }, [level])

  // 低语：level>0 才排期；每轮随机 40~80 秒。
  useEffect(() => {
    if (level <= 0) {
      setWhisper(null)
      return
    }
    let cancelled = false
    let timer: number | undefined
    const schedule = () => {
      const delay = 40_000 + Math.random() * 40_000
      timer = window.setTimeout(() => {
        if (cancelled) return
        setWhisper({ id: Date.now(), text: pickWhisper(level) })
        schedule()
      }, delay)
    }
    schedule()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [level])

  // 新证据归档 → 一次故障。只在"数量增加"时触发，跳过挂载首帧。
  const evidenceCount = useGameStore((s) => s.collectedEvidenceIds.length)
  const prevCount = useRef(evidenceCount)
  const glitchTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (evidenceCount > prevCount.current && level > 0) {
      setGlitching(true)
      if (glitchTimer.current !== undefined) window.clearTimeout(glitchTimer.current)
      glitchTimer.current = window.setTimeout(() => setGlitching(false), 300)
    }
    prevCount.current = evidenceCount
  }, [evidenceCount, level])

  useEffect(() => () => {
    if (glitchTimer.current !== undefined) window.clearTimeout(glitchTimer.current)
  }, [])

  // 标签页标题：切走后出现"1 条未读"，切回来恢复。
  useEffect(() => {
    const sync = () => {
      if (typeof document === 'undefined') return
      if (level >= 2 && document.visibilityState === 'hidden') {
        document.title = HIDDEN_TITLE
      } else {
        document.title = BASE_TITLE
      }
    }
    document.addEventListener('visibilitychange', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      document.title = BASE_TITLE
    }
  }, [level])

  return (
    <div
      className="atm"
      aria-hidden="true"
      style={{ '--dread': String(level) } as CSSProperties}
    >
      <div className="atm-scanlines" />
      <div className="atm-sweep" />
      <div className="atm-vignette" />
      <div className="atm-grain" />
      {whisper ? (
        <div key={whisper.id} className="atm-whisper">
          {whisper.text}
        </div>
      ) : null}
      {glitching ? <div className="atm-glitch" /> : null}
    </div>
  )
}
