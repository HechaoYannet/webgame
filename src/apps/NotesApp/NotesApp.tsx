/**
 * src/apps/NotesApp/NotesApp.tsx — 备忘录
 *
 * 读 public/data/phone/notes.json（loader.getAllNotes，main.tsx 已 await loadGameData，
 * 同步 getter 安全）。列表 + 详情两态。纯展示，不写任何游戏状态。
 */
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Note } from '@/types'
import { getAllNotes } from '@/data/loader'
import { formatGameDate, formatGameTime } from '@/utils/time'

export default function NotesApp(): ReactNode {
  const notes = useMemo<Note[]>(() => {
    const all = [...getAllNotes()]
    all.sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
      return b.createdAt.localeCompare(a.createdAt)
    })
    return all
  }, [])
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = notes.find((n) => n.id === activeId) ?? null

  if (active) {
    return (
      <div style={wrapStyle}>
        <div style={headerStyle}>
          <button style={backBtn} onClick={() => setActiveId(null)} aria-label="返回">‹ 备忘录</button>
          <div style={{ fontSize: 15, fontWeight: 600, flex: 1, textAlign: 'center' }}>{active.title}</div>
          <div style={{ width: 72 }} />
        </div>
        <div style={bodyStyle}>
          <div style={metaStyle}>{formatGameDate(active.createdAt)} {formatGameTime(active.createdAt)}</div>
          <div style={textStyle}>{active.body}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={wrapStyle}>
      <div style={headerStyle}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>备忘录</div>
        <div style={{ fontSize: 12, color: '#9aa6b5' }}>{notes.length} 条</div>
      </div>
      {notes.length === 0 ? (
        <div style={{ padding: 32, color: '#778', fontSize: 13, textAlign: 'center' }}>暂无备忘</div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {notes.map((n) => (
            <button key={n.id} style={rowStyle} onClick={() => setActiveId(n.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {n.pinned ? '📌 ' : ''}{n.title}
                </span>
                <span style={{ fontSize: 11, color: '#667', flexShrink: 0 }}>
                  {formatGameDate(n.createdAt)}
                </span>
              </div>
              <div style={snippetStyle}>{n.body.replace(/\s+/g, ' ').slice(0, 34)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const wrapStyle: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: '#0e1620',
  color: '#e7eef7',
  fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
  paddingBottom: 'var(--home-inset)',
}
const headerStyle: React.CSSProperties = {
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 12px',
  background: '#141f2c',
  borderBottom: '1px solid #1d2a3a',
  flexShrink: 0,
}
const backBtn: React.CSSProperties = {
  width: 72,
  background: 'none',
  border: 'none',
  color: '#8ab4f8',
  fontSize: 13,
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
  padding: 0,
}
const rowStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '12px 14px',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid #1a2636',
  color: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
}
const snippetStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#889',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}
const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '14px 16px 28px',
}
const metaStyle: React.CSSProperties = { fontSize: 11, color: '#667', marginBottom: 10 }
const textStyle: React.CSSProperties = {
  fontSize: 13.5,
  lineHeight: 1.9,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}
