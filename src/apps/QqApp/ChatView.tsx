/**
 * src/apps/QqApp/ChatView.tsx — QQ 会话列表 + 会话页（frontend-qq 独占）。
 *
 * 视点：李桥瑞 QQ。direction：sent=李桥瑞发的（右侧绿）、received=他人发的（左侧白）、
 * system=系统消息（居中灰条）。闫欣泽↔李桥瑞长对话(3/5–3/13)是核心线索区。
 *
 * 重写后无会话门禁：登 QQ 后所有会话可见可点（登录本身是 puzzle-qq-login）。
 * 打开「你同桌」会话即归档关键证据 ev-qq-chat-plan（查看即收集，幂等）。
 * 消息按需加载用 loader.getMessages(threadId)（带缓存）。
 */
import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, ChatThread, ContactId } from '@/types'
import { getMessages, getContact, getQqContact } from '@/data/loader'
import { collectEvidence } from '@/game/evidence'
import {
  Avatar,
  EmptyState,
  ErrorState,
  ImagePlaceholder,
  ImageViewer,
  Loading,
  SubHeader,
  formatTime,
  useAsync,
} from './components'

export function ChatList({
  threads,
  onOpen,
}: {
  threads: ChatThread[]
  onOpen: (threadId: string) => void
}) {
  const sorted = [...threads].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))

  // 批量加载每个会话的最后一条消息，作为列表预览（未读数由角标另行体现）。
  const [snippets, setSnippets] = useState<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    void Promise.all(
      threads.map(async (t) => {
        try {
          const msgs = await getMessages(t.id)
          const last = msgs.reduce<ChatMessage | null>(
            (acc, m) => (!acc || m.timestamp > acc.timestamp ? m : acc),
            null,
          )
          return [t.id, messagePreview(last)] as const
        } catch {
          return [t.id, ''] as const
        }
      }),
    ).then((entries) => {
      if (!cancelled) setSnippets(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [threads])

  function otherId(t: ChatThread): ContactId {
    const player = 'char-liqiaorui'
    return t.participantCharacterIds.find((id) => id !== player) ?? t.participantCharacterIds[0]
  }
  function titleFor(t: ChatThread): string {
    if (t.type === 'group') return t.title
    // 单聊优先用 thread.title（文案人工写好：普通会话是对方备注名，转存记录是
    // "闫欣泽 ↔ 林哲（闫转存的聊天记录）" 这类描述性标题）。contacts.json 里曾把群
    // characterId 误设成真人导致撞车，现已修；但单聊若 fallback 到 getQqContact，
    // 转存记录会复用真人 qqRemark（如"你同桌"）与真会话重名，故 title 优先。
    if (t.title) return t.title
    const oid = otherId(t)
    const c = getContact(oid)
    const q = getQqContact(oid)
    return q?.qqRemark || q?.qqNickname || c?.displayName || c?.name || ''
  }

  return (
    <div className="qq-chat-list">
      <h2 className="qq-panel-title">消息</h2>
      {sorted.length === 0 && <EmptyState text="暂无会话" />}
      <ul className="qq-thread-list">
        {sorted.map((t) => {
          const oid = otherId(t)
          return (
            <li key={t.id}>
              <button
                type="button"
                className="qq-thread-row"
                onClick={() => onOpen(t.id)}
              >
                <Avatar charId={oid} name={titleFor(t)} isGroup={t.type === 'group'} />
                <div className="qq-thread-info">
                  <div className="qq-thread-top">
                    <span className="qq-thread-title">{titleFor(t)}</span>
                    <span className="qq-thread-time">{formatTime(t.lastMessageAt)}</span>
                  </div>
                  <div className="qq-thread-bottom">
                    <span className="qq-thread-snippet">{snippets[t.id] ?? ''}</span>
                    {t.unreadCount ? (
                      <span className="qq-thread-badge" aria-label={`${t.unreadCount} 条未读`}>
                        {t.unreadCount > 99 ? '99+' : t.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** 会话列表预览：image→[图片]，link→[链接]，其它取 text 前 18 字。 */
function messagePreview(m: ChatMessage | null): string {
  if (!m) return ''
  if (m.kind === 'image') return '[图片]'
  if (m.kind === 'link') return '[链接]'
  const text = (m.text ?? '').trim()
  if (!text) return ''
  return text.length > 18 ? text.slice(0, 18) + '…' : text
}

export function ChatView({ thread, onBack }: { thread: ChatThread; onBack: () => void }) {
  // 打开李桥瑞↔闫欣泽计划聊天 → 归档关键证据 ev-qq-chat-plan（幂等）。
  useEffect(() => {
    if (thread.id === 'thread-li-yan-qq') collectEvidence('ev-qq-chat-plan')
  }, [thread.id])

  const { data: messages, error } = useAsync(() => getMessages(thread.id), [thread.id])
  const [zoomAsset, setZoomAsset] = useState<{ assetId: string; alt: string } | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages && scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
    }
  }, [messages])

  function authorName(authorId?: ContactId): string {
    if (!authorId) return ''
    const c = getContact(authorId)
    const q = getQqContact(authorId)
    return q?.qqRemark || q?.qqNickname || c?.displayName || c?.name || ''
  }

  function handleViewMessage(_m: ChatMessage) {
    // 重写后线索注册装饰已废：查看消息不再注册线索/收集证据。保留函数签名供 onView 回调。
  }

  return (
    <div className="qq-chat-view">
      <SubHeader
        title={
          thread.type === 'group' || thread.title
            ? thread.title
            : authorName(thread.participantCharacterIds.find((id) => id !== 'char-liqiaorui'))
        }
        onBack={onBack}
      />
      {error && <ErrorState text={`加载消息失败：${error}`} />}
      {!error && !messages && <Loading text="加载消息…" />}
      <div className="qq-chat-scroller" ref={scrollerRef}>
        {messages?.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            threadType={thread.type}
            authorName={authorName(m.authorCharacterId)}
            onView={() => handleViewMessage(m)}
            onZoomImage={(assetId) => setZoomAsset({ assetId, alt: '' })}
          />
        ))}
      </div>

      {zoomAsset && (
        <ImageViewer
          assetId={zoomAsset.assetId}
          alt={zoomAsset.alt}
          onClose={() => setZoomAsset(null)}
        />
      )}
    </div>
  )
}

function MessageBubble({
  message: m,
  threadType,
  authorName,
  onView,
  onZoomImage,
}: {
  message: ChatMessage
  threadType: 'single' | 'group'
  authorName: string
  onView: () => void
  onZoomImage: (assetId: string) => void
}) {
  if (m.kind === 'system') {
    return (
      <div className="qq-msg-system" onClick={onView}>
        <span>{m.text}</span>
        <span className="qq-msg-time">{formatTime(m.timestamp)}</span>
      </div>
    )
  }

  const sent = m.direction === 'sent'
  const authorId = m.authorCharacterId ?? ''
  return (
    <div
      className={`qq-msg ${sent ? 'sent' : 'received'}${m.recalled ? ' recalled' : ''}`}
      onClick={onView}
    >
      {!sent && <Avatar charId={authorId} name={authorName || '对方'} size={32} />}
      <div className="qq-msg-bubble-wrap">
        {threadType === 'group' && !sent && (
          <div className="qq-msg-author">{authorName}</div>
        )}
        <div className={`qq-msg-bubble ${sent ? 'sent' : 'received'}`}>
          {m.recalled && <span className="qq-msg-recalled-label">（已撤回）</span>}
          <MessageBody m={m} onZoomImage={onZoomImage} />
        </div>
        <div className="qq-msg-time">{formatTime(m.timestamp)}</div>
      </div>
    </div>
  )
}

function MessageBody({
  m,
  onZoomImage,
}: {
  m: ChatMessage
  onZoomImage: (assetId: string) => void
}) {
  switch (m.kind) {
    case 'text':
      return <span className="qq-msg-text">{m.text}</span>
    case 'image':
      return (
        <div className="qq-msg-images">
          {(m.assetIds ?? []).map((aid) => (
            <ImagePlaceholder
              key={aid}
              assetId={aid}
              alt={aid}
              size="small"
              onZoom={() => onZoomImage(aid)}
            />
          ))}
        </div>
      )
    case 'voice':
      return (
        <div className="qq-msg-voice">
          {/* 无真实播放能力：以静态标签呈现时长，不再渲染 disabled 死按钮 */}
          <span className="qq-voice-static">▶ 语音 {m.voiceDurationSec ?? 0}"</span>
          {m.voiceTranscript && (
            <details className="qq-voice-transcript">
              <summary>转文字</summary>
              <span>{m.voiceTranscript}</span>
            </details>
          )}
        </div>
      )
    case 'file':
      return <div className="qq-msg-file">📎 {m.text ?? '文件'}</div>
    case 'redpacket':
      return <div className="qq-msg-redpacket">🧧 {m.text ?? '红包'}</div>
    case 'link':
      return (
        <div className="qq-msg-link">
          <div className="qq-msg-link-title">{m.link?.title ?? '链接'}</div>
          {m.link?.url && <div className="qq-msg-link-url">{m.link.url}</div>}
        </div>
      )
    default:
      return <span className="qq-msg-text">{m.text}</span>
  }
}

