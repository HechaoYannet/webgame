/**
 * WechatApp/ImageViewer.tsx — 图片放大查看器
 *
 * 用途：朋友圈配图可放大查看→放大见隐藏细节（信息架构 §2.3：李桥瑞3/1模糊证书
 * 放大后见"新希望"字样；3/9校园后墙放大见地上钥匙）。真实图片经候选扩展名解析，
 * 资源缺失时回落中性占位（不再显示 assetId 调试文本）。
 */
import { useCallback, useEffect, useState } from 'react'
import { imageUrlCandidates } from '@/utils/assetUrl'

export interface ImageViewerProps {
  assetId: string;
  caption?: string;
  open: boolean;
  onClose: () => void;
}

export function ImageViewer({
  assetId,
  caption,
  open,
  onClose,
}: ImageViewerProps): JSX.Element | null {
  const [idx, setIdx] = useState(0)

  // 切换图片时重置候选下标
  useEffect(() => {
    setIdx(0)
  }, [assetId, open])

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, handleKey]);

  if (!open) return null;

  const candidates = imageUrlCandidates(assetId)
  const failed = idx >= candidates.length

  return (
    <div
      className="wc-image-viewer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={caption ?? "图片预览"}
    >
      <div
        className="wc-image-viewer-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wc-image-viewer-img" data-asset-id={assetId}>
          {failed ? (
            <div className="wc-image-viewer-placeholder" aria-hidden="true" />
          ) : (
            <img
              src={candidates[idx]}
              alt={caption ?? ""}
              onError={() => setIdx((i) => i + 1)}
              style={{ maxWidth: "100%", maxHeight: "70vh", display: "block", borderRadius: 8 }}
            />
          )}
          {caption && <div className="wc-image-viewer-caption">{caption}</div>}
        </div>
        <button
          type="button"
          className="wc-image-viewer-close"
          onClick={onClose}
          aria-label="关闭"
        >
          ×
        </button>
      </div>
    </div>
  );
}
