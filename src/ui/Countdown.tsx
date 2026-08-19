/**
 * src/ui/Countdown.tsx
 *
 * 倒计时悬浮组件（CLAUDE.md §6.6 + 交互设计 §四.2）。
 * 实验室后台触发后显示红色 mm:ss 浮窗，伴随心跳脉冲视觉。
 * 不可回退（超时切 bad 结局由 engine EndingTrigger.countdownExpired 处理）。
 *
 * 本组件是纯展示：从注入的 useCountdown hook 读 remainingSec。
 * shellState.useCountdown 是 engine 集成关口，fallback 时 active=false 不渲染。
 */
import type { CSSProperties } from 'react'
import { useCountdown } from '@/utils/shellState'
import { formatCountdown } from '@/utils/time'
import { palette, radius } from '@/ui/theme'

export interface CountdownBadgeProps {
  countdownId?: string
  /** 自定义样式覆盖。 */
  style?: CSSProperties
  /** 浮窗模式（默认 true：fixed 右上角悬浮）。 */
  floating?: boolean
  /** 标签（如"尽快整理证据并报警"），可选。 */
  label?: string
}

export function CountdownBadge({ countdownId, style, floating = true, label }: CountdownBadgeProps) {
  const cd = useCountdown(countdownId)
  if (!cd.active) return null
  const remaining = cd.remainingSec
  const danger = remaining <= 30 // 最后 30 秒更剧烈
  const pulse = danger ? 'ui-countdown-pulse-fast' : 'ui-countdown-pulse'

  if (floating) {
    return (
      <div
        role="timer"
        aria-live="polite"
        aria-label={`倒计时 ${formatCountdown(remaining)}`}
        className={pulse}
        style={{
          position: 'fixed',
          top: 44,
          right: 12,
          zIndex: 50,
          background: 'rgba(180, 20, 20, 0.92)',
          color: '#fff',
          padding: '6px 12px',
          borderRadius: radius.md,
          fontSize: 18,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          ...style,
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1 }}>{formatCountdown(remaining)}</span>
        {label ? <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.9 }}>{label}</span> : null}
      </div>
    )
  }
  // 内联模式（嵌入状态栏）
  return (
    <span
      role="timer"
      aria-live="polite"
      className={pulse}
      style={{
        color: palette.danger,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        ...style,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: palette.danger, display: 'inline-block' }} />
      {formatCountdown(remaining)}
    </span>
  )
}
