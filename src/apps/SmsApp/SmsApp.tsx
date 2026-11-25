/**
 * src/apps/SmsApp/SmsApp.tsx — 短信 APP（重写）
 *
 * 架构：Thread List（会话列表）+ Conversation View（会话气泡）。
 * 按联系人分组为线程，点线程进入气泡会话。接收消息绿/暗气泡，发送消息绿色气泡。
 * 刘叔快捷回复集成在会话底部。威胁短信首次出现时全屏告警。
 *
 * 数据流：loader getAllSmsEvents() → 按 from/direction 分组为线程 →
 * deliveredSmsIds + game store 条件筛选可见性 → 渲染。
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { getAllSmsEvents, getAllCharacters, getSmsEventById } from '@/data/loader';
import { useGameStore } from '@/game/gameStore';
import {
  useDeliveredSmsIds,
  showFullscreenAlert,
  showToast,
} from '@/utils/shellState';
import type { EndingId, SmsEvent, SmsFrom } from '@/types';
import { formatGameDate, formatGameTime } from '@/utils/time';

// ===== 类型 =====

type ThreadKey = string;

interface LiuShuPreset {
  keyword: string;
  playerText: string;
  replyEventId: string;
}

interface ThreadSummary {
  key: ThreadKey;
  displayName: string;
  avatarLetter: string;
  avatarColor: string;
  lastMessageTime: number;
  lastMessagePreview: string;
}

interface MessageItem {
  kind: 'ev' | 'player';
  ev?: SmsEvent;
  timestamp: number;
  isSent: boolean;
  body: string;
  alertStyle?: 'info' | 'warning' | 'danger' | 'success';
  footnote?: string;
  /** 刘叔线程专用：对话步进序号（玩家发言=2i，刘叔回复=2i+1）。其余线程按 timestamp 排序时不用。 */
  seq?: number;
}

// ===== 常量 =====

const LIUSHU_KEY = 'char-liushu';

const LIUSHU_PRESETS: LiuShuPreset[] = [
  { keyword: '李桥瑞去向', playerText: '刘叔，李桥瑞去哪了？', replyEventId: 'sms-liushu-exchange-1' },
  { keyword: '哪个家长', playerText: '哪个家长？他爸妈都在外地。', replyEventId: 'sms-liushu-exchange-3' },
  { keyword: '兄弟', playerText: '刘叔，李桥瑞是我兄弟。', replyEventId: '' },
  { keyword: '新希望成长中心', playerText: '是不是送去了新希望成长中心？', replyEventId: 'sms-liushu-warning' },
];

const AVATAR_COLORS = [
  '#3aa55c', '#2c5e8c', '#b05a3a', '#8b5cf6', '#ec4899',
  '#f59e0b', '#06b6d4', '#14b8a6', '#a855f7', '#ef4444',
];

const CUSTOM_THREAD: Record<string, string> = {
  'thread-unknown-threat': '未知号码',
  'thread-10086': '10086',
  'char-dispatcher': '省公安厅',
};

// ===== 辅助函数 =====

/** 每条 SMS 所属线程 key。sent 按前缀归入对应会话。 */
function threadKey(ev: SmsEvent): ThreadKey {
  if (ev.direction === 'sent') {
    if (ev.id.startsWith('sms-liushu-')) return LIUSHU_KEY;
    return ev.id;
  }
  if (ev.id === 'sms-zhangqiang-threat' || ev.id === 'sms-zhangqiang-second-threat') return 'thread-unknown-threat';
  if (ev.id === 'sms-verification-redherring') return 'thread-10086';
  if (ev.id.startsWith('sms-liushu-')) return LIUSHU_KEY;
  return typeof ev.from === 'string' ? ev.from : `thread-${ev.from.digits}`;
}

