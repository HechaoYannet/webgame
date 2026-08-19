/**
 * src/apps/QqApp/Qzone.tsx — QQ 空间说说（frontend-qq 独占。信息架构 §3.2）。
 *
 * 读 loader.getQzone()（MomentsPost[]，来自 data/qq/qzone.json）。配图可点击放大
 * （后墙钥匙照、校内监控死角图、山河医科大校门照——放大见隐藏细节，交互设计 §三）。
 *
 * 查看说说调 useClue().view({kind:'qzone',postId}) —— engine ClueRegistry 查表
 * （clue-map 暂无 qzone-post 线索，统一传递交引擎裁决，未来扩展无损）。
 * link.pageId 存在提示"可在浏览器打开"（站内由 BrowserApp 处理，§6.4 不外跳）。
 *
 * 数据就绪：QqApp 顶层已 await loadGameData()，本组件挂在登录后主面板，同步读
 * getQzone() 不会抛错。为稳妥仍 catch 回退到 Loading（极端时序）。
 */
import { useState } from 'react'
import { getQzone, getContact, loadGameData } from '@/data/loader'
import {
  Avatar,
  EmptyState,
  ImagePlaceholder,
  ImageViewer,
  Loading,
  formatTime,
  useAsync,
} from './components'

export function Qzone() {
  const [zoom, setZoom] = useState<{ assetId: string; alt: string } | null>(null)
  // 复用顶层 loadGameData（幂等缓存）；ready 后 getQzone() 同步可读
  const { error } = useAsync(loadGameData, [])
  if (error) return <div className="qq-state qq-error">空间加载失败：{error}</div>

  const posts = safeGetQzone()
  if (posts === null) return <Loading text="加载 QQ 空间…" />
  if (posts.length === 0) return <EmptyState text="暂无说说" />

  const sorted = [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="qq-qzone">
      <h2 className="qq-panel-title">QQ 空间</h2>
      <ul className="qq-qzone-list">
        {sorted.map((p) => {
          const author = getContact(p.authorCharacterId)
          const authorName = author?.displayName ?? author?.name ?? '未知'
          return (
            <li
              key={p.id}
              className="qq-qzone-item"
              onClick={() => {
                /* 重写后线索注册装饰已废：查看说说不再注册线索。 */
              }}
            >
              <div className="qq-qzone-head">
                <Avatar charId={p.authorCharacterId} name={authorName} size={36} />
                <div className="qq-qzone-meta">
                  <div className="qq-qzone-author">{authorName}</div>
                  <div className="qq-qzone-time">{formatTime(p.createdAt)}</div>
                </div>
              </div>
              {p.text && <p className="qq-qzone-text">{p.text}</p>}
              {p.assetIds && p.assetIds.length > 0 && (
                <div className="qq-qzone-images">
                  {p.assetIds.map((aid) => (
                    <ImagePlaceholder
                      key={aid}
                      assetId={aid}
                      alt={aid}
                      onZoom={() => setZoom({ assetId: aid, alt: aid })}
                    />
                  ))}
                </div>
              )}
              {p.link && (
                <div className="qq-qzone-link">
                  <div className="qq-qzone-link-title">{p.link.title}</div>
                  {p.link.pageId && (
                    <div className="qq-qzone-link-hint">（可在浏览器中打开）</div>
                  )}
                  {!p.link.pageId && p.link.url && (
                    <div className="qq-qzone-link-url">{p.link.url}</div>
                  )}
                </div>
              )}
              {(p.likes && p.likes.length > 0) || (p.comments && p.comments.length > 0) ? (
                <div className="qq-qzone-footer">
                  {p.likes && p.likes.length > 0 && (
                    <div className="qq-qzone-likes">
                      ❤ {p.likes.map((id) => getContact(id)?.displayName ?? id).join('、')}
                    </div>
                  )}
                  {p.comments && p.comments.length > 0 && (
                    <ul className="qq-qzone-comments">
                      {p.comments.map((c, i) => (
                        <li key={i} className={`qq-qzone-comment${c.deleted ? ' deleted' : ''}`}>
                          <span className="qq-qzone-comment-author">
                            {getContact(c.authorCharacterId)?.displayName ?? c.authorCharacterId}
                          </span>
                          ：{c.text}
                          {c.deleted && <em className="qq-qzone-comment-deleted">（缓存还在）</em>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      {zoom && (
        <ImageViewer assetId={zoom.assetId} alt={zoom.alt} onClose={() => setZoom(null)} />
      )}
    </div>
  )
}

/** 安全读取 getQzone：未就绪返回 null（不抛）。 */
function safeGetQzone() {
  try {
    return getQzone()
  } catch {
    return null
  }
}
