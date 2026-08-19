/**
 * WechatApp/ImageViewer.tsx — 图片放大查看器
 *
 * 用途：朋友圈配图可放大查看→放大见隐藏细节（信息架构 §2.3：李桥瑞3/1模糊证书
 * 放大后见"新希望"字样；3/9校园后墙放大见地上钥匙）。资源体系未落地时以高亮占位符
 * 模拟"放大"效果，assetId 透传。
 */
import { useCallback, useEffect } from "react";

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
          <div className="wc-image-viewer-placeholder">
            [放大查看] {assetId}
          </div>
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