function threadDisplayName(key: ThreadKey): string {
  if (CUSTOM_THREAD[key]) return CUSTOM_THREAD[key];
  const c = getAllCharacters().find((x) => x.id === key);
  return c?.displayName ?? c?.name ?? key;
}

function avatarColor(key: ThreadKey): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function avatarLetter(key: ThreadKey): string {
  return threadDisplayName(key).charAt(0);
}

// 统一走 @/utils/time（游戏时区 +08:00），不再各写一套本地时区格式化。
function fmtTime(iso: string): string { return formatGameTime(iso); }
function fmtDate(iso: string): string { return formatGameDate(iso); }

function trunc(s: string, n: number): string { return s.length > n ? s.slice(0, n) + '…' : s; }

function senderName(from: SmsFrom): string {
  if (typeof from === 'string') {
    const c = getAllCharacters().find((x) => x.id === from);
    return c?.displayName ?? c?.name ?? from;
  }
  return from.display;
}

/**
 * 一条 SmsEvent 是否可见（用于通用线程视图，按时间戳排序)：
 * - 已送达（deliveredSmsIds）→ 是
 * - direction=sent → 是（历史已发消息）
 * - mom/verification/dispatcher → 按 game store 条件
 *
 * 注意：`sms-liushu-*` 一律不进通用流——刘叔线程由 LIUSHU_PRESETS 步进驱动，
 * 玩家发言与刘叔回复按对话序号 seq 入栈（而非 ev.receivedAt / Date.now 混排），
 * 避免数据里 exchange-2/4 的 direction:sent 文本被误当历史已发消息无序平铺。
 * 刘叔回复通过 getSmsEventById(p.replyEventId) 显式取。
 */
function visible(
  ev: SmsEvent,
  delivered: Set<string>,
  solvedPuzzles: string[],
  chapter: string,
  ending?: EndingId,
): boolean {
  if (ev.id.startsWith('sms-liushu-')) return false;
  if (delivered.has(ev.id) || ev.direction === 'sent') return true;
  switch (ev.id) {
    case 'sms-mom-care': return chapter === 'ch-5' || chapter === 'ch-finale';
    case 'sms-verification-redherring': return solvedPuzzles.includes('puzzle-xinxwang-backend');
    case 'sms-good-ending-dispatcher': return ending === 'good';
    default: return false;
  }
}

// ===== 主组件 =====

