/**
 * src/sites/shared/placeholder.tsx
 *
 * 占位资源组件——"缺失图片/音频/视频/PDF 在 JSON 里引用占位，用户后换"的唯一渲染路径。
 *
 * 机制：按候选 URL 依序尝试（先 "assets/<assetId>" 原样，再补常见扩展名 .png/.jpg/.webp…），
 * 全部失败后回落到中性的灰底占位框（不再显示 assetId 调试文本，避免出戏）。
 *
 * 注意：public/data 的 assetId 不带扩展名（photo-campus-backwall），真实文件带扩展名
 * （photo-campus-backwall.png），多候选解析让现有素材全部生效。
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { imageUrlCandidates, mediaUrlCandidates } from '@/utils/assetUrl'

const placeholderBox: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg,#eef0f3 0%,#e2e5ea 100%)",
  border: "1px solid #d4d8de",
  color: "#9aa2ad",
  fontSize: 12,
  fontFamily: "system-ui, sans-serif",
  textAlign: "center",
  padding: 8,
  boxSizing: "border-box",
  minHeight: 96,
}

export interface PlaceholderImageProps {
  assetId: string
  alt?: string
  className?: string
  style?: CSSProperties
  caption?: string
}

/** 图片占位：依序尝试候选 URL，全部失败回落中性灰框。 */
export function PlaceholderImage({ assetId, alt, className, style, caption }: PlaceholderImageProps): JSX.Element {
  const [idx, setIdx] = useState(0)
  const candidates = imageUrlCandidates(assetId)
  if (idx >= candidates.length) {
    return (
      <div className={className} style={{ ...placeholderBox, width: "100%", ...style }} data-asset-id={assetId}>
        <span>{alt ?? ""}{caption ? ` · ${caption}` : ""}</span>
      </div>
    )
  }
  return (
    <img
      className={className}
      style={{ ...style, maxWidth: "100%" }}
      src={candidates[idx]}
      alt={alt ?? ""}
      loading="lazy"
      onError={() => setIdx((i) => i + 1)}
    />
  )
}

export interface PlaceholderMediaProps {
  assetId: string
  kind: "audio" | "video"
  label?: string
  style?: CSSProperties
}

/** 音频/视频占位：依序尝试候选 URL，失败回落中性占位。 */
export function PlaceholderMedia({ assetId, kind, label, style }: PlaceholderMediaProps): JSX.Element {
  const ref = useRef<HTMLMediaElement>(null)
  const [idx, setIdx] = useState(0)
  const candidates = mediaUrlCandidates(assetId)
  useEffect(() => {
    setIdx(0)
  }, [assetId])
  if (idx >= candidates.length) {
    return (
      <div style={{ ...placeholderBox, minHeight: 64, ...style }} data-asset-id={assetId}>
        <span>{label ?? (kind === "video" ? "实时画面" : "音频")}</span>
      </div>
    )
  }
  if (kind === "video") {
    return (
      <video
        ref={ref as React.RefObject<HTMLVideoElement>}
        style={style}
        src={candidates[idx]}
        autoPlay
        loop
        muted
        playsInline
        onError={() => setIdx((i) => i + 1)}
      />
    )
  }
  return (
    <audio
      ref={ref as React.RefObject<HTMLAudioElement>}
      src={candidates[idx]}
      onError={() => setIdx((i) => i + 1)}
    />
  )
}

export interface PlaceholderPdfProps {
  assetId: string
  style?: CSSProperties
}

/** PDF 占位：文件缺失时显示中性占位。站点/arxiv 用（真 PDF 由 pdfjs 渲染，此处兜底）。 */
export function PlaceholderPdf({ assetId, style }: PlaceholderPdfProps): JSX.Element {
  return (
    <div style={{ ...placeholderBox, minHeight: 200, ...style }} data-asset-id={assetId}>
      <span>PDF 文档</span>
    </div>
  )
}
