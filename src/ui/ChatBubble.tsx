/**
 * src/ui/ChatBubble.tsx
 *
 * 聊天气泡（微信/QQ 共用）。支持 text/image/voice/link/system/file/redpacket。
 * direction=sent 玩家视角发出（右侧），received 玩家视角收到（左侧）。
 * 不持硬编码剧情文字——文字来自 data/wechat/messages 或 data/qq/messages JSON。
 */
import type { CSSProperties, ReactNode } from 'react'
import type { ChatMessage } from '@/types'
import { cn } from '@/utils/cn'
import { palette, radius, spacing } from '@/ui/theme'
import { formatTimeOnly } from '@/utils/time'
import { Glyph } from '@/ui/icons'

export interface ChatBubbleProps {
  message: ChatMessage
  /** 头像节点（左/右按 direction 自动对齐）。 */
  avatar?: ReactNode
  /** 点击 link 消息的回调（pageId 走站内伪造页跳转）。 */
  onLinkClick?: (link: ChatMessage['link']) => void
  /** 点击图片消息放大查看的回调（默认用内置 ImageViewer）。 */
  onImageClick?: (assetId: string) => void
  /** 解析 assetId → 可显示 src（由各 App 的 loader 提供）。 */
  resolveAsset?: (assetId: string) => string | undefined
  /** 主题色（sent 气泡背景）。 */
  themeColor?: string
}

export function ChatBubble({
  message,
  avatar,
  onLinkClick,
  onImageClick,
  resolveAsset,
  themeColor,
}: ChatBubbleProps) {
  if (message.kind === 'system') {
    return (
      <div style={{ textAlign: 'center', margin: `${spacing.md}px 0` }}>
        <span style={{ display: 'inline-block', fontSize: 12, color: palette.textTertiary, background: 'rgba(0,0,0,0.3)', padding: '2px 10px', borderRadius: radius.pill, maxWidth: '80%' }}>
          {message.text}
        </span>
      </div>
    )
  }

  const sent = message.direction === 'sent'
  const bubbleBg = sent ? (themeColor ?? palette.wechatGreen) : palette.bgCard
  const bubbleColor = sent ? '#fff' : palette.textPrimary
  const align = sent ? 'flex-end' : 'flex-start'
  const bubbleRadius: CSSProperties['borderRadius'] = sent
    ? `${radius.md}px ${radius.md}px 2px ${radius.md}px`
    : `${radius.md}px ${radius.md}px ${radius.md}px 2px`

  const isRecalled = message.recalled

  const inner = renderMessageBody(message, {
    sent,
    bubbleBg,
    bubbleColor,
    onLinkClick,
    onImageClick,
    resolveAsset,
  })

  return (
    <div
      className={cn('chat-row', sent ? 'chat-row--sent' : 'chat-row--recv')}
      style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.sm, margin: `${spacing.sm}px ${spacing.md}px`, flexDirection: sent ? 'row-reverse' : 'row' }}
    >
      <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: radius.md, overflow: 'hidden', background: palette.bgElevated, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {avatar}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: align, maxWidth: '74%', minWidth: 0 }}>
        {inner}
        {message.timestamp ? (
          <span style={{ fontSize: 11, color: palette.textTertiary, marginTop: 2, padding: '0 4px' }}>{formatTimeOnly(message.timestamp)}</span>
        ) : null}
      </div>
    </div>
  )

  function renderMessageBody(
    m: ChatMessage,
    ctx: {
      sent: boolean
      bubbleBg: string
      bubbleColor: string
      onLinkClick?: (link: ChatMessage['link']) => void
      onImageClick?: (assetId: string) => void
      resolveAsset?: (assetId: string) => string | undefined
    },
  ): ReactNode {
    if (isRecalled) {
      return (
        <span style={{ display: 'inline-block', fontSize: 12, color: palette.textTertiary, background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: radius.sm }}>
          该消息已被撤回
        </span>
      )
    }
    const baseStyle: CSSProperties = {
      background: ctx.bubbleBg,
      color: ctx.bubbleColor,
      padding: `${spacing.sm}px ${spacing.md}px`,
      borderRadius: bubbleRadius,
      fontSize: 14,
      lineHeight: 1.5,
      wordBreak: 'break-word',
      maxWidth: '100%',
      minWidth: 0,
    }
    switch (m.kind) {
      case 'text':
        return <div style={baseStyle}>{m.text}</div>
      case 'image':
        return (
          <ZoomableThumb
            src={ctx.resolveAsset?.(m.assetIds?.[0] ?? '')}
            caption={undefined}
            onOpen={() => m.assetIds?.[0] && ctx.onImageClick?.(m.assetIds[0])}
            radius={radius.md}
            maxW={200}
          />
        )
      case 'voice':
        return (
          <div style={{ ...baseStyle, display: 'flex', alignItems: 'center', gap: spacing.xs, minWidth: 80 }}>
            <Glyph name="search" size={14} color={ctx.bubbleColor} />
            <span>语音 {m.voiceDurationSec ?? '?'}"</span>
          </div>
        )
      case 'file':
        return (
          <div style={{ ...baseStyle, display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 180 }}>
            <Glyph name="files" size={22} color={ctx.bubbleColor} />
            <div style={{ minWidth: 0 }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.text ?? m.assetIds?.[0] ?? '文件'}</div>
              {m.text ? <div style={{ fontSize: 11, opacity: 0.7 }}>{m.assetIds?.[0]}</div> : null}
            </div>
          </div>
        )
      case 'redpacket':
        return (
          <div style={{ ...baseStyle, background: '#f5365c', display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 160 }}>
            <Glyph name="album" size={20} color="#ffd54a" />
            <div>
              <div style={{ fontWeight: 600 }}>红包</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>{m.text ?? '微信红包'}</div>
            </div>
          </div>
        )
      case 'link': {
        const link = m.link
        if (!link) return <div style={baseStyle}>{m.text}</div>
        return (
          <button
            type="button"
            onClick={() => ctx.onLinkClick?.(link)}
            style={{
              ...baseStyle,
              display: 'flex',
              alignItems: 'stretch',
              gap: spacing.sm,
              padding: spacing.sm,
              textAlign: 'left',
              cursor: 'pointer',
              minWidth: 200,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {link.title ?? m.text ?? '链接'}
              </div>
              {link.url ? <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.url}</div> : null}
            </div>
            <div style={{ width: 44, height: 44, borderRadius: radius.sm, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Glyph name="browser" size={20} color={ctx.bubbleColor} />
            </div>
          </button>
        )
      }
      case 'text' as never:
      default:
        return <div style={baseStyle}>{m.text}</div>
    }
  }
}

/** 图片缩略 + 点击放大（用 ImageViewer）。 */
function ZoomableThumb({
  src,
  caption,
  onOpen,
  radius,
  maxW,
}: {
  src?: string
  caption?: string
  onOpen: () => void
  radius: number
  maxW: number
}) {
  if (!src) {
    return (
      <div style={{ width: maxW, height: maxW * 0.7, background: palette.bgElevated, borderRadius: radius, display: 'flex', alignItems: 'center', justifyContent: 'center', color: palette.textTertiary, fontSize: 12 }}>
        [图片]
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'zoom-in', display: 'block', maxWidth: maxW }}
    >
      <img src={src} alt={caption ?? ''} style={{ maxWidth: '100%', maxHeight: 220, borderRadius: radius, display: 'block' }} />
    </button>
  )
}

/** 内联使用的 ZoomableImage 类型 Re-export（避免各 App 重复定义）。 */
export type { ZoomableImageProps } from '@/ui/ImageViewer'
