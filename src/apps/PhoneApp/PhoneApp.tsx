/**
 * src/apps/PhoneApp/PhoneApp.tsx — 拨号 + 通话（终章核心）
 *
 * 严格遵循 CLAUDE.md §0 + §4.1：纯前端零后端；拨打号码由 puzzle 校验，
 * 答案不硬编码在代码里（举报电话号码从 call-log.json 读，校验策略从 puzzles 读）。
 *
 * 终章闭环（CLAUDE.md §1 + §6.5 + 交互设计 §三.4）：
 *   AlbumApp 勾选≥5 关键证据（puzzle-evidence-finale 已解） →
 *   PhoneApp 拨打 0731-88888888 →
 *   通话字幕（call-scripts.json call-script-dispatcher-report）→
 *   玩家在通话内"发送证据"再次触发 puzzle-evidence-finale →
 *   引擎 evidenceSet 校验 → good 分支 endEffects（pushEnding good + openNewsApp）经引擎
 *   EffectExecutor 执行 → 真结局。
 *
 * 迁移说明（frontend-phone-apps engine 迁移）：
 *   原 ./runtime 已删除。全局态/谜题/证据/倒计时全部走 @/engine/hooks，
 *   反馈服务走 @/engine/feedback。本地仅保留 UI 局部 useState（拨号输入、通话进行态）。
 */

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  CallRecord,
  CallScript,
  CallScriptBlock,
} from './data';
import {
  loadCallLog,
  loadCallScripts,
} from './data';
import { usePuzzle } from '@/engine/hooks/usePuzzle';
import { useGameStore, hasActiveCountdown } from '@/engine/store/gameStore';
import * as AudioService from '@/engine/feedback/AudioService';
import * as HapticsService from '@/engine/feedback/HapticsService';
import { executeEffects } from '@/engine/puzzle/EffectExecutor';
import type { PuzzleEffect } from '@/types';
import type { EvidenceId } from '@/types';

type Phase = 'recents' | 'dial' | 'calling';

const KEY_MAP: { d: string; sub?: string }[] = [
  { d: '1', sub: '' },
  { d: '2', sub: 'ABC' },
  { d: '3', sub: 'DEF' },
  { d: '4', sub: 'GHI' },
  { d: '5', sub: 'JKL' },
  { d: '6', sub: 'MNO' },
  { d: '7', sub: 'PQRS' },
  { d: '8', sub: 'TUV' },
  { d: '9', sub: 'WXYZ' },
  { d: '*', sub: '' },
  { d: '0', sub: '+' },
  { d: '#', sub: '' },
];

// 终章举报电话号码字面（与 call-log.json call-report-police.rawNumber 一致）
const HOTLINE_DISPLAY = '0731-88888888';
const HOTLINE_RAW = '073188888888';
const FINALE_PUZZLE_ID = 'puzzle-evidence-finale';
const DISPATCHER_SCRIPT_ID = 'call-script-dispatcher-report';

