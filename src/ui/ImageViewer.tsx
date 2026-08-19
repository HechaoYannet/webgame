/**
 * src/ui/ImageViewer.tsx
 *
 * 图片查看器：可放大查看（交互设计 §三：朋友圈/网页配图放大看"新希望"
 * 字样、钥匙形状等隐藏细节）。支持点击缩略图全屏放大、双击/捏合缩放、拖拽平移。
 *
 * 设计要点：
 *  - 隐藏细节（"新希望"铭牌、钥匙轮廓等）通过同一张图放大后自然显现，
 *    不需要前端做"放大后叠加图层"——美术资源原图即包含细节，放大即可见。
 *    这样前端零硬编码剧情，只做通用查看器。
 *  - 提供 <ImageViewer.Trigger> 便利组件 + useImageViewer() hook 两种用法。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { palette } from '@/ui/theme'
import { Glyph } from '@/ui/icons'

export interface ZoomableImageProps {
  src: string
  caption?: string
  /** 放大后可显示的隐藏细节提示（占位字段，前端不持剧情——文案应写在 caption 里）。 */
  alt?: string
  className?: string
  style?: CSSProperties
  /** 缩略宽度（默认充满父容器）。 */
  thumbWidth?: number | string
  thumbHeight?: number | string
}

interface ViewerItem {
  src: string
  caption?: string
  alt?: string
}

interface ViewerContextValue {
  open: (item: ViewerItem) => void
  openAll: (items: ViewerItem[], startIndex?: number) => void
  close: () => void
  isOpen: boolean
}

const ViewerContext = createContext<ViewerContextValue | null>(null)

export function ImageViewerProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ViewerItem[]>([])
  const [index, setIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback((item: ViewerItem) => {
    setItems([item])
    setIndex(0)
    setIsOpen(true)
  }, [])
  const openAll = useCallback((list: ViewerItem[], startIndex = 0) => {
    if (list.length === 0) return
    setItems(list)
    setIndex(Math.max(0, Math.min(startIndex, list.length - 1)))
    setIsOpen(true)
  }, [])
  const close = useCallback(() => setIsOpen(false), [])

  const value = useMemo<ViewerContextValue>(
    () => ({ open, openAll, close, isOpen }),
    [open, openAll, close, isOpen],
  )

  return (
    <ViewerContext.Provider value={value}>
      {children}
      <ViewerOverlay items={items} index={index} setIndex={setIndex} isOpen={isOpen} onClose={close} />
    </ViewerContext.Provider>
  )
}

export function useImageViewer(): ViewerContextValue {
  const ctx = useContext(ViewerContext)
  if (!ctx) {
    // 容错：无 Provider 时提供 no-op（避免 App 未包 Provider 时整页崩溃）
    return {
      open: () => {},
      openAll: () => {},
      close: () => {},
      isOpen: false,
    }
  }
  return ctx
}

/** 缩略图 + 点击放大触发器。各 App 用法：
 *  <ImageViewer src={imgSrc} caption="..." /> 即可得到点击放大效果。
 */
export function ImageViewer({ src, caption, alt, className, style, thumbWidth, thumbHeight }: ZoomableImageProps) {
  const { open } = useImageViewer()
  return (
    <button
      type="button"
      onClick={() => open({ src, caption, alt })}
      className={className}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'zoom-in',
        display: 'block',
        width: thumbWidth,
        height: thumbHeight,
        ...style,
      }}
      aria-label={alt ?? '放大查看'}
    >
      <img src={src} alt={alt ?? caption ?? ''} style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', borderRadius: 4 }} />
    </button>
  )
}

/**
 * 便利组件：包裹任意内容，点击时打开查看器。
 * 适用：图片本身不在 <img> 里（如 CSS 背景图/卡片），需要点击区域放大查看。
 */
ImageViewer.Trigger = function ImageViewerTrigger({
  src,
  caption,
  alt,
  ariaLabel,
  children,
}: {
  src: string
  caption?: string
  alt?: string
  ariaLabel?: string
  children?: ReactNode
}) {
  const { open } = useImageViewer()
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={ariaLabel ?? '放大查看'}
      onClick={() => open({ src, caption, alt })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open({ src, caption, alt })
        }
      }}
      style={{ display: 'contents', cursor: 'zoom-in' }}
    >
      {children}
    </span>
  )
}

