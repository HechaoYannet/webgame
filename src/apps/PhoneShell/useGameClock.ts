/**
 * src/apps/PhoneShell/useGameClock.ts
 *
 * 游戏内时钟（"2026-03-13 15:00 + 真实流逝"），供状态栏与桌面大时钟共用。
 * 统一从 @/utils/time 的 gameNowMs() 取值，避免两处各算一套导致时间对不上。
 */
import { useEffect, useState } from 'react'
import { gameNowMs } from '@/utils/time'

export function useGameClock(intervalMs = 1000): number {
  const [now, setNow] = useState<number>(() => gameNowMs())
  useEffect(() => {
    const t = window.setInterval(() => setNow(gameNowMs()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return now
}
