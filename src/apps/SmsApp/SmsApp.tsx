/**
 * src/apps/SmsApp/SmsApp.tsx — 短信
 *
 * 引擎驱动（迁移后）：
 *  - 威胁短信 sms-zhangqiang-threat 由 page-lab-funding-report.onViewEffects.pushSms 触发 →
 *    engine EffectExecutor.pushSms → SmsService 送达 + toast + PhoneShell 通知栏
 *  - 妈妈日常短信、真结局举报回执等同理由 pushSms effect 触发
 *  - 玩家发短信给刘叔：本地预设对话（UI 局部态），发预设触发刘叔预设回复
 *  - 验证码红鲱鱼（§6.2 88888888 纯巧合）
 *
 * 迁移说明：原 ../PhoneApp/runtime 已删除。已送达短信读 engine SmsService.getDelivered()
 * （内存真源，PhoneShell 通知栏同源订阅）。反馈走 @/engine/feedback。
 * 刘叔预设对话、玩家消息、shownIds 均为 UI 局部态，保留组件 useState。
 */

import { useEffect, useMemo, useState } from 'react';
import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { loadSms } from '../PhoneApp/data';
import { useGameStore } from '@/engine/store/gameStore';
import * as HapticsService from '@/engine/feedback/HapticsService';
import { fullscreenAlert, toast as engineToast } from '@/engine/feedback/AlertService';
import { getDelivered, subscribeDelivered } from '@/engine/feedback/SmsService';
// 用全局 @/types 的 SmsEvent / SmsFrom 作为真值类型（与 engine SmsService/EffectExecutor 同源）；
// data.ts 的本地 SmsEvent 在 direction 字段上更窄，故 loadSms 结果在此处归一化。
import type { ContactId, EndingId, EvidenceId, SmsEvent, SmsFrom } from '@/types';

// 刘叔预设对话：玩家点击发送一条 prompted keyword 即解锁对应刘叔回复
interface LiuShuPreset {
  keyword: string;
  playerText: string;
  replyEventId: string;
}
const LIUSHU_PRESETS: LiuShuPreset[] = [
  { keyword: '李桥瑞去向', playerText: '刘叔，李桥瑞去哪了？', replyEventId: 'sms-liushu-exchange-1' },
  { keyword: '哪个家长', playerText: '哪个家长？他爸妈都在外地。', replyEventId: 'sms-liushu-exchange-3' },
  { keyword: '兄弟', playerText: '刘叔，李桥瑞是我兄弟。', replyEventId: '' },
  { keyword: '新希望成长中心', playerText: '是不是送去了新希望成长中心？', replyEventId: 'sms-liushu-warning' },
];

function senderDisplay(s: SmsFrom, fallbackCharName: Record<string, string>): string {
  if (typeof s === 'string') return fallbackCharName[s] ?? s;
  return s.display;
}

function isSent(ev: SmsEvent): boolean {
  return ev.direction === 'sent';
}

// engine SmsService 已送达短信列表（内存真源，由 EffectExecutor.pushSms 写入）
function useDeliveredSms(): SmsEvent[] {
  return useSyncExternalStore(
    (cb) => subscribeDelivered(cb),
    () => getDelivered(),
    () => getDelivered(),
  );
}