/** 内嵌放大镜图标提示叠层（缩略图右下角，提示可放大）。 */
ImageViewer.Hint = function ImageViewerHint() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        right: 6,
        bottom: 6,
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <Glyph name="zoom" size={14} color="#fff" />
    </span>
  )
}

function ViewerOverlay({
  items,
  index,
  setIndex,
  isOpen,
  onClose,
}: {
  items: ViewerItem[]
  index: number
  setIndex: (i: number) => void
  isOpen: boolean
  onClose: () => void
}) {
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const dragging = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const lastTap = useRef<number>(0)

  // 重置 transform on image change / open
  useEffect(() => {
    setScale(1)
    setTx(0)
    setTy(0)
  }, [index, isOpen])

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && items.length > 1) setIndex((index + 1) % items.length)
      if (e.key === 'ArrowLeft' && items.length > 1) setIndex((index - 1 + items.length) % items.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose, items.length, index, setIndex])

  if (!isOpen || items.length === 0) return null
  const current = items[index]
  if (!current) return null

  const handleDoubleClick = () => {
    setScale((s) => (s >= 2 ? 1 : s + 1))
  }
  const handleClick = () => {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      handleDoubleClick()
    } else {
      lastTap.current = now
      // 单击延迟关闭由关闭按钮承担，避免误触
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragging.current = { x: e.clientX, y: e.clientY, tx, ty }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - dragging.current.x
    const dy = e.clientY - dragging.current.y
    setTx(dragging.current.tx + dx)
    setTy(dragging.current.ty + dy)
  }
  const onPointerUp = () => {
    dragging.current = null
  }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = -e.deltaY * 0.0015
    setScale((s) => Math.max(1, Math.min(5, s + delta * s)))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="图片查看器"
      onClick={handleClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.94)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          display: 'flex',
          gap: 8,
          zIndex: 1,
        }}
      >
        <ViewerBtn label="缩小" disabled={scale <= 1} onClick={() => setScale((s) => Math.max(1, s - 0.5))}>
          <Glyph name="close" size={20} color="#fff" style={{ transform: 'rotate(45deg)' }} />
        </ViewerBtn>
        <ViewerBtn label="放大" onClick={() => setScale((s) => Math.min(5, s + 0.5))}>
          <Glyph name="zoom" size={20} color="#fff" />
        </ViewerBtn>
        <ViewerBtn label="关闭" onClick={onClose}>
          <Glyph name="close" size={22} color="#fff" />
        </ViewerBtn>
      </div>

      <div
        className="image-viewer-stage"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={handleDoubleClick}
        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: scale > 1 ? (dragging.current ? 'grabbing' : 'grab') : 'zoom-in' }}
      >
        <img
          src={current.src}
          alt={current.alt ?? current.caption ?? ''}
          draggable={false}
          style={{
            maxWidth: '92vw',
            maxHeight: '82vh',
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transition: dragging.current ? 'none' : 'transform .15s ease-out',
            transformOrigin: 'center center',
            borderRadius: 4,
            boxShadow: '0 8px 60px rgba(0,0,0,0.6)',
          }}
        />
      </div>

      {current.caption ? (
        <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center', color: palette.textSecondary, fontSize: 14, padding: '0 24px', maxWidth: 600, margin: '0 auto' }}>
          {current.caption}
        </div>
      ) : null}

      {items.length > 1 ? (
        <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`第 ${i + 1} 张`}
              onClick={(e) => {
                e.stopPropagation()
                setIndex(i)
              }}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                border: 'none',
                padding: 0,
                background: i === index ? '#fff' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      ) : null}
      {scale > 1 ? (
        <div style={{ position: 'absolute', top: 12, left: 12, color: palette.textTertiary, fontSize: 12, background: 'rgba(0,0,0,0.4)', padding: '2px 8px', borderRadius: 999 }}>
          {scale.toFixed(1)}x · 拖动平移 · 双击还原
        </div>
      ) : null}
    </div>
  )
}

function ViewerBtn({ children, label, onClick, disabled }: { children: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled) onClick()
      }}
      disabled={disabled}
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        border: 'none',
        background: 'rgba(255,255,255,0.12)',
        color: '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}

/** 占位重导出，供 ChatBubble 类型对齐。 */
export type { ZoomableImageProps as _ZIProps } from '@/ui/ImageViewer'