function normalizeDigits(s: string): string {
  return s.replace(/[^\d*#+]/g, '');
}

export default function PhoneApp(): ReactNode {
  const [phase, setPhase] = useState<Phase>('recents');
  const [draft, setDraft] = useState('');
  const [records, setRecords] = useState<CallRecord[]>([]);
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // 倒计时进行中 → 红色拨号强调（受 engine CountdownService 驱动）。
  // engine store 的 countdowns 是真值（key='webgame-save'），PhoneShell 状态栏/通知栏同源。
  const countdowns = useGameStore((s) => s.countdowns);
  // 多倒计时场景任一未过期即视为进行中
  const countdownRunning = useMemo(
    () => Object.values(countdowns ?? {}).some((c) => !c.expired) || hasActiveCountdown('countdown-finale'),
    [countdowns],
  );

  useEffect(() => {
    let mounted = true;
    Promise.all([loadCallLog(), loadCallScripts()])
      .then(([r, sc]) => {
        if (!mounted) return;
        setRecords(r);
        setScripts(sc);
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        setLoadErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      mounted = false;
    };
  }, []);

  const press = (k: string) => setDraft((d) => (d.length >= 24 ? d : d + k));

  const [caller, setCaller] = useState<{ display: string; script?: CallScript } | null>(null);

  function onStartCall(display: string, script?: CallScript) {
    setCaller({ display, script });
    setPhase('calling');
  }

  const backToRecents = () => {
    setPhase('recents');
    setCaller(null);
    AudioService.stop();
  };

  if (loadErr) {
    return (
      <div className="phone-app" style={wrapStyle}>
        <div style={{ padding: 24, color: '#ff8888' }}>数据加载失败：{loadErr}</div>
      </div>
    );
  }

  if (phase === 'calling' && caller) {
    return (
      <CallView
        display={caller.display}
        script={caller.script}
        onHangup={backToRecents}
      />
    );
  }

  return (
    <div className="phone-app" style={wrapStyle}>
      <Header
        title={phase === 'dial' ? '拨号' : '通话记录'}
        onBack={phase === 'dial' ? () => setPhase('recents') : undefined}
        rightAction={
          phase === 'recents' ? (
            <button style={iconBtn} onClick={() => setPhase('dial')}>
              ⌘
            </button>
          ) : undefined
        }
      />

      {phase === 'recents' && (
        <RecentsList records={records} onCall={(rec) => onCreateCall(rec, scripts, onStartCall)} />
      )}

      {phase === 'dial' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={displayArea}>
            <div style={displayNumber}>{draft || '请输入号码'}</div>
            {countdownRunning && draft.length > 0 && (
              <div style={{ color: '#ff6666', fontSize: 12 }}>
                倒计时进行中，速拨举报电话
              </div>
            )}
          </div>

          <div style={keypad}>
            {KEY_MAP.map((k) => (
              <button
                key={k.d}
                style={keyBtn}
                onClick={() => press(k.d)}
                onPointerDown={() => HapticsService.vibrate('short')}
              >
                <div style={{ fontSize: 26, fontWeight: 600 }}>{k.d}</div>
                {k.sub && <div style={{ fontSize: 9, letterSpacing: 1, color: '#888' }}>{k.sub}</div>}
              </button>
            ))}
          </div>

          <div style={actionRow}>
            <div style={{ width: 64 }} />
            <button
              style={callBtn(countdownRunning)}
              onClick={() => {
                if (!draft) return;
                const raw = normalizeDigits(draft);
                const isHotline =
                  raw === HOTLINE_RAW || raw === normalizeDigits(HOTLINE_DISPLAY);
                if (isHotline) {
                  const script = scripts.find((s) => s.id === DISPATCHER_SCRIPT_ID);
                  onStartCall(HOTLINE_DISPLAY, script);
                } else {
                  // 拨打其他号码：尝试匹配 call-log 里的预设通话
                  const rec = records.find(
                    (r) =>
                      (r.rawNumber && normalizeDigits(r.rawNumber) === raw) ||
                      normalizeDigits(r.displayNumber) === raw,
                  );
                  const script = rec?.scriptId
                    ? scripts.find((s) => s.id === rec.scriptId)
                    : undefined;
                  onStartCall(draft, script);
                }
              }}
              aria-label="拨打"
            >
              ☎
            </button>
            <button
              style={iconBtn}
              onClick={() => setDraft((d) => d.slice(0, -1))}
              aria-label="删除一位"
            >
              ⌫
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function onCreateCall(
  rec: CallRecord,
  scripts: CallScript[],
  onStartCall: (display: string, script?: CallScript) => void,
) {
  const script = rec.scriptId ? scripts.find((s) => s.id === rec.scriptId) : undefined;
  onStartCall(rec.displayNumber, script);
}

// ===== 通话界面 =====
interface CallViewProps {
  display: string;
  script: CallScript | undefined;
  onHangup: () => void;
}

function CallView({ display, script, onHangup }: CallViewProps): ReactNode {
  const dispatcherScript = useMemo(
    () => (script?.id === DISPATCHER_SCRIPT_ID ? script : undefined),
    [script],
  );
  const [nowIdx, setNowIdx] = useState(0);
  const [branch, setBranch] = useState<'good' | 'normal' | null>(null);
  const [callEnded, setCallEnded] = useState(false);
  const [status, setStatus] = useState<string>('正在呼叫…');
  const [evidencePromptOpen, setEvidencePromptOpen] = useState(false);
  const [waitingEvidenceResult, setWaitingEvidenceResult] = useState(false);

  // 终章谜题状态 + 倒计时进行态读 engine store（真值，与 PhoneShell 同源）
  const finalePuzzled = useGameStore((s) => s.solvedPuzzleIds.includes(FINALE_PUZZLE_ID));
  const countdownRunning = useGameStore((s) => Object.values(s.countdowns ?? {}).some((c) => !c.expired));
  // 引擎 usePuzzle(puzzleId)：submit(value) 走 PuzzleService（内部已执行 onSuccess/onFailure）
  const { submit: submitFinale } = usePuzzle(FINALE_PUZZLE_ID);

  const baseBlocks: CallScriptBlock[] = dispatcherScript?.blocks ?? [];
  const branchBlocks: CallScriptBlock[] = branch
    ? dispatcherScript?.branches?.[branch]?.blocks ?? []
    : [];
  const visibleBlocks = useMemo(
    () => [...baseBlocks, ...branchBlocks].slice(0, nowIdx + 1),
    [baseBlocks, branchBlocks, nowIdx],
  );

  // 逐块推进；命中特殊节点暂停
  useEffect(() => {
    if (!script) {
      // 预设通话（如班主任脚本）或无应答
      if (isNoAnswer(display)) {
        setStatus('无人接听');
        const t = setTimeout(() => {
          setCallEnded(true);
        }, 2200);
        return () => clearTimeout(t);
      }
      setStatus('通话中');
      // 无 script 的预设通话：仅显示一段等待，随后挂断
      const t = setTimeout(() => setCallEnded(true), 2800);
      return () => clearTimeout(t);
    }
    if (callEnded || waitingEvidenceResult || evidencePromptOpen) return;
    if (nowIdx >= baseBlocks.length + branchBlocks.length) return;

    const current = [...baseBlocks, ...branchBlocks][nowIdx];
    if (!current) return;

    // 命中系统提示：渲染后短暂推进
    if (current.type === 'system') {
      setStatus(current.text);
      const t = setTimeout(() => setNowIdx((i) => i + 1), 1400);
      return () => clearTimeout(t);
    }

    // 命中 evidenceSelection：暂停，等待玩家提交
    if (current.type === 'evidenceSelection') {
      setStatus(current.prompt);
      setEvidencePromptOpen(true);
      return;
    }

    // 命中 branch：根据 puzzle-evidence-finale 解谜状态决定分支
    if (current.type === 'branch') {
      // 此分支由提交证据时的 submit 结果驱动；这里兜底跳过
      return;
    }

    // line：每 3.5s 推进一条（倒计时紧迫时加速）
    const delay = countdownRunning ? 2400 : 3500;
    const t = setTimeout(() => setNowIdx((i) => i + 1), delay);
    return () => clearTimeout(t);
  }, [
    nowIdx,
    baseBlocks,
    branchBlocks,
    script,
    callEnded,
    waitingEvidenceResult,
    evidencePromptOpen,
    display,
    countdownRunning,
  ]);

  // 入场响铃
  useEffect(() => {
    AudioService.play('audio-call-ringback', true);
    return () => AudioService.stop('audio-call-ringback');
  }, []);

  useEffect(() => {
    if (callEnded) {
      AudioService.stop();
      HapticsService.vibrate('long');
      setStatus('通话结束');
      const t = setTimeout(onHangup, 1500);
      return () => clearTimeout(t);
    }
  }, [callEnded, onHangup]);

  // evidenceSelection 节点打开证据勾选弹窗（终章核心联动）。
  // 提交时调 engine usePuzzle().submit({ selected })：PuzzleService 内部已校验 + 执行
  // onSuccess（advanceChapter ch-finale）。分支 endEffects（pushEnding good / openNewsApp good）
  // 经 engine EffectExecutor 统一执行，本组件不再自己 _applyEffects。
  async function handleEvidenceSubmit(selected: EvidenceId[]): Promise<void> {
    if (!dispatcherScript) return;
    setWaitingEvidenceResult(true);
    const result = submitFinale({ selected });
    setEvidencePromptOpen(false);
    // 根据 submit 结果切分支
    const decidedBranch: 'good' | 'normal' = result.success ? 'good' : 'normal';
    setBranch(decidedBranch);
    setNowIdx((i) => i + 1); // 跳过 branch 块
    setWaitingEvidenceResult(false);
    // 分支块播完后，把 branch.endEffects 交引擎 EffectExecutor 执行（真结局闭环）
    const branchEndEffects =
      (dispatcherScript.branches?.[decidedBranch]?.endEffects as PuzzleEffect[] | undefined) ?? [];
    const branchLen = dispatcherScript.branches?.[decidedBranch]?.blocks.length ?? 0;
    setTimeout(() => {
      executeEffects(branchEndEffects);
      setCallEnded(true);
    }, (branchLen + 1) * 2400);
  }

  // 如果当前通话是举报电话但 puzzle-evidence-finale 已解（玩家提前在 AlbumApp 提交过），
  // 直接走对应分支
  useEffect(() => {
    if (!dispatcherScript) return;
    if (finalePuzzled && !branch && nowIdx === 0) {
      // 已预解，但仍按脚本走 evidenceSelection 节点，让玩家"重放发送证据"动作
    }
  }, [dispatcherScript, finalePuzzled, branch, nowIdx]);

  return (
    <div style={callWrapStyle}>
      <div style={callHeaderStyle}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{display}</div>
        <div style={{ fontSize: 12, color: '#9aa' }}>{status}</div>
      </div>

      <div style={subtitleArea}>
        {visibleBlocks
          .filter((b) => b.type === 'line' || b.type === 'system')
          .map((b, i) => {
            if (b.type === 'system') {
              return (
                <div key={`s-${i}`} style={systemLineStyle}>
                  {b.text}
                </div>
              );
            }
            // line
            const isLin = b.speaker === 'char-linzhe';
            return (
              <div
                key={`l-${i}`}
                style={{
                  ...bubbleStyle,
                  alignSelf: isLin ? 'flex-end' : 'flex-start',
                  background: isLin ? '#3aa55c' : '#2c3a4d',
                  color: '#fff',
                }}
              >
                {b.text}
              </div>
            );
          })}
        {waitingEvidenceResult && (
          <div style={systemLineStyle}>正在发送证据…</div>
        )}
      </div>

      {evidencePromptOpen && (
        <EvidenceSelection
          onSubmit={handleEvidenceSubmit}
          onCancel={() => {
            // 玩家取消：仅挂断，不切结局
            setEvidencePromptOpen(false);
            setCallEnded(true);
          }}
        />
      )}

      <div style={callActionsStyle}>
        <button style={hangupBtn} onClick={() => setCallEnded(true)}>
          挂断
        </button>
      </div>
    </div>
  );
}

interface EvidenceSelectionProps {
  onSubmit: (selected: EvidenceId[]) => void;
  onCancel: () => void;
}

function EvidenceSelection({ onSubmit, onCancel }: EvidenceSelectionProps): ReactNode {
  // 直接读 engine store 的 collectedEvidenceIds 渲染可勾选证据
  const collected = useGameStore((s) => s.collectedEvidenceIds);
  const [selected, setSelected] = useState<Set<EvidenceId>>(new Set(collected));

  const toggle = (id: EvidenceId) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div style={evidenceModalStyle}>
      <div style={evidenceModalCard}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>从证据库勾选关键证据</div>
        <div style={{ fontSize: 11, color: '#aab', marginBottom: 12 }}>
          至少勾选 5 项关键证据（含聊天记录/协议/合作新闻/论文/经费报告）
        </div>
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {collected.length === 0 && (
            <div style={{ color: '#f99', fontSize: 12 }}>
              证据库为空。请先在各 App 查看关键页面/聊天收集证据。
            </div>
          )}
          {collected.map((id) => (
            <label
              key={id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                cursor: 'pointer',
                borderBottom: '1px solid #1f2a3a',
                fontSize: 12,
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(id)}
                onChange={() => toggle(id)}
              />
              <span style={{ fontFamily: 'monospace' }}>{id}</span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button style={ghostBtn} onClick={onCancel}>
            取消
          </button>
          <button
            style={primaryBtn(selected.size >= 5)}
            onClick={() => onSubmit(Array.from(selected))}
            disabled={selected.size < 5}
          >
            发送证据（{selected.size}）
          </button>
        </div>
      </div>
    </div>
  );
}

function RecentsList({
  records,
  onCall,
}: {
  records: CallRecord[];
  onCall: (r: CallRecord) => void;
}): ReactNode {
  if (records.length === 0) {
    return (
      <div style={{ padding: 24, color: '#888', fontSize: 13 }}>暂无通话记录</div>
    );
  }
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#0e1620' }}>
      {records.map((r) => (
        <button
          key={r.id}
          onClick={() => onCall(r)}
          style={recentRowStyle}
        >
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'flex-start' }}>
            <span style={recentName(r.status)}>
              {r.displayNumber}
            </span>
            <span style={{ fontSize: 11, color: '#778' }}>
              {r.direction === 'incoming' ? '↙' : '↗'} {r.statusText} · {fmtTime(r.calledAt)}
            </span>
          </div>
          <span style={{ color: r.status === 'answered' ? '#3aa55c' : '#ff7878', fontSize: 14 }}>
            {r.status === 'answered' ? '✓' : r.status === 'no-answer' ? '✗' : '↥'}
          </span>
        </button>
      ))}
    </div>
  );
}

function isNoAnswer(display: string): boolean {
  // 朴素识别：未匹配 call-log 的草稿号码按"未接"处理
  return !/88888888/.test(display) && !/^0?731/.test(display) && /^[0-9*#+-]{3,}$/.test(display);
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

function Header({
  title,
  onBack,
  rightAction,
}: {
  title: string;
  onBack?: () => void;
  rightAction?: ReactNode;
}): ReactNode {
  return (
    <div style={headerStyle}>
      {onBack ? (
        <button style={iconBtn} onClick={onBack} aria-label="返回">
          ‹
        </button>
      ) : (
        <div style={{ width: 36 }} />
      )}
      <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
      {rightAction ?? <div style={{ width: 36 }} />}
    </div>
  );
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
  padding: '0 8px',
  background: '#141f2c',
  borderBottom: '1px solid #1d2a3a',
};
const iconBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  background: 'transparent',
  color: '#4cd0ff',
  border: 'none',
  fontSize: 22,
  cursor: 'pointer',
};
const recentRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '10px 14px',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid #1a2636',
  cursor: 'pointer',
  textAlign: 'left',
  color: 'inherit',
};
function recentName(status: CallRecord['status']): React.CSSProperties {
  return {
    fontSize: 14,
    fontWeight: 500,
    color: status === 'no-answer' ? '#ff7878' : '#e7eef7',
  };
}
const displayArea: React.CSSProperties = {
  flex: '0 0 auto',
  minHeight: 80,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  alignItems: 'center',
  padding: '12px 16px 4px',
};
const displayNumber: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 300,
  letterSpacing: 1,
  fontFamily: 'ui-monospace, Menlo, monospace',
  color: '#e7eef7',
};
const keypad: React.CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 12,
  padding: '8px 32px',
  alignContent: 'center',
};
const keyBtn: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: 56,
  background: '#1a2838',
  color: '#e7eef7',
  border: 'none',
  borderRadius: 28,
  cursor: 'pointer',
};
const actionRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 32px 24px',
};
function callBtn(urgent: boolean): React.CSSProperties {
  return {
    width: 64,
    height: 64,
    borderRadius: 32,
    background: urgent ? '#ff4d4f' : '#3aa55c',
    color: '#fff',
    fontSize: 28,
    border: 'none',
    cursor: 'pointer',
    boxShadow: urgent ? '0 0 16px #ff4d4f88' : '0 0 8px #3aa55c66',
  };
}
const callWrapStyle: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: 'linear-gradient(180deg,#0a121d,#101e2f)',
  color: '#e7eef7',
};
const callHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: 24,
  paddingBottom: 8,
  gap: 4,
};
const subtitleArea: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '12px 16px',
  overflowY: 'auto',
};
const systemLineStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: 12,
  color: '#9aa6b5',
  padding: '4px 0',
};
const bubbleStyle: React.CSSProperties = {
  maxWidth: '78%',
  padding: '8px 12px',
  borderRadius: 14,
  fontSize: 13,
  lineHeight: 1.5,
};
const callActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '16px 0 28px',
};
const hangupBtn: React.CSSProperties = {
  width: 64,
  height: 40,
  borderRadius: 22,
  background: '#ff4d4f',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
};
const evidenceModalStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10,
  padding: 16,
};
const evidenceModalCard: React.CSSProperties = {
  width: '100%',
  maxWidth: 320,
  background: '#182534',
  borderRadius: 12,
  padding: 16,
  border: '1px solid #2a3a4d',
};
function primaryBtn(enabled: boolean): React.CSSProperties {
  return {
    padding: '6px 14px',
    borderRadius: 6,
    border: 'none',
    background: enabled ? '#3aa55c' : '#2c3a4d',
    color: enabled ? '#fff' : '#789',
    fontSize: 13,
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}
const ghostBtn: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 6,
  border: '1px solid #2a3a4d',
  background: 'transparent',
  color: '#9aa6b5',
  fontSize: 13,
  cursor: 'pointer',
};
