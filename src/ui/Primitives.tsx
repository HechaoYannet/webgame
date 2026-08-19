/**
 * src/ui/Primitives.tsx
 *
 * 共享基础 UI 原件（button / input / list / screen header / tag）。
 * 暗色基调，所有 App 复用，不得各自重造（CLAUDE.md agent 定义强制规则 2）。
 */
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
} from 'react'
import { cn } from '@/utils/cn'
import { palette, radius, spacing } from '@/ui/theme'
import { Glyph } from '@/ui/icons'

// ===== Button =====
type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'subtle' | 'link'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  iconLeft?: string
  iconRight?: string
  loading?: boolean
}

const buttonVariantBg: Record<ButtonVariant, string> = {
  primary: palette.accent,
  ghost: 'transparent',
  danger: palette.danger,
  subtle: palette.bgElevated,
  link: 'transparent',
}

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  iconLeft,
  iconRight,
  loading,
  className,
  style,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const padY = size === 'sm' ? 6 : size === 'lg' ? 14 : 10
  const padX = size === 'sm' ? 10 : size === 'lg' ? 18 : 14
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 16 : 14
  const isGhost = variant === 'ghost' || variant === 'link'
  const isDanger = variant === 'danger'
  const isPlain = variant === 'ghost' || variant === 'link' || variant === 'subtle'
  const btnStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: `${padY}px ${padX}px`,
    borderRadius: radius.md,
    fontSize,
    fontWeight: 500,
    width: block ? '100%' : undefined,
    background: buttonVariantBg[variant],
    color: isGhost ? (isDanger ? palette.danger : palette.textPrimary) : '#fff',
    border: isPlain ? (variant === 'subtle' ? `1px solid ${palette.border}` : 'none') : 'none',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'filter .15s, transform .05s',
    userSelect: 'none' as const,
    ...style,
  }
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn('ui-button', className)}
      style={btnStyle}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.98)'
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
      }}
      {...rest}
    >
      {loading ? (
        <span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'ui-spin 0.8s linear infinite' }} />
      ) : iconLeft ? (
        <Glyph name={iconLeft} size={fontSize + 2} color="currentColor" />
      ) : null}
      {children}
      {iconRight && !loading ? <Glyph name={iconRight} size={fontSize + 2} color="currentColor" /> : null}
    </button>
  )
}

// ===== Input =====
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  iconLeft?: string
}

export function Input({ invalid, iconLeft, className, style, ...rest }: InputProps) {
  const inputStyle: CSSProperties = {
    width: '100%',
    background: palette.bgInput,
    color: palette.textPrimary,
    border: `1px solid ${invalid ? palette.danger : palette.border}`,
    borderRadius: radius.md,
    padding: iconLeft ? '10px 12px 10px 34px' : '10px 12px',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color .15s',
    boxSizing: 'border-box',
    ...style,
  }
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {iconLeft ? (
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: palette.textTertiary, display: 'flex' }}>
          <Glyph name={iconLeft} size={16} color={palette.textTertiary} />
        </span>
      ) : null}
      <input
        className={cn('ui-input', className)}
        style={inputStyle}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = invalid ? palette.danger : palette.borderLight
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = invalid ? palette.danger : palette.border
        }}
        {...rest}
      />
    </div>
  )
}

// ===== Screen Header（App 顶部栏通用）=====
export interface ScreenHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  onBack?: () => void
  right?: ReactNode
  themeColor?: string
  /** 是否固定吸顶（默认 true）。 */
  sticky?: boolean
}

export function ScreenHeader({ title, subtitle, onBack, right, themeColor, sticky = true }: ScreenHeaderProps) {
  return (
    <header
      style={{
        position: sticky ? 'sticky' : 'relative',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm,
        padding: `${spacing.sm}px ${spacing.md}px`,
        background: palette.bgCard,
        borderBottom: `1px solid ${palette.border}`,
        color: palette.textPrimary,
        minHeight: 48,
      }}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="返回"
          style={{ background: 'none', border: 'none', color: palette.textPrimary, cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <Glyph name="back" size={22} color={themeColor ?? palette.textPrimary} />
        </button>
      ) : null}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        {subtitle ? (
          <span style={{ fontSize: 12, color: palette.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</span>
        ) : null}
      </div>
      {right ? <div style={{ flexShrink: 0 }}>{right}</div> : null}
    </header>
  )
}

// ===== List =====
export interface ListRowProps {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
  danger?: boolean
  unread?: number
  selected?: boolean
  style?: CSSProperties
}

export function ListRow({ leading, title, subtitle, trailing, onClick, danger, unread, selected, style }: ListRowProps) {
  const interactive = !!onClick
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick?.()
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
        padding: `${spacing.md}px ${spacing.lg}px`,
        background: selected ? palette.bgElevated : 'transparent',
        borderBottom: `1px solid ${palette.divider}`,
        cursor: interactive ? 'pointer' : 'default',
        position: 'relative',
        ...style,
      }}
    >
      {leading ? <div style={{ flexShrink: 0 }}>{leading}</div> : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
          <span style={{ fontSize: 15, color: danger ? palette.danger : palette.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: unread ? 600 : 400 }}>{title}</span>
          {unread ? (
            <span style={{ background: palette.danger, color: '#fff', borderRadius: 999, fontSize: 10, minWidth: 16, height: 16, padding: '0 4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{unread > 99 ? '99+' : unread}</span>
          ) : null}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 13, color: palette.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{subtitle}</div>
        ) : null}
      </div>
      {trailing ? <div style={{ flexShrink: 0, color: palette.textTertiary }}>{trailing}</div> : null}
    </div>
  )
}

export function List({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: palette.bgCard, ...style }}>{children}</div>
}

// ===== Tag =====
export function Tag({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 11,
        padding: '2px 6px',
        borderRadius: radius.sm,
        background: (color ?? palette.border) + '33',
        color: color ?? palette.textSecondary,
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  )
}

// ===== Empty State =====
export function EmptyState({ icon, title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl * 2, color: palette.textTertiary, textAlign: 'center' }}>
      {icon ? <Glyph name={icon} size={40} color={palette.borderLight} /> : null}
      <div style={{ fontSize: 14, color: palette.textSecondary }}>{title}</div>
      {hint ? <div style={{ fontSize: 12, color: palette.textTertiary, maxWidth: 240 }}>{hint}</div> : null}
    </div>
  )
}

// ===== Spinner =====
export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <span
      role="status"
      aria-label="加载中"
      style={{
        width: size,
        height: size,
        border: `${Math.max(2, Math.round(size / 10))}px solid ${palette.border}`,
        borderTopColor: palette.accent,
        borderRadius: '50%',
        display: 'inline-block',
        animation: 'ui-spin 0.8s linear infinite',
      }}
    />
  )
}