export default function SmsApp(): ReactNode {
  const [allSms] = useState<SmsEvent[]>(() => getAllSmsEvents());
  const deliveredIds = useDeliveredSmsIds();
  const collectedEvidenceIds = useGameStore((s) => s.collectedEvidenceIds);
  const currentChapterId = useGameStore((s) => s.currentChapterId);
  const endingId = useGameStore((s) => s.endingId) as EndingId | undefined;
  const countdowns = useGameStore((s) => s.countdowns);
  const solvedPuzzleIds = useGameStore((s) => s.solvedPuzzleIds);

  const [activeThread, setActiveThread] = useState<ThreadKey | null>(null);
  const [triggeredSet, setTriggeredSet] = useState<Set<string>>(new Set());
  const alertedRef = useRef(new Set<string>());

  const delivered = useMemo(() => new Set(deliveredIds), [deliveredIds]);

  // 可见消息（不含刘叔——刘叔线程由 LIUSHU_PRESETS 步进驱动）
  const visibleEvents = useMemo<SmsEvent[]>(
    () => allSms.filter((ev) => visible(ev, delivered, solvedPuzzleIds, currentChapterId, endingId)),
    [allSms, delivered, solvedPuzzleIds, currentChapterId, endingId],
  );

  // 线程映射
  const threadMap = useMemo(() => {
    const m = new Map<ThreadKey, SmsEvent[]>();
    for (const ev of visibleEvents) {
      const k = threadKey(ev);
      const arr = m.get(k) ?? [];
      arr.push(ev);
      m.set(k, arr);
    }
    return m;
  }, [visibleEvents]);

  // 线程摘要（排序：最新消息在前）。刘叔线程由步进预设驱动、不再靠
  // 通用 visible 流，故 threadMap 里没有它——这里手动补一条常驻入口。
  const summaries = useMemo<ThreadSummary[]>(
    () => {
      const list: ThreadSummary[] = Array.from(threadMap.entries())
        .map(([k, evs]) => {
          const last = evs.reduce((a, b) =>
            new Date(a.receivedAt).getTime() > new Date(b.receivedAt).getTime() ? a : b);
          return {
            key: k, displayName: threadDisplayName(k),
            avatarLetter: avatarLetter(k), avatarColor: avatarColor(k),
            lastMessageTime: new Date(last.receivedAt).getTime(),
            lastMessagePreview: trunc(last.body, 30),
          };
        });
      if (!list.some((t) => t.key === LIUSHU_KEY)) {
        // 刘叔常驻：最近一条预览——已触发则取最后触发轮的玩家发言/刘叔回复，否则用占位
        const usedPresets = LIUSHU_PRESETS.filter((p) => triggeredSet.has(p.keyword));
        const preview = usedPresets.length > 0
          ? trunc(usedPresets[usedPresets.length - 1].playerText, 30)
          : '点击向刘叔发问';
        list.push({
          key: LIUSHU_KEY, displayName: threadDisplayName(LIUSHU_KEY),
          avatarLetter: avatarLetter(LIUSHU_KEY), avatarColor: avatarColor(LIUSHU_KEY),
          // 用故事内基准时间：原先置 0 → new Date(0) 渲染成 01/01（1970 纪元，审核报告 2.E）。
          lastMessageTime: new Date('2026-03-13T15:35:00+08:00').getTime(),
          lastMessagePreview: preview,
        });
      }
      return list.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    },
    [threadMap, triggeredSet],
  );

  // 当前线程消息
  const activeMessages = useMemo<MessageItem[]>(() => {
    if (!activeThread) return [];
    // 刘叔线程：步进序号驱动。玩家发言 seq=2i，刘叔回复 seq=2i+1，
    // 按 seq 升序入栈——一来一回绝不乱序。不再与 ev.receivedAt / Date.now 混排。
    // 时间显示：本轮有刘叔回复→玩家发言与回复同取回复事件时间(回复在前一刻)；
    // 本轮无回复(如"兄弟")→沿用上一轮回复时间，避免 1970 纪元污染日期分隔条。
    if (activeThread === LIUSHU_KEY) {
      const items: MessageItem[] = [];
      let lastTs = new Date('2026-03-13T15:35:00+08:00').getTime(); // 故事内基准，无回复轮兜底
      LIUSHU_PRESETS.forEach((p, i) => {
        if (!triggeredSet.has(p.keyword)) return;
        const reply = p.replyEventId ? getSmsEventById(p.replyEventId) : undefined;
        const turnTs = reply ? new Date(reply.receivedAt).getTime() : lastTs;
        lastTs = turnTs;
        // 玩家发言（用 turnTs 保证与回复同属一刻；seq 决定先后）
        items.push({
          kind: 'player', timestamp: turnTs, isSent: true, body: p.playerText, seq: i * 2,
        });
        // 刘叔回复（按 replyEventId 显式取，避免泄露 exchange-2/4 的 direction:sent 文本）
        if (reply) {
          items.push({
            kind: 'ev', ev: reply, timestamp: turnTs,
            isSent: false, body: reply.body, alertStyle: reply.alertStyle,
            footnote: reply.footnote ?? undefined, seq: i * 2 + 1,
          });
        }
      });
      return items.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    }
    // 其余线程：按事件时间戳排序
    const events = (threadMap.get(activeThread) ?? []).map((ev) => ({
      kind: 'ev' as const, ev,
      timestamp: new Date(ev.receivedAt).getTime(),
      isSent: ev.direction === 'sent',
      body: ev.body, alertStyle: ev.alertStyle, footnote: ev.footnote ?? undefined,
    }));
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }, [activeThread, threadMap, triggeredSet]);

  // 新消息提醒
  useEffect(() => {
    for (const ev of visibleEvents) {
      if (alertedRef.current.has(ev.id)) continue;
      alertedRef.current.add(ev.id);
      if (ev.alertStyle === 'danger') showFullscreenAlert(ev.body, 'danger');
      else if (ev.alertStyle === 'warning') showToast(ev.body, 'warning');
    }
  }, [visibleEvents]);

  const countdownActive = useMemo(
    () => Object.values(countdowns ?? {}).some((c) => !c.expired), [countdowns]);
  const finaleReady = collectedEvidenceIds.length >= 5
    && (currentChapterId === 'ch-finale' || currentChapterId === 'ch-5');

  // 发预设（推进刘叔对话到下一轮）。不再写 playerMsgs——刘叔线程的玩家发言
  // 由 triggeredSet 在 activeMessages 里按 seq 渲染，避免 Date.now 与故事时间混排。
  const sendPreset = useCallback((p: LiuShuPreset) => {
    setTriggeredSet((s) => {
      const n = new Set(s);
      n.add(p.keyword);
      return n;
    });
    if (p.replyEventId) setTimeout(() => showToast('刘叔已回复', 'info'), 400);
  }, []);

  // 刘叔线程：按 LIUSHU_PRESETS 顺序，当前该说的下一句=第一个尚未触发的预设。
  // 一次只露这一个按钮；全部触发完则返回 null（按钮区改显示"刘叔沉默了"）。
  const nextLiuShuPreset = useMemo<LiuShuPreset | null>(
    () => LIUSHU_PRESETS.find((p) => !triggeredSet.has(p.keyword)) ?? null,
    [triggeredSet],
  );

  // =========================== RENDER ===========================

  return (
    <div style={S.wrap}>
      {activeThread ? (
        <Conversation
          threadKey={activeThread}
          displayName={threadDisplayName(activeThread)}
          messages={activeMessages}
          isLiuShu={activeThread === LIUSHU_KEY}
          nextPreset={nextLiuShuPreset}
          onBack={() => setActiveThread(null)}
          onSendPreset={sendPreset}
        />
      ) : (
        <ThreadList
          threads={summaries}
          onSelect={(k) => setActiveThread(k)}
          countdownActive={countdownActive}
          finaleReady={finaleReady}
        />
      )}
    </div>
  );
}

