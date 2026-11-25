/**
 * src/apps/QqApp/components.tsx
 *
 * QqApp 本地展示组件（frontend-qq 独占）。
 * 不依赖 src/ui（phone-shell agent 独占，并行构建、API 未冻结），自包含轻量件：
 * 头像/图片查看器/加载态/返回头/时间格式化/useAsync。
 *
 * 资源解析统一走 @/utils/assetUrl 的 imageUrlCandidates（含 .svg 候选）；
 * 全部候选失败才回退（头像→首字色块，图片→无文字中性灰块）。
 * 不显示「图片」/「占位」等字样，也不显示 assetId 调试文本。
 */
import { imageUrlCandidates } from '@/utils/assetUrl'
import { getContact } from '@/data/loader'
import { formatShortDateTime } from '@/utils/time'
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

/** 安全取角色头像 assetId（loader 未就绪/无该角色时返回空串）。 */
function avatarAssetIdFor(charId: string): string {
  try {
    return getContact(charId)?.avatarAssetId ?? ''
  } catch {
    return ''
  }
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
  const assetId = isGroup ? '' : avatarAssetIdFor(charId)
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    setIdx(0)
  }, [assetId])
  const candidates = assetId ? imageUrlCandidates(assetId) : []
  const hasImage = idx < candidates.length
  return (
    <div
      className="qq-avatar"
      style={
        {
          width: `${size}px`,
          height: `${size}px`,
          background: hasImage ? 'transparent' : colorFor(charId),
          fontSize: `${Math.round(size * 0.42)}px`,
        } as CSSProperties
      }
      aria-label={name}
    >
      {hasImage ? (
        <img
          className="qq-avatar-img"
          src={candidates[idx]}
          alt=""
          loading="lazy"
          onError={() => setIdx((i) => i + 1)}
        />
      ) : (
        label
      )}
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
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    setIdx(0)
  }, [assetId])
  const candidates = imageUrlCandidates(assetId)
  const failed = !assetId || idx >= candidates.length
  const label = alt ?? caption ?? ''
  return (
    <button
      type="button"
      className={`${cls}${onZoom ? ' zoomable' : ''}${failed ? ' is-fallback' : ' has-image'}`}
      onClick={onZoom}
      title={label || undefined}
    >
      {failed ? (
        <span className="qq-image-fallback" aria-hidden="true" />
      ) : (
        <img
          className="qq-image-real"
          src={candidates[idx]}
          alt={label}
          loading="lazy"
          onError={() => setIdx((i) => i + 1)}
        />
      )}
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
  const [idx, setIdx] = useState(0)
  const candidates = imageUrlCandidates(assetId)
  useEffect(() => {
    setIdx(0)
  }, [assetId])
  const failed = !assetId || idx >= candidates.length
  const label = alt ?? caption ?? ''
  return (
    <div className="qq-image-viewer" onClick={onClose} role="dialog" aria-label={caption ?? '图片预览'}>
      <div className="qq-image-viewer-inner" onClick={(e) => e.stopPropagation()}>
        <div className="qq-image-viewer-img">
          {failed ? (
            <span className="qq-image-fallback big" aria-hidden="true" />
          ) : (
            <img
              src={candidates[idx]}
              alt={label}
              onError={() => setIdx((i) => i + 1)}
              style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: 8, display: 'block' }}
            />
          )}
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

/** 统一走 @/utils/time（游戏时区 +08:00），转调 formatShortDateTime。 */
export function formatTime(iso: string): string {
  return formatShortDateTime(iso) || iso
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
