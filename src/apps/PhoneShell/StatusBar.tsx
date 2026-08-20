/**
 * src/apps/PhoneShell/StatusBar.tsx
 *
 * 顶部状态栏：假设系统时间 / 电量 / 信号（交互设计 §二）。
 *  风险值红边（risk>70 屏幕边缘变红，§四.1）由 useRedEdgeIntensity 驱动，
 *  覆盖在 PhoneShell 上（本组件只负责状态栏本身；红边 overlay 在 PhoneShell）。
 *  倒计时内联显示（CountdownBadge inline 模式）。
 *  心跳视觉：risk>70 或倒计时进行时屏幕规律脉冲（由 PhoneShell overlay 处理，
 *  本组件显示一个心形 + 速率指示）。
 */
import { useEffect, useState } from 'react'
import { useRisk, useChapter } from '@/utils/shellState'
import { CountdownBadge } from '@/ui/Countdown'
import { formatClock, GAME_START_MS } from '@/utils/time'
import { Glyph } from '@/ui/icons'
import { palette } from '@/ui/theme'

const COUNTDOWN_FINALE = 'countdown-finale' as const

export function StatusBar() {
  const { risk, isRedAlert } = useRisk()
  const { currentChapterId } = useChapter()
  // 游戏内时间：从 2026-03-13 15:00 起，现实 1x 递进（每秒更新）
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const gameClockMs = GAME_START_MS + (now - GAME_START_MS)
  void gameClockMs // 用现实时间近似游戏内时间（简单递进）

  const isLateChapter = ['ch-5', 'ch-finale'].includes(currentChapterId)

  return (
    <div
      style={{
        // in-flow：占据屏幕列首，下方 App 内容自然下移，不再被遮挡。
        //（此前为 absolute overlay 盖在 App 之上，导致各 App 顶部头部被遮——BUG）
        position: 'relative',
        left: 0,
        right: 0,
        height: 44,
        flexShrink: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        color: palette.textPrimary,
        fontSize: 13,
        fontWeight: 600,
        background: 'rgba(10,10,15,0.5)',
        backdropFilter: 'blur(8px)',
        pointerEvents: 'none',
      }}
      aria-hidden="false"
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
        {formatClock(now)}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isRedAlert || isLateChapter ? (
          <span
            className="ui-heartbeat"
            aria-label="心跳加速"
            style={{ display: 'inline-flex', color: palette.danger, fontSize: 12, animation: 'ui-heartbeat 1s ease-in-out infinite' }}
          >
            <Glyph name="album" size={12} color={palette.danger} />
          </span>
        ) : null}
        <CountdownBadge countdownId={COUNTDOWN_FINALE} floating={false} style={{ fontSize: 13 }} />
        <Glyph name="signal" size={14} color={palette.textPrimary} />
        <Glyph name="battery" size={20} color={isRedAlert ? palette.danger : palette.textPrimary} />
        <span style={{ fontSize: 11, opacity: 0.85 }}>{isRedAlert ? `${Math.round(risk)}%` : '87%'}</span>
      </div>
    </div>
  )
}