// ===== Thread List View =====

function ThreadList({ threads, onSelect, countdownActive, finaleReady }: {
  threads: ThreadSummary[];
  onSelect: (k: ThreadKey) => void;
  countdownActive: boolean;
  finaleReady: boolean;
}): ReactNode {
  return (
    <>
      <div style={S.header}>
        <span style={S.headerTitle}>信息</span>
        <span style={S.headerHint}>{threads.length} 个会话</span>
      </div>
      <div style={S.threadBody}>
        {threads.length === 0 && (
          <div style={S.empty}>暂无短信</div>
        )}
        {threads.map((t) => (
          <button key={t.key} style={S.threadRow} onClick={() => onSelect(t.key)}>
            <div style={{ ...S.avatar, background: t.avatarColor }}>{t.avatarLetter}</div>
            <div style={S.threadInfo}>
              <div style={S.nameRow}>
                <span style={S.name}>{t.displayName}</span>
                <span style={S.time}>{fmtDate(new Date(t.lastMessageTime).toISOString())}</span>
              </div>
              <div style={S.preview}>{t.lastMessagePreview}</div>
            </div>
          </button>
        ))}
      </div>
      {(countdownActive || finaleReady) && (
        <div style={S.hintBar}>
          {countdownActive ? '倒计时进行中' : '关键证据已归档'}
        </div>
      )}
    </>
  );
}

