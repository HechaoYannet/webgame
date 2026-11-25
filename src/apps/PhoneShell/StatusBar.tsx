/**
 * src/apps/PhoneShell/StatusBar.tsx
 *
 * 顶部状态栏：游戏内系统时间 / 电量 / 信号。
 *
 * 2026-11 改版：
 *  - 视觉收敛到 phone-shell.css（.statusbar），字重/字号/刻度更接近真机；
 *  - 时间改用 useGameClock（与桌面大时钟同一来源）；
 *  - 心理恐怖细节：章节推进后，时间会极偶尔地闪成 "23:18"（他最后一条留言的时刻），
 *    持续 140ms，随即恢复 —— 玩家多半会怀疑自己看错；
 *  - dread=3（终章）时状态栏出现一个极小的录制红点。
 *
 * 倒计时（CountdownBadge inline 模式）仍由 shellState.useCountdown 驱动。
 */
import { useEffect, useState } from 'react'
import { useRisk } from '@/utils/shellState'
import { CountdownBadge } from '@/ui/Countdown'
import { formatClock } from '@/utils/time'
import { Glyph } from '@/ui/icons'
import { palette } from '@/ui/theme'
import { useGameClock } from '@/apps/PhoneShell/useGameClock'
import { useDread } from '@/ui/atmosphere/dread'

const COUNTDOWN_FINALE = 'countdown-finale' as const

/** 那一夜的时刻：3月12日 23:18（他最后一条留言）。作为极短闪现，不解释、不重复。 */
const SUBLIMINAL_TIME = '23:18'

export function StatusBar() {
  const { isRedAlert } = useRisk()
  const { level } = useDread()
  const clockMs = useGameClock(1000)
  const [flash, setFlash] = useState(false)

  // 极偶尔的时间闪现：章节推进后每 70~150 秒一次，只亮 140ms。
  useEffect(() => {
    if (level < 2) {
      setFlash(false)
      return
    }
    let cancelled = false
    let holdTimer: number | undefined
    let nextTimer: number | undefined

    const schedule = () => {
      const delay = 70_000 + Math.random() * 80_000
      nextTimer = window.setTimeout(() => {
        if (cancelled) return
        setFlash(true)
        holdTimer = window.setTimeout(() => {
          if (cancelled) return
          setFlash(false)
          schedule()
        }, 140)
      }, delay)
    }
    schedule()

    return () => {
      cancelled = true
      if (holdTimer !== undefined) window.clearTimeout(holdTimer)
      if (nextTimer !== undefined) window.clearTimeout(nextTimer)
    }
  }, [level])

  return (
    <div className="statusbar">
      <span className={flash ? 'statusbar-time subliminal' : 'statusbar-time'} aria-label="系统时间">
        {level >= 3 ? <span className="statusbar-rec" aria-label="录制中" /> : null}
        {flash ? SUBLIMINAL_TIME : formatClock(clockMs)}
      </span>

      <div className="statusbar-right">
        {isRedAlert ? (
          <span
            aria-label="心跳加速"
            style={{
              display: 'inline-flex',
              color: palette.danger,
              animation: 'ui-heartbeat 1s ease-in-out infinite',
            }}
          >
            <Glyph name="heart" size={11} color={palette.danger} />
          </span>
        ) : null}
        <CountdownBadge countdownId={COUNTDOWN_FINALE} floating={false} style={{ fontSize: 12.5 }} />
        <Glyph name="signal" size={13} color={palette.textPrimary} />
        <Glyph name="battery" size={19} color={isRedAlert ? palette.danger : palette.textPrimary} />
        <span className="statusbar-batt" style={{ color: isRedAlert ? palette.danger : undefined }}>
          87%
        </span>
      </div>
    </div>
  )
}
