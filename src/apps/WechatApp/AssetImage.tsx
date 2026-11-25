/**
 * WechatApp/AssetImage.tsx — 资源图片渲染（统一候选扩展名解析）
 *
 * 走 @/utils/assetUrl 的 imageUrlCandidates（'', .png, .jpg, .jpeg, .webp, .gif, .svg），
 * onError 依序推进；全部候选失败时渲染无文字的浅灰块（中性回退），
 * 不显示「图片」字样，也不显示 assetId 调试文本。
 *
 * 尺寸由 className 控制（外层容器 100% 填充父级）。
 */
import { useEffect, useState } from 'react'
import { imageUrlCandidates } from '@/utils/assetUrl'

export interface AssetImageProps {
  assetId: string
  alt?: string
  /** 作用于外层容器，用于控制尺寸（默认 100% 填充父级）。 */
  className?: string
  /** object-fit，默认 cover。 */
  fit?: 'cover' | 'contain'
}

export function AssetImage({
  assetId,
  alt = '',
  className = '',
  fit = 'cover',
}: AssetImageProps): JSX.Element {
  const [idx, setIdx] = useState(0)
  // assetId 变化时重置候选下标（同一组件复用渲染不同图片）
  useEffect(() => {
    setIdx(0)
  }, [assetId])

  const candidates = imageUrlCandidates(assetId)
  const failed = !assetId || idx >= candidates.length

  return (
    <span className={`wc-asset-image ${className}`.trim()}>
      {failed ? (
        <span className="wc-asset-image-fallback" aria-hidden="true" />
      ) : (
        <img
          className="wc-asset-image-img"
          src={candidates[idx]}
          alt={alt}
          loading="lazy"
          onError={() => setIdx((i) => i + 1)}
          style={{ width: '100%', height: '100%', objectFit: fit, display: 'block' }}
        />
      )}
    </span>
  )
}
