/**
 * src/apps/NotesApp/NotesApp.tsx — 备忘录
 *
 * - 读 phone/notes.json 初始模板笔记
 * - engine ClueRegistry 在 registerClue 副作用里自动追加线索摘要到 getClueNotes()
 *   （onView 路径 + EffectExecutor registerClue 路径都会写），本组件 render 该列表 +
 *   toast"已记入备忘录"（由 engine ClueRegistry.onView 触发，非本组件发）
 * - 章节转场独白由 engine useChapter().monologue 提供（getMonologueByChapter 已封装）
 *
 * 迁移说明：原 ../PhoneApp/runtime 已删除。线索/章节状态走 @/engine/hooks，
 * 线索笔记摘要读 @/engine/clue/ClueRegistry.getClueNotes()。
 */

/**
 * src/apps/NotesApp/NotesApp.tsx — 备忘录
 *
 * 重写后（玩家决策 2026-08-19）：线索注册装饰机制（ClueRegistry）整体废除，
 * 不再有"查看线索 → 自动追加线索摘要到备忘录"的连锁。本组件现仅展示
 * phone/notes.json 的初始模板笔记 + 章节开场独白（useChapter().monologue）。
 */

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { loadNotes } from '../PhoneApp/data';
import type { Note } from '../PhoneApp/data';
import { useChapter } from '@/engine/hooks/useChapter';

type Tab = 'notes' | 'monologue';

// （重写后）线索笔记机制已废，useClueNotes 恒返回空数组，保留占位以维持调用面。
function useClueNotes(): readonly Note[] {
  return [];
}

export default function NotesApp(): ReactNode {
  const [tab, setTab] = useState<Tab>('notes');
  const [baseNotes, setBaseNotes] = useState<Note[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);

  // engine useChapter：monologue（getMonologueByChapter 已封装在 hook 内，按 currentChapterId 取）
  const { monologue } = useChapter();

  const clueNotes = useClueNotes();

  useEffect(() => {
    let mounted = true;
    loadNotes()
      .then((ns) => {
        if (!mounted) return;
        setBaseNotes(ns);
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        setLoadErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      mounted = false;
    };
  }, []);

  // （重写后）线索笔记机制已废，clueNotes 恒空，dynamicNotes 亦空；保留以维持 allNotes 组装逻辑。
  const dynamicNotes: Note[] = useMemo(() => [...clueNotes], [clueNotes]);

  // 全部笔记：初始模板置顶 + 动态线索笔记
  const allNotes = useMemo<Note[]>(() => {
    const pinned = baseNotes.filter((n) => n.pinned);
    const rest = baseNotes.filter((n) => !n.pinned);
    return [...pinned, ...dynamicNotes, ...rest];
  }, [baseNotes, dynamicNotes]);

  if (loadErr) {
    return <div style={{ padding: 24, color: '#f88' }}>备忘录数据加载失败：{loadErr}</div>;
  }

  const openNote = allNotes.find((n) => n.id === openNoteId);

  return (
    <div style={wrapStyle}>
      <div style={headerStyle}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>备忘录</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            style={tab === 'notes' ? tabActive : tabIdle}
            onClick={() => setTab('notes')}
          >
            笔记
          </button>
          <button
            style={tab === 'monologue' ? tabActive : tabIdle}
            onClick={() => setTab('monologue')}
          >
            独白
          </button>
        </div>
      </div>

      {tab === 'notes' && (
        <div style={listStyle}>
          {allNotes.length === 0 && (
            <div style={{ padding: 24, color: '#778', textAlign: 'center', fontSize: 13 }}>
              暂无笔记
            </div>
          )}
          {allNotes.map((n) => (
            <button key={n.id} style={noteRowStyle(n.pinned)} onClick={() => setOpenNoteId(n.id)}>
              <div style={noteTitleStyle(n.isTemplate)}>
                {n.pinned ? '📌 ' : ''}{n.title}
              </div>
              <div style={notePreviewStyle}>{n.body.split('\n')[0]}</div>
            </button>
          ))}
        </div>
      )}

      {tab === 'monologue' && (
        <div style={monologueStyle}>
          {monologue ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                {monologue.title}
              </div>
              {monologue.lines.map((l, i) => (
                <p key={i} style={{ fontSize: 13, lineHeight: 1.7, margin: '6px 0', color: '#cfd8e3' }}>
                  {l}
                </p>
              ))}
            </>
          ) : (
            <div style={{ color: '#778', fontSize: 13, textAlign: 'center' }}>
              暂无当前章节独白
            </div>
          )}
        </div>
      )}

      {openNote && (
        <div style={modalStyle}>
          <div style={modalCard}>
            <div style={modalHeader}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{openNote.title}</span>
              <button style={closeBtn} onClick={() => setOpenNoteId(null)} aria-label="关闭">×</button>
            </div>
            <div style={{ fontSize: 10, color: '#7a8', padding: '4px 14px' }}>
              {openNote.isTemplate ? '模板' : '笔记'} · {fmtTime(openNote.createdAt)}
            </div>
            <pre style={noteBodyStyle}>{openNote.body}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${mo}/${dd} ${hh}:${mm}`;
  } catch {
    return '';
  }
}

// ===== styles =====
const wrapStyle: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: '#0e1620',
  color: '#e7eef7',
  fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
};
const headerStyle: React.CSSProperties = {
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 10px',
  background: '#141f2c',
  borderBottom: '1px solid #1d2a3a',
};
const tabActive: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 12,
  background: '#8c6a2c',
  color: '#fff',
  border: 'none',
  fontSize: 12,
  cursor: 'pointer',
};
const tabIdle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 12,
  background: 'transparent',
  color: '#9aa6b5',
  border: '1px solid #24374d',
  fontSize: 12,
  cursor: 'pointer',
};
const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 6,
};
function noteRowStyle(pinned: boolean): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    width: '100%',
    padding: '10px 12px',
    background: pinned ? '#1f1a12' : '#141f2c',
    border: `1px solid ${pinned ? '#4d3a1f' : '#1d2a3a'}`,
    borderRadius: 6,
    margin: '4px 0',
    textAlign: 'left',
    cursor: 'pointer',
    color: 'inherit',
  };
}
function noteTitleStyle(isTemplate: boolean): React.CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 600,
    color: isTemplate ? '#d6b48c' : '#e7eef7',
  };
}
const notePreviewStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#7a8',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const monologueStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 16,
  background: 'linear-gradient(180deg,#0e1620,#0a1018)',
};
const modalStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 20,
};
const modalCard: React.CSSProperties = {
  width: '100%',
  maxWidth: 340,
  background: '#182534',
  borderRadius: 10,
  border: '1px solid #2a3a4d',
  maxHeight: '80vh',
  overflowY: 'auto',
};
const modalHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  borderBottom: '1px solid #24374d',
};
const closeBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 13,
  background: 'transparent',
  color: '#9aa6b5',
  border: '1px solid #24374d',
  cursor: 'pointer',
  fontSize: 15,
};
const noteBodyStyle: React.CSSProperties = {
  padding: '12px 14px',
  margin: 0,
  fontSize: 13,
  lineHeight: 1.7,
  color: '#cfd8e3',
  whiteSpace: 'pre-wrap',
  fontFamily: 'inherit',
};
