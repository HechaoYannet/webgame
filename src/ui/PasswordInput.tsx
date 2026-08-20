/**
 * src/ui/PasswordInput.tsx
 *
 * 密码输入框（QQ登录/绿中内部系统/实验室后台/PDF密码通用）。
 * 支持显隐切换、回车提交、错误抖动、剩余尝试次数提示。
 * 不持答案校验——提交时仅回调 onSubmit(value)，校验由 engine PuzzleService 完成。
 */
import { useRef, useState, type CSSProperties } from 'react'
import { cn } from '@/utils/cn'
import { palette, radius, spacing } from '@/ui/theme'
import { Glyph } from '@/ui/icons'
import { Button } from '@/ui/Primitives'

export interface PasswordInputProps {
  /** 提交回调（值）由调用方接 engine PuzzleService。 */
  onSubmit: (value: string) => void
  /** 最近一次提交错误信息（来自 engine onFailure），若有则显示红字 + 抖动。 */
  error?: string | null
  /** 成功信息（可选）。 */
  success?: string | null
  /** 输入框占位。 */
  placeholder?: string
  /** 按钮文字。 */
  submitLabel?: string
  /** 当前剩余尝试次数（来自 engine attemptsToHint / lockoutAfterAttempts）。 */
  remainingAttempts?: number
  /** 是否数字键盘（QQ 20251128 / PDF 0312 等纯数字）。 */
  numeric?: boolean
  /** 输入框 autoComplete 透传（默认 off）。 */
  autoComplete?: string
  /** 提交按钮 disabled（engine 锁定后）。 */
  disabled?: boolean
  className?: string
  style?: CSSProperties
}

export function PasswordInput({
  onSubmit,
  error,
  success,
  placeholder = '请输入密码',
  submitLabel = '确认',
  remainingAttempts,
  numeric,
  autoComplete = 'off',
  disabled,
  className,
  style,
}: PasswordInputProps) {
  const [value, setValue] = useState('')
  const [show, setShow] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  const lastErrRef = useRef<string | null | undefined>(undefined)
  if (error !== lastErrRef.current) {
    lastErrRef.current = error
    if (error) setShakeKey((k) => k + 1)
  }

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    ...style,
  }

  const inputWrapStyle: CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    background: palette.bgInput,
    border: `1px solid ${error ? palette.danger : success ? palette.success : palette.border}`,
    borderRadius: radius.md,
    padding: `0 ${spacing.sm}px`,
    animation: error ? 'ui-shake 0.4s' : undefined,
  }

  return (
    <div className={cn('ui-password-input', className)} style={containerStyle} key={shakeKey}>
      <div style={inputWrapStyle}>
        <Glyph name="settings" size={16} color={palette.textTertiary} />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={numeric ? 'numeric' : undefined}
          aria-label={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim() && !disabled) {
              onSubmit(value.trim())
            }
          }}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: palette.textPrimary,
            padding: `${spacing.sm + 2}px ${spacing.sm}px`,
            fontSize: 15,
            letterSpacing: numeric ? 4 : undefined,
          }}
        />
        <button
          type="button"
          aria-label={show ? '隐藏密码' : '显示密码'}
          onClick={() => setShow((s) => !s)}
          style={{ background: 'none', border: 'none', color: palette.textTertiary, cursor: 'pointer', padding: 4, display: 'flex' }}
        >
          <Glyph name="search" size={16} color={palette.textTertiary} />
        </button>
      </div>

      {error ? (
        <div style={{ fontSize: 12, color: palette.danger, display: 'flex', alignItems: 'center', gap: spacing.xs }}>
          <Glyph name="settings" size={12} color={palette.danger} />
          {error}
        </div>
      ) : null}
      {success ? (
        <div style={{ fontSize: 12, color: palette.success }}>{success}</div>
      ) : null}
      {typeof remainingAttempts === 'number' && remainingAttempts >= 0 ? (
        <div style={{ fontSize: 12, color: palette.textTertiary }}>剩余尝试次数 {remainingAttempts}</div>
      ) : null}

      <Button
        block
        disabled={disabled || !value.trim()}
        onClick={() => value.trim() && onSubmit(value.trim())}
      >
        {submitLabel}
      </Button>
    </div>
  )
}
