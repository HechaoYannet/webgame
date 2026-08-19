/**
 * src/apps/QqApp/components.tsx
 *
 * QqApp 本地展示组件（frontend-qq 独占）。
 * 不依赖 src/ui（phone-shell agent 独占，并行构建、API 未冻结），自包含轻量件：
 * 头像/图片占位+查看器/密码框/加载态/返回头/时间格式化/useAsync。资源（avatar
 * assetId）由资源 agent 后续补齐，此处用字符占位，以 characterId 作配色 key。
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { ContactId } from '@/types'

const AVATAR_COLORS = [
  '#4a90d9', '#d94a7a', '#5bb85b', '#e08e3c', '#8e6bd9',
  '#3cb8c8', '#d96b3c', '#7a8ea0', '#c84a4a', '#4a8e6b',
]
function colorFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function Avatar({
  charId,
  name,
  size = 40,
  isGroup = false,
}: {
  charId: ContactId
  name: string
  size?: number
  isGroup?: boolean
}) {
  const label = isGroup ? '群' : (name?.[0] ?? '?')
  return (
    <div
      className="qq-avatar"
      style={
        {
          width: `${size}px`,
          height: `${size}px`,
          background: colorFor(charId),
          fontSize: `${Math.round(size * 0.42)}px`,
        } as CSSProperties
      }
      aria-label={name}
    >
      {label}
    </div>
  )
}

export function ImagePlaceholder({
  assetId,
  caption,
  onZoom,
  alt,
  size = 'normal',
}: {
  assetId: string
  caption?: string
  onZoom?: () => void
  alt?: string
  size?: 'normal' | 'small'
}) {
  const cls = size === 'small' ? 'qq-image-placeholder small' : 'qq-image-placeholder'
  return (
    <button
      type="button"
      className={`${cls}${onZoom ? ' zoomable' : ''}`}
      onClick={onZoom}
      title={alt ?? caption ?? assetId}
    >
      <span className="qq-image-placeholder-glyph">🖼</span>
      <span className="qq-image-placeholder-id">{alt ?? caption ?? assetId}</span>
      {onZoom && <span className="qq-image-placeholder-hint">点击放大</span>}
    </button>
  )
}

export function ImageViewer({
  assetId,
  caption,
  alt,
  onClose,
}: {
  assetId: string
  caption?: string
  alt?: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="qq-image-viewer" onClick={onClose} role="dialog" aria-label="图片预览">
      <div className="qq-image-viewer-inner" onClick={(e) => e.stopPropagation()}>
        <div className="qq-image-viewer-img">
          <span className="qq-image-placeholder-glyph big">🖼</span>
          <span className="qq-image-placeholder-id">{alt ?? caption ?? assetId}</span>
        </div>
        {caption && <p className="qq-image-viewer-caption">{caption}</p>}
        <button type="button" className="qq-image-viewer-close" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  )
}

export function Loading({ text = '加载中…' }: { text?: string }) {
  return <div className="qq-state qq-loading">{text}</div>
}
export function ErrorState({ text }: { text: string }) {
  return <div className="qq-state qq-error">{text}</div>
}
export function EmptyState({ text }: { text: string }) {
  return <div className="qq-state qq-empty">{text}</div>
}

export function SubHeader({
  title,
  onBack,
  right,
}: {
  title: ReactNode
  onBack: () => void
  right?: ReactNode
}) {
  return (
    <header className="qq-subheader">
      <button type="button" className="qq-back" onClick={onBack} aria-label="返回">
        ‹
      </button>
      <div className="qq-subheader-title">{title}</div>
      <div className="qq-subheader-right">{right}</div>
    </header>
  )
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

/** 通用异步加载 hook（用于 loadGameData / getMessages / loadGroupFiles）。 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setError(null)
    loader()
      .then((v) => {
        if (alive) setData(v)
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { data, error }
}