// ===== Conversation View =====

function Conversation({ threadKey: _tk, displayName, messages, isLiuShu, nextPreset, onBack, onSendPreset }: {
  threadKey: ThreadKey;
  displayName: string;
  messages: MessageItem[];
  isLiuShu: boolean;
  /** 刘叔线程：当前该说的下一句预设（无则 null=对话走完）。一次只露这一个按钮。 */
  nextPreset: LiuShuPreset | null;
  onBack: () => void;
  onSendPreset: (p: LiuShuPreset) => void;
}): ReactNode {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages.length]);

  return (
    <div style={S.convWrap}>
      <div style={S.convHeader}>
        <button style={S.backBtn} onClick={onBack}>← 返回</button>
        <div style={S.convTitle}>{displayName}</div>
        <div style={{ width: 50 }} />
      </div>
      <div ref={listRef} style={S.convBody}>
        {messages.map((msg, i) => {
          if (msg.kind === 'ev' && msg.ev) {
            const ev = msg.ev;
            const prev = messages[i - 1];
            const showDate = i === 0 || fmtDate(ev.receivedAt) !== fmtDate(
              prev?.kind === 'ev' && prev?.ev ? prev.ev.receivedAt : new Date(prev!.timestamp).toISOString());
            return (
              <React.Fragment key={`ev-${ev.id}`}>
                {showDate && <DateSep label={fmtDate(ev.receivedAt)} />}
                <Bubble
                  dir={msg.isSent ? 'sent' : 'recv'}
                  sender={senderName(ev.from)} time={fmtTime(ev.receivedAt)}
                  body={msg.body} footnote={msg.footnote} alert={msg.alertStyle}
                />
              </React.Fragment>
            );
          }
          const prev = messages[i - 1];
          const showDate = i === 0 || fmtDate(new Date(msg.timestamp).toISOString()) !== fmtDate(
            new Date(prev!.timestamp).toISOString());
          return (
            <React.Fragment key={`p-${i}`}>
              {showDate && <DateSep label={fmtDate(new Date(msg.timestamp).toISOString())} />}
              <Bubble dir="sent" sender="林哲" time={fmtTime(new Date(msg.timestamp).toISOString())} body={msg.body} />
            </React.Fragment>
          );
        })}
        <div style={{ height: 4 }} />
      </div>
      {isLiuShu && (
        <div style={S.qrBar}>
          {nextPreset ? (
            <button key={nextPreset.keyword} style={S.qrBtn(false)}
              onClick={() => onSendPreset(nextPreset)} title={nextPreset.playerText}>
              {trunc(nextPreset.playerText, 10)}
            </button>
          ) : (
            <span style={S.qrHint}>刘叔沉默了，不再回复。</span>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Bubble 组件 =====

function Bubble({ dir, sender, time, body, footnote, alert }: {
  dir: 'sent' | 'recv';
  sender: string;
  time: string;
  body: string;
  footnote?: string;
  alert?: 'info' | 'warning' | 'danger' | 'success';
}): ReactNode {
  const sent = dir === 'sent';
  const ring = alert === 'danger' ? '#ff4d4f' : alert === 'warning' ? '#ffa940' : 'transparent';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: sent ? 'flex-end' : 'flex-start', margin: '3px 0' }}>
      {!sent && <div style={S.bubbleMeta}>{sender} · {time}</div>}
      <div style={{
        maxWidth: '78%', padding: '8px 12px', borderRadius: 12,
        background: sent ? '#3aa55c' : '#23344a', color: '#fff', fontSize: 13, lineHeight: 1.5,
        boxShadow: ring !== 'transparent' ? `0 0 0 1.5px ${ring}` : undefined,
      }}>
        {body}
        {footnote && <div style={S.footnote}>{footnote}</div>}
      </div>
      {sent && time && <div style={S.sentTime}>{time}</div>}
    </div>
  );
}

function DateSep({ label }: { label: string }): ReactNode {
  return (
    <div style={S.dateSep}>
      <span style={S.dateSepInner}>{label}</span>
    </div>
  );
}

// ===== 样式 =====
// 集中定义以减少重复

const _S = {
  wrap: { height: '100%', display: 'flex', flexDirection: 'column', background: '#0e1620', color: '#e7eef7', fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif', paddingBottom: 'var(--home-inset)' } as React.CSSProperties,
  header: { height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', background: '#141f2c', borderBottom: '1px solid #1d2a3a' } as React.CSSProperties,
  headerTitle: { fontSize: 15, fontWeight: 600 } as React.CSSProperties,
  headerHint: { fontSize: 11, color: '#667' } as React.CSSProperties,
  threadBody: { flex: 1, overflowY: 'auto' } as React.CSSProperties,
  empty: { padding: 48, color: '#778', fontSize: 13, textAlign: 'center' } as React.CSSProperties,
  threadRow: { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none', borderBottom: '1px solid #1a2636', background: 'transparent', color: '#e7eef7', cursor: 'pointer', textAlign: 'left' } as React.CSSProperties,
  avatar: { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 } as React.CSSProperties,
  threadInfo: { flex: 1, minWidth: 0 } as React.CSSProperties,
  nameRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 } as React.CSSProperties,
  name: { fontSize: 14, fontWeight: 500 } as React.CSSProperties,
  time: { fontSize: 11, color: '#667' } as React.CSSProperties,
  preview: { fontSize: 12, color: '#889', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as React.CSSProperties,
  hintBar: { padding: '8px 12px', background: '#3a1d1d', color: '#ff9080', fontSize: 12, textAlign: 'center', borderTop: '1px solid #4d2a2a' } as React.CSSProperties,
  convWrap: { height: '100%', display: 'flex', flexDirection: 'column', background: '#0e1620', paddingBottom: 'var(--home-inset)' } as React.CSSProperties,
  convHeader: { height: 44, display: 'flex', alignItems: 'center', background: '#141f2c', borderBottom: '1px solid #1d2a3a' } as React.CSSProperties,
  backBtn: { width: 50, padding: '0 10px', background: 'none', border: 'none', color: '#8ab4f8', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' } as React.CSSProperties,
  convTitle: { fontSize: 15, fontWeight: 600, flex: 1, textAlign: 'center' } as React.CSSProperties,
  convBody: { flex: 1, overflowY: 'auto', padding: '4px 12px 8px', display: 'flex', flexDirection: 'column' } as React.CSSProperties,
  bubbleMeta: { fontSize: 10, color: '#778', margin: '0 4px 2px' } as React.CSSProperties,
  footnote: { fontSize: 11, opacity: 0.85, marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 4 } as React.CSSProperties,
  sentTime: { fontSize: 10, color: '#667', margin: '2px 4px 0' } as React.CSSProperties,
  dateSep: { textAlign: 'center', fontSize: 11, color: '#667', margin: '12px 0 8px' } as React.CSSProperties,
  dateSepInner: { background: '#141f2c', padding: '2px 10px', borderRadius: 8 } as React.CSSProperties,
  qrBar: { padding: '8px 10px', borderTop: '1px solid #1a2838', background: '#101a26', display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'center' } as React.CSSProperties,
  qrHint: { fontSize: 12, color: '#778', fontStyle: 'italic' } as React.CSSProperties,
};

// quickReplyBtnStyle 是函数，不放进 _S
function qrBtn(used: boolean): React.CSSProperties {
  return {
    padding: '5px 10px', borderRadius: 8, background: used ? '#1a2838' : '#2c5e8c',
    color: used ? '#566' : '#fff', border: '1px solid #24374d', fontSize: 12,
    cursor: used ? 'default' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
  };
}

// 给 S 命名方便引用
const S = { ..._S, qrBtn };