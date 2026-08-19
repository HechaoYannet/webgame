/**
 * src/apps/QqApp/ChatView.tsx — QQ 会话列表 + 会话页（frontend-qq 独占）。
 *
 * 视点：李桥瑞 QQ。direction：sent=李桥瑞发的（右侧绿）、received=他人发的（左侧白）、
 * system=系统消息（居中灰条）。闫欣泽↔李桥瑞长对话(3/5–3/13)是核心线索区。
 *
 * 会话门禁：挂 requiredPuzzleId 的会话，在对应谜题未解前置灰、不可进入。用 engine 的
 * 同步 isSolved(puzzleId)（可在循环中调用）判定。
 * 查看关键消息调 useClue().view({kind:'message',threadId,messageId})（异步，engine
 * ClueRegistry 查 clue-map：clue-qq-plan(thread-li-yan-qq,autoRegisterOnView:1)）。
 * 消息按需加载用 loader.getMessages(threadId)（带缓存）。
 */
import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, ChatThread, ContactId } from '@/types'
import { getMessages, getContact, getQqContact } from '@/data/loader'
import { isSolved } from '@/engine/puzzle/PuzzleService'
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

  function otherId(t: ChatThread): ContactId {
    const player = 'char-liqiaorui'
    return t.participantCharacterIds.find((id) => id !== player) ?? t.participantCharacterIds[0]
  }
  function titleFor(t: ChatThread): string {
    if (t.type === 'group') return t.title
    const oid = otherId(t)
    const c = getContact(oid)
    const q = getQqContact(oid)
    return q?.qqRemark || q?.qqNickname || c?.displayName || c?.name || t.title
  }

  return (
    <div className="qq-chat-list">
      <h2 className="qq-panel-title">消息</h2>
      {sorted.length === 0 && <EmptyState text="暂无会话" />}
      <ul className="qq-thread-list">
        {sorted.map((t) => {
          const locked = t.requiredPuzzleId ? !isSolved(t.requiredPuzzleId) : false
          const oid = otherId(t)
          return (
            <li key={t.id}>
              <button
                type="button"
                className={`qq-thread-row${locked ? ' locked' : ''}`}
                disabled={locked}
                onClick={() => onOpen(t.id)}
              >
                <Avatar charId={oid} name={titleFor(t)} isGroup={t.type === 'group'} />
                <div className="qq-thread-info">
                  <div className="qq-thread-top">
                    <span className="qq-thread-title">{titleFor(t)}</span>
                    <span className="qq-thread-time">{formatTime(t.lastMessageAt)}</span>
                  </div>
                  <div className="qq-thread-bottom">
                    {locked ? (
                      <span className="qq-thread-locked">
                        🔒 需先{t.requiredPuzzleId === 'puzzle-qq-login' ? '完成登录' : '解谜'}
                      </span>
                    ) : (
                      <span className="qq-thread-unread">
                        {t.unreadCount ? `${t.unreadCount} 条未读` : '点击查看'}
                      </span>
                    )}
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

export function ChatView({ thread, onBack }: { thread: ChatThread; onBack: () => void }) {
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
          thread.type === 'group'
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
            onZoomImage={(assetId) => setZoomAsset({ assetId, alt: assetId })}
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
          <button type="button" className="qq-voice-btn" disabled>
            ▶ 语音 {m.voiceDurationSec ?? 0}"
          </button>
          {m.voiceTranscript && (
            <details className="qq-voice-transcript">
              <summary>转文字</summary>
              <span>{m.voiceTranscript}</span>
            </details>
          )}
        </div>
      )
    case 'file':
      return <div className="qq-msg-file">📎 {m.text ?? m.assetIds?.[0] ?? '文件'}</div>
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

