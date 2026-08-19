/**
 * src/engine/hooks/useCountdown.ts
 *
 * 订阅倒计时（CLAUDE.md §hooks + §6.6）。
 * 每 250ms tick，刷新后按 (now-startedAt) 算真实剩余；归零自动触发 bad 结局。
 */

import { useEffect, useRef, useState } from 'react'
import { tick, getCountdownInfo, isActive, isExpired, type CountdownInfo } from '@/engine/countdown/CountdownService'
import { on } from '@/engine/eventBus'

export function useCountdown(countdownId: string, tickMs = 250) {
  const [info, setInfo] = useState<CountdownInfo | null>(() => getCountdownInfo(countdownId))
  const raf = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const update = () => {
      const i = tick(countdownId)
      setInfo(i)
    }
    update()
    // 仅当倒计时存在时启动 tick（节省空转）
    if (getCountdownInfo(countdownId)) {
      raf.current = setInterval(update, tickMs)
    }
    return () => {
      if (raf.current) clearInterval(raf.current)
      raf.current = null
    }
  }, [countdownId, tickMs])

  // 监听启动事件：倒计时启动后强制开始 tick
  useEffect(() => {
    const unsub = on('countdownStarted', ({ countdownId: id }) => {
      if (id === countdownId) {
        setInfo(getCountdownInfo(countdownId))
        if (raf.current) clearInterval(raf.current)
        raf.current = setInterval(() => {
          const i = tick(countdownId)
          setInfo(i)
        }, tickMs)
      }
    })
    return unsub
  }, [countdownId, tickMs])

  return {
    info,
    remainingSec: info?.remainingSec ?? 0,
    durationSec: info?.durationSec ?? 0,
    progress: info?.progress ?? 1,
    expired: isExpired(countdownId),
    active: isActive(countdownId),
  }
}
