/**
 * src/sites/shared/placeholder.tsx
 *
 * 占位资源组件——"缺失图片/音频/视频/PDF 在 JSON 里引用占位，用户后换"的唯一渲染路径。
 *
 * 机制：先试 `public/assets/<assetId>` 真实文件；加载失败（onError）即回落到带 assetId
 * 标签的占位框（灰底虚线）。用户日后把真文件丢到 public/assets/<assetId>.png|.jpg|.svg
 * 即自动生效，JSON 的 assetId 永不改。
 *
 * 当前 public/assets/ 为空——所有 assetId 一开始即走占位（不是"以后才有"）。
 *
 * 站点图片一律用 <PlaceholderImage>，禁止裸 <img src>（编排层 Phase5 grep 把关）。
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'

const placeholderBox: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#e9ecef',
  border: '1px dashed #adb5bd',
  color: '#6c757d',
  fontSize: 12,
  fontFamily: 'system-ui, sans-serif',
  textAlign: 'center',
  padding: 8,
  boxSizing: 'border-box',
}

function assetUrl(assetId: string): string {
  // import.meta.env.BASE_URL 必须原样出现（CLAUDE.md §2）
  return `${import.meta.env.BASE_URL}assets/${assetId}`
}

export interface PlaceholderImageProps {
  assetId: string
  alt?: string
  className?: string
  style?: CSSProperties
  caption?: string
}

/** 图片占位：试真图 → 失败回落带 assetId 标签的灰框。 */
export function PlaceholderImage({ assetId, alt, className, style, caption }: PlaceholderImageProps): JSX.Element {
  const [errored, setErrored] = useState(false)
  if (errored) {
    return (
      <div className={className} style={{ ...placeholderBox, width: '100%', minHeight: 120, ...style }} data-asset-id={assetId}>
        <span>{alt ?? assetId}{caption ? ` · ${caption}` : ''}</span>
      </div>
    )
  }
  return (
    <img
      className={className}
      style={style}
      src={assetUrl(assetId)}
      alt={alt ?? ''}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  )
}

export interface PlaceholderMediaProps {
  assetId: string
  kind: 'audio' | 'video'
  label?: string
  style?: CSSProperties
}

/** 音频/视频占位：试真文件 → 失败回落"待替换"控件样占位。 */
export function PlaceholderMedia({ assetId, kind, label, style }: PlaceholderMediaProps): JSX.Element {
  const ref = useRef<HTMLMediaElement>(null)
  const [errored, setErrored] = useState(false)
  useEffect(() => {
    if (errored && ref.current) {
      // 失败时无操作；占位由条件渲染承担
    }
  }, [errored])
  if (errored) {
    return (
      <div style={{ ...placeholderBox, minHeight: 64, ...style }} data-asset-id={assetId}>
        <span>{label ?? (kind === 'video' ? '实时画面' : '音频')}：待替换 ({assetId})</span>
      </div>
    )
  }
  if (kind === 'video') {
    return (
      <video
        ref={ref as React.RefObject<HTMLVideoElement>}
        style={style}
        src={assetUrl(assetId)}
        autoPlay
        loop
        muted
        playsInline
        onError={() => setErrored(true)}
      />
    )
  }
  return (
    <audio
      ref={ref as React.RefObject<HTMLAudioElement>}
      src={assetUrl(assetId)}
      onError={() => setErrored(true)}
    />
  )
}

export interface PlaceholderPdfProps {
  assetId: string
  style?: CSSProperties
}

/** PDF 占位：文件缺失时显示"PDF 待替换"。站点/arxiv 用（真 PDF 由 pdfjs 渲染，此处兜底）。 */
export function PlaceholderPdf({ assetId, style }: PlaceholderPdfProps): JSX.Element {
  return (
    <div style={{ ...placeholderBox, minHeight: 200, ...style }} data-asset-id={assetId}>
      <span>PDF 文档：待替换 ({assetId})</span>
    </div>
  )
}