export default function SmsApp(): ReactNode {
  const [allSms, setAllSms] = useState<SmsEvent[]>([]);
  const [shownIds, setShownIds] = useState<string[]>([]);
  const [threadFilter, setThreadFilter] = useState<'all' | ContactId>('all');
  const [presetUsed, setPresetUsed] = useState<Set<string>>(new Set());
  const [playerMessages, setPlayerMessages] = useState<Record<string, { id: string; text: string; sentAt: string }[]>>({});
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const delivered = useDeliveredSms();
  // engine store 真值（与 PhoneShell 状态栏同源）
  const collectedEvidenceIds = useGameStore((s) => s.collectedEvidenceIds);
  const currentChapterId = useGameStore((s) => s.currentChapterId);
  const endingId = useGameStore((s) => s.endingId) as EndingId | undefined;
  const countdowns = useGameStore((s) => s.countdowns);
  // 重写后风险值系统已废：risk 恒 0。原 risk>=20 解锁的二段威胁短信（sms-zhangqiang-second-threat）不再显示——
  // 威胁压迫感改由 page-lab-funding-report 的倒计时四件套 + 刀哥门铃承担（玩家决策 2026-08-19）。
  const risk = 0;
  const solvedPuzzleIds = useGameStore((s) => s.solvedPuzzleIds);

  // 字符→显示名速查（从 localStorage 已加载过的 ContactId → 展示）
  const charName = useMemo<Record<string, string>>(
    () => ({
      'char-linzhe': '林哲',
      'char-liushu': '刘叔',
      'char-mom': '妈妈',
      'char-dispatcher': '省公安厅',
      'char-zhangqiang': '张强',
    }),
    [],
  );

  useEffect(() => {
    let mounted = true;
    loadSms()
      .then((evs) => {
        if (!mounted) return;
        // data.ts 本地 SmsEvent.direction 是 'sent'|undefined（窄于全局 MessageDirection），
        // 结构兼容；归一化到 @/types.SmsEvent（与 engine SmsService 同源，避免双类型冲突）
        setAllSms(evs as unknown as SmsEvent[]);
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        setLoadErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      mounted = false;
    };
  }, []);

  // 可见短信 = engine 已送达的（pushSms 真源）+ 本地可自展示的（依赖 engine store 阈值）
  const visibleEvents = useMemo<SmsEvent[]>(() => {
    const deliveredSet = new Set(delivered.map((d) => d.id));
    return allSms.filter((ev) => {
      if (shownIds.includes(ev.id)) return true;
      // engine 已送达（pushSms effect 触发）→ 必显示
      if (deliveredSet.has(ev.id)) return true;
      // 本地可自展示（与 engine store 联动作为代理信号）：
      //  - sms-zhangqiang-second-threat：risk>=20（risk 由 engine RiskService 管理）
      //  - sms-liushu-*：玩家发预设短信后解锁
      //  - sms-verification-redherring：解过 puzzle-xinxwang-backend
      //  - sms-mom-care：进入 ch-5 / ch-finale
      //  - sms-good-ending-dispatcher：真结局后（endingId=good）
      switch (ev.id) {
        case 'sms-zhangqiang-second-threat': {
          return risk >= 20;
        }
        case 'sms-liushu-exchange-1':
        case 'sms-liushu-exchange-2':
        case 'sms-liushu-exchange-3':
        case 'sms-liushu-exchange-4':
        case 'sms-liushu-warning': {
          return presetUsed.has(ev.id) || presetUsed.has('any-liushu');
        }
        case 'sms-verification-redherring': {
          return solvedPuzzleIds.includes('puzzle-xinxwang-backend');
        }
        case 'sms-mom-care': {
          return currentChapterId === 'ch-5' || currentChapterId === 'ch-finale';
        }
        case 'sms-good-ending-dispatcher': {
          return endingId === 'good';
        }
        default:
          return false;
      }
    });
  }, [allSms, shownIds, delivered, presetUsed, risk, solvedPuzzleIds, currentChapterId, endingId]);

  // 威胁短信到达时配合 engine AlertService（仅对新到达的、未标记的处理）
  useEffect(() => {
    for (const ev of visibleEvents) {
      if (shownIds.includes(ev.id)) continue;
      if (ev.id === 'sms-zhangqiang-threat') {
        HapticsService.vibrate('long');
        fullscreenAlert('收到一条威胁短信', 'danger');
      }
      if (ev.id === 'sms-zhangqiang-second-threat') {
        HapticsService.vibrate('short');
        engineToast('收到陌生号码短信', 'warning');
      }
      if (ev.alertStyle === 'danger' && ev.id !== 'sms-zhangqiang-threat') {
        engineToast(ev.body, 'danger');
      }
      setShownIds((arr) => [...arr, ev.id]);
    }
  }, [visibleEvents, shownIds]);

  // 玩家发预设短信
  const sendPreset = (preset: LiuShuPreset) => {
    const now = new Date().toISOString();
    const playerMsgId = `player-${preset.keyword}-${now}`;
    setPlayerMessages((m) => ({
      ...m,
      ['char-liushu']: [...(m['char-liushu'] ?? []), { id: playerMsgId, text: preset.playerText, sentAt: now }],
    }));
    setPresetUsed((s) => {
      const n = new Set(s);
      n.add('any-liushu');
      n.add(preset.keyword);
      if (preset.replyEventId) n.add(preset.replyEventId);
      return n;
    });
    HapticsService.vibrate('short');
    if (preset.replyEventId) {
      setTimeout(() => engineToast('刘叔已回复', 'info'), 400);
    }
  };

  // 合并显示：（玩家发出的预设消息 + 事件），按时间排序
  const normalizedThread = useMemo(() => {
    type Item =
      | { kind: 'ev'; ev: SmsEvent; t: number }
      | { kind: 'player'; text: string; sentAt: string; to: ContactId; t: number };
    const items: Item[] = [];
    for (const ev of visibleEvents) {
      items.push({ kind: 'ev', ev, t: new Date(ev.receivedAt).getTime() });
    }
    for (const p of playerMessages['char-liushu'] ?? []) {
      items.push({ kind: 'player', text: p.text, sentAt: p.sentAt, to: 'char-liushu', t: new Date(p.sentAt).getTime() });
    }
    items.sort((a, b) => a.t - b.t);
    return items;
  }, [visibleEvents, playerMessages]);

  if (loadErr) {
    return (
      <div style={{ padding: 24, color: '#f88' }}>短信数据加载失败：{loadErr}</div>
    );
  }

  const senders = useMemo(() => {
    const set = new Set<ContactId>();
    for (const ev of allSms) {
      if (typeof ev.from === 'string') set.add(ev.from);
    }
    set.add('char-liushu');
    return Array.from(set);
  }, [allSms]);

  const filtered = threadFilter === 'all'
    ? normalizedThread
    : normalizedThread.filter((it) =>
        it.kind === 'player'
          ? it.to === threadFilter
          : typeof it.ev.from === 'string' && it.ev.from === threadFilter,
      );

  // 终章倒计时进行态（用于威胁紧迫感提示）
  const countdownActive = useMemo(
    () => Object.values(countdowns ?? {}).some((c) => !c.expired),
    [countdowns],
  );

  return (
    <div style={wrapStyle}>
      <div style={headerStyle}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>短信</div>
      </div>

      <div style={filterRow}>
        <button
          style={threadFilter === 'all' ? filterActive : filterIdle}
          onClick={() => setThreadFilter('all')}
        >
          全部
        </button>
        {senders.map((s) => (
          <button
            key={s}
            style={threadFilter === s ? filterActive : filterIdle}
            onClick={() => setThreadFilter(s)}
          >
            {charName[s] ?? s}
          </button>
        ))}
      </div>

      <div style={threadListStyle}>
        {filtered.length === 0 && (
          <div style={{ padding: 24, color: '#778', fontSize: 13, textAlign: 'center' }}>
            暂无短信
          </div>
        )}
        {filtered.map((item, i) => {
          if (item.kind === 'player') {
            return (
              <Bubble
                key={`p-${i}`}
                direction="sent"
                sender="林哲"
                time={fmtTime(item.sentAt)}
                body={item.text}
              />
            );
          }
          const ev = item.ev;
          const sent = isSent(ev);
          return (
            <Bubble
              key={`e-${ev.id}-${i}`}
              direction={sent ? 'sent' : 'received'}
              sender={senderDisplay(ev.from, charName)}
              time={fmtTime(ev.receivedAt)}
              body={ev.body}
              footnote={ev.footnote ?? undefined}
              alertStyle={ev.alertStyle}
            />
          );
        })}
      </div>

      {/* 刘叔预设对话入口 */}
      <div style={presetBar}>
        <span style={{ fontSize: 11, color: '#889' }}>给刘叔发短信：</span>
        {LIUSHU_PRESETS.map((p) => (
          <button
            key={p.keyword}
            style={presetBtn(presetUsed.has(p.keyword))}
            disabled={presetUsed.has(p.keyword)}
            onClick={() => sendPreset(p)}
          >
            {p.playerText.length > 12 ? p.playerText.slice(0, 12) + '…' : p.playerText}
          </button>
        ))}
      </div>

      {/* 倒计时威胁紧迫提示 */}
      {countdownActive && (
        <div style={hintBar}>
          倒计时进行中——证据齐备后速去电话 App 拨打 0731-88888888
        </div>
      )}

      {/* 终章提示：若已收集≥5证据且处于终章，提示玩家去 PhoneApp 拨号 */}
      {collectedEvidenceIds.length >= 5 && (currentChapterId === 'ch-finale' || currentChapterId === 'ch-5') && (
        <div style={hintBar}>
          证据已齐备，去电话 App 拨打 0731-88888888
        </div>
      )}
    </div>
  );

  // 引用占位：collectedEvidenceIds 作为 EvidenceId[] 类型锚定（避免 lint 未使用误报）
  void (collectedEvidenceIds as EvidenceId[]);
}

interface BubbleProps {
  direction: 'sent' | 'received';
  sender: string;
  time: string;
  body: string;
  footnote?: string;
  alertStyle?: 'info' | 'warning' | 'danger' | 'success';
}
function Bubble({ direction, sender, time, body, footnote, alertStyle }: BubbleProps): ReactNode {
  const isSent = direction === 'sent';
  const ringColor =
    alertStyle === 'danger' ? '#ff4d4f' : alertStyle === 'warning' ? '#ffa940' : 'transparent';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isSent ? 'flex-end' : 'flex-start',
        margin: '4px 0',
      }}
    >
      <div style={{ fontSize: 10, color: '#778', margin: '0 4px 2px' }}>
        {sender} · {time}
      </div>
      <div
        style={{
          maxWidth: '78%',
          padding: '8px 12px',
          borderRadius: 12,
          background: isSent ? '#3aa55c' : '#23344a',
          color: '#fff',
          fontSize: 13,
          lineHeight: 1.5,
          boxShadow: ringColor === 'transparent' ? 'none' : `0 0 0 1.5px ${ringColor}`,
        }}
      >
        {body}
        {footnote && (
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>{footnote}</div>
        )}
      </div>
    </div>
  );
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
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
  justifyContent: 'center',
  background: '#141f2c',
  borderBottom: '1px solid #1d2a3a',
};
const filterRow: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: '6px 10px',
  overflowX: 'auto',
  borderBottom: '1px solid #1a2636',
};
const filterActive: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 12,
  background: '#2c5e8c',
  color: '#fff',
  border: 'none',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
const filterIdle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 12,
  background: '#1a2838',
  color: '#9aa6b5',
  border: '1px solid #24374d',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
const threadListStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '8px 12px',
  display: 'flex',
  flexDirection: 'column',
};
const presetBar: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: '8px 10px',
  borderTop: '1px solid #1a2838',
  background: '#101a26',
  overflowX: 'auto',
  alignItems: 'center',
};
function presetBtn(used: boolean): React.CSSProperties {
  return {
    padding: '4px 8px',
    borderRadius: 8,
    background: used ? '#1a2838' : '#2c5e8c',
    color: used ? '#566' : '#fff',
    border: '1px solid #24374d',
    fontSize: 11,
    cursor: used ? 'default' : 'pointer',
    whiteSpace: 'nowrap',
  };
}
const hintBar: React.CSSProperties = {
  padding: '8px 12px',
  background: '#3a1d1d',
  color: '#ff9080',
  fontSize: 12,
  textAlign: 'center',
  borderTop: '1px solid #4d2a2a',
};
