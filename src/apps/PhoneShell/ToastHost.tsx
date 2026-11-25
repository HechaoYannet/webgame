/**
 * src/apps/PhoneShell/ToastHost.tsx
 *
 * 全局 toast 渲染宿主（审核报告 2.E / §3：showToast 有调用方但 useToasts 没有消费者，
 * 所有轻量反馈都静默丢弃）。这里补上唯一渲染出口，供死交互的「最小反馈」方案使用。
 */
import { dismissToast, useToasts } from '@/utils/shellState'
import { alertStyleColor, palette, radius, spacing } from '@/ui/theme'

export function ToastHost() {
  const toasts = useToasts()
  if (toasts.length === 0) return null
  return (
    <div
      aria-live="polite"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 'calc(40px + var(--home-inset, 0px))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing.xs,
        zIndex: 70,
        pointerEvents: 'none',
        padding: `0 ${spacing.md}px`,
      }}
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismissToast(t.id)}
          style={{
            pointerEvents: 'auto',
            maxWidth: 320,
            textAlign: 'left',
            background: 'rgba(20,22,30,0.94)',
            border: `1px solid ${alertStyleColor[t.variant] ?? palette.border}`,
            borderLeft: `3px solid ${alertStyleColor[t.variant] ?? palette.accent}`,
            borderRadius: radius.md,
            color: palette.textPrimary,
            fontSize: 12.5,
            lineHeight: 1.5,
            padding: `${spacing.sm}px ${spacing.md}px`,
            boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
            animation: 'ui-slide-down 0.2s ease-out',
            cursor: 'pointer',
          }}
        >
          {t.text}
        </button>
      ))}
    </div>
  )
}
