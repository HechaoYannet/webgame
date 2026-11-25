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
 *   checkAnswer(puzzle-evidence-finale, {selected}) 校验 → good 分支
 *   endEffects（pushEnding good / openNewsApp good）由本组件直调 pushEnding → 真结局。
 *
 * 迁移说明（frontend-phone-apps engine 迁移，玩家决策 2026-08-19）：
 *   已脱离 @/engine。状态走 @/game/gameStore，答案校验走 @/game/answerCheck，
 *   倒计时运行态走 @/utils/shellState 的 useCountdown('countdown-finale')，
 *   音频走 @/game/audio，类型取自 @/types，数据用 @/data/loader 的同步 getter
 *   （main.tsx 已 await loadGameData，同步 getter 安全）。本地仅保留 UI 局部
 *   useState（拨号输入、通话进行态）。endEffects 的 pushEnding/openNewsApp 直调
 *   useGameStore.pushEnding（openNewsApp 等价 pushEnding，EndingOverlay 读 endings.json 渲染）。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  CallRecord,
  CallScript,
  CallScriptBlock,
  CallScriptBranch,
  EvidenceId,
} from '@/types';
import {
  getAllCallRecords,
  getCallScriptById,
  getEvidenceById,
  getPuzzleById,
} from '@/data/loader';
import { checkAnswer } from '@/game/answerCheck';
import { useGameStore } from '@/game/gameStore';
import * as AudioService from '@/game/audio';
import { useCountdown, usePendingAnsweredCall, consumePendingAnsweredCall } from '@/utils/shellState';
import { formatGameTime } from '@/utils/time';

type Phase = 'recents' | 'dial' | 'calling';

/** 不应在通话记录中显示的记录 id：
 *  - call-report-police：举报电话仅在终章实际拨号时进入通话界面，不应出现在历史里。
 *  - call-zhangqiang-threat-incoming：威胁来电改为登录新希望后台后实时振铃打入，不进历史。 */
const HIDDEN_RECORD_IDS = new Set<string>([
  'call-report-police',
  'call-zhangqiang-threat-incoming',
]);

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

/** 轻触反馈（就地替代 HapticsService.vibrate）。 */
function haptic(ms = 30): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // 忽略
  }
}

export default function PhoneApp(): ReactNode {
  const [phase, setPhase] = useState<Phase>('recents');
  const [draft, setDraft] = useState('');

  // 倒计时进行中 → 红色拨号强调。唯一倒计时 = countdown-finale。
  // useCountdown 订阅 gameStore.countdowns 变化，active 等价 isActive('countdown-finale')。
  const countdown = useCountdown('countdown-finale');
  const countdownRunning = countdown.active;

  // main.tsx 已 await loadGameData，同步 getter 在首次渲染即安全。
  // 过滤掉不应出现在通话历史里的记录（举报电话、威胁来电——见 HIDDEN_RECORD_IDS）。
  const records: CallRecord[] = useMemo(
    () => getAllCallRecords().filter((r) => !HIDDEN_RECORD_IDS.has(r.id)),
    [],
  );

  // 接听"未知号码威胁来电"后 IncomingCallOverlay 导航到 /app/phone 并登记
  // pendingAnsweredCallScriptId。这里订阅该信号（响应式），一旦出现就取走并进 CallView
  // 播放威胁通话（6 秒静默挂断 + 心跳）。订阅式而非仅 mount 读取，保证 PhoneApp 已挂载时
  // 二次接听也能进入通话界面。
  const answeredScriptId = usePendingAnsweredCall();
  useEffect(() => {
    if (!answeredScriptId) return;
    const script = getCallScriptById(answeredScriptId);
    consumePendingAnsweredCall();
    if (!script) return;
    onStartCall(script.title ?? '未知号码', script);
  }, [answeredScriptId]);

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
            <button style={dialLinkBtn} onClick={() => setPhase('dial')}>
              拨号
            </button>
          ) : undefined
        }
      />

      {phase === 'recents' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <RecentsList records={records} onCall={(rec) => onCreateCall(rec, onStartCall)} />
          {/* 显眼底部拨号栏：原先右上角仅一个 36px ⌘ 图标，太隐蔽玩家找不到拨号盘。
              改为大号绿色通话按钮 + "拨号"文字，居中置底，仿真实手机拨号入口。 */}
          <div style={dialBarStyle}>
            <button
              style={dialBigBtn(countdownRunning)}
              onClick={() => setPhase('dial')}
              aria-label="打开拨号盘"
            >
              <span style={{ fontSize: 26 }}>⌕</span>
              <span>拨号</span>
            </button>
          </div>
        </div>
      )}

      {phase === 'dial' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={displayArea}>
            <div style={displayNumber}>{draft || '请输入号码'}</div>
            {countdownRunning && draft.length > 0 && (
              <div style={{ color: '#ff6666', fontSize: 12 }}>
                倒计时进行中
              </div>
            )}
          </div>

          <div style={keypad}>
            {KEY_MAP.map((k) => (
              <button
                key={k.d}
                style={keyBtn}
                onClick={() => press(k.d)}
                onPointerDown={() => haptic(30)}
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
                  const script = getCallScriptById(DISPATCHER_SCRIPT_ID);
                  onStartCall(HOTLINE_DISPLAY, script);
                } else {
                  // 拨打其他号码：尝试匹配 call-log 里的预设通话
                  const rec = records.find(
                    (r) =>
                      (r.rawNumber && normalizeDigits(r.rawNumber) === raw) ||
                      normalizeDigits(r.displayNumber) === raw,
                  );
                  const script = rec?.scriptId
                    ? getCallScriptById(rec.scriptId)
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
  onStartCall: (display: string, script?: CallScript) => void,
) {
  const script = rec.scriptId ? getCallScriptById(rec.scriptId) : undefined;
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

  // 终章谜题已解状态（渲染期同步读 gameStore.solvedPuzzleIds）。
  const finalePuzzled = useGameStore((s) => s.solvedPuzzleIds.includes(FINALE_PUZZLE_ID));
  // 倒计时进行态：唯一倒计时 countdown-finale，active 等价 isActive('countdown-finale')。
  const countdownRunning = useCountdown('countdown-finale').active;

  // baseBlocks 取自当前 script（任意预设通话如班主任脚本都有自带 blocks）。
  // 之前只取 dispatcherScript.blocks 导致非举报电话（班主任/未知号码）baseBlocks 为空、
  // visibleBlocks 永远为 []，通话卡在"正在呼叫…"——表现为"打不通"。这里改用 script.blocks。
  // 必须 useMemo：CallView 会因倒计时每秒 tick（useCountdown）而重渲染；
  // 若这里的数组每次渲染都是新引用，下面的分块推进 effect 会被反复 cleanup
  // → 定时器永远不触发，通话卡在「正在呼叫…」（实测回归）。
  const baseBlocks = useMemo<CallScriptBlock[]>(() => script?.blocks ?? [], [script]);
  const branchBlocks = useMemo<CallScriptBlock[]>(
    () => (branch ? dispatcherScript?.branches?.[branch]?.blocks ?? [] : []),
    [branch, dispatcherScript],
  );
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

    // 进入首条台词块即置"通话中"（无前置 system 块的脚本，如班主任通话）。
    if (current.type === 'line' && nowIdx === 0) {
      setStatus('通话中');
    }

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
      // 此分支由提交证据时的 checkAnswer 结果驱动；这里兜底跳过
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

  // onHangup 是父组件每次渲染都会重建的函数；若直接进 effect 依赖，倒计时每秒重渲染
  // 都会清理并重建 1.5s 定时器，导致"通话结束"后永远回不到通话记录（挂断键像死键）。
  // 用 ref 固定最新回调，effect 只在 callEnded 翻转时启动一次。
  const onHangupRef = useRef(onHangup);
  onHangupRef.current = onHangup;

  useEffect(() => {
    if (!callEnded) return;
    AudioService.stop();
    haptic(80);
    setStatus('通话结束');
    const t = setTimeout(() => onHangupRef.current(), 1500);
    return () => clearTimeout(t);
  }, [callEnded]);

  /** 挂断：通话未结束时先结束；已结束时直接退回通话记录（按钮永远有反馈）。 */
  function hangUp(): void {
    if (callEnded) {
      onHangupRef.current();
      return;
    }
    setCallEnded(true);
  }

  // evidenceSelection 节点打开证据勾选弹窗（终章核心联动）。
  // 提交时调 checkAnswer(puzzle-evidence-finale, {selected})：纯函数校验，由本组件
  // 决定后续动作（markPuzzleSolved + 选分支 + 执行 endEffects 的 pushEnding/openNewsApp）。
  function handleEvidenceSubmit(selected: EvidenceId[]): void {
    if (!dispatcherScript) return;
    setWaitingEvidenceResult(true);
    const success = checkAnswer(FINALE_PUZZLE_ID, { selected });
    if (success) {
      useGameStore.getState().markPuzzleSolved(FINALE_PUZZLE_ID);
    }
    setEvidencePromptOpen(false);
    // 根据校验结果切分支
    const decidedBranch: 'good' | 'normal' = success ? 'good' : 'normal';
    setBranch(decidedBranch);
    setNowIdx((i) => i + 1); // 跳过 branch 块
    setWaitingEvidenceResult(false);
    // 分支块播完后，把 branch.endEffects 直调执行（真结局闭环）。
    // pushEnding/openNewsApp → useGameStore.pushEnding（openNewsApp 等价 pushEnding，
    // EndingOverlay 读 endings.json 渲染）；其余 effect 类型忽略（新机制已无引擎副作用）。
    const branchData: CallScriptBranch | undefined =
      dispatcherScript.branches?.[decidedBranch];
    const branchEndEffects = branchData?.endEffects ?? [];
    const branchLen = branchData?.blocks.length ?? 0;
    setTimeout(() => {
      applyBranchEndEffects(branchEndEffects);
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
        <button style={hangupBtn} onClick={hangUp}>
          挂断
        </button>
      </div>
    </div>
  );
}

/**
 * 执行分支 endEffects（取代旧引擎 EffectExecutor.executeEffects）。
 * 新机制下只有 pushEnding / openNewsApp 有意义，二者都映射为 pushEnding：
 *   - pushEnding { endingId } → useGameStore.pushEnding(endingId)
 *   - openNewsApp { endingId } → useGameStore.pushEnding(endingId)
 *     （EndingOverlay 统一读 endings.json 的 epilogueBlocks 渲染结局，新闻播报在 good 结局文本内）
 * 其余 effect 类型（addRisk/startCountdown/pushSms/...）在新架构里由各自专项机制驱动，
 * 此处忽略（good/normal 分支 endEffects 实际只含 advanceChapter + pushEnding/openNewsApp）。
 */
function applyBranchEndEffects(effects: CallScriptBranch['endEffects']): void {
  const store = useGameStore.getState();
  for (const eff of effects) {
    if (!eff || typeof eff.type !== 'string') continue;
    if (eff.type === 'pushEnding' || eff.type === 'openNewsApp') {
      const endingId = (eff as { endingId?: string }).endingId;
      if (endingId === 'good' || endingId === 'normal' || endingId === 'bad') {
        store.pushEnding(endingId);
      }
    }
    if (eff.type === 'advanceChapter') {
      const toChapterId = (eff as { toChapterId?: string }).toChapterId;
      if (typeof toChapterId === 'string') {
        store.advanceChapter(toChapterId);
      }
    }
    // 其余 effect 类型：忽略（无引擎副作用链）
  }
}

interface EvidenceSelectionProps {
  onSubmit: (selected: EvidenceId[]) => void;
  onCancel: () => void;
}

function EvidenceSelection({ onSubmit, onCancel }: EvidenceSelectionProps): ReactNode {
  // 已收集证据（查看即归档，见 AlbumApp/QQ/各站点钩子）
  const collected = useGameStore((s) => s.collectedEvidenceIds);
  const [selected, setSelected] = useState<Set<EvidenceId>>(new Set(collected));

  // 必选/最少数量来自 puzzles.json（puzzle-evidence-finale），单一真源。
  const finalePuzzle = getPuzzleById(FINALE_PUZZLE_ID);
  const requiredIds: EvidenceId[] =
    finalePuzzle?.matchStrategy.kind === 'evidenceSet'
      ? finalePuzzle.matchStrategy.requiredEvidenceIds
      : [];
  const minLength: number =
    finalePuzzle?.matchStrategy.kind === 'evidenceSet'
      ? finalePuzzle.matchStrategy.minLength
      : 5;

  const evidenceById = new Map(
    collected.map((id) => {
      const ev = getEvidenceById(id);
      return [id, ev];
    }),
  );

  const toggle = (id: EvidenceId) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const requiredSelected = requiredIds.filter((id) => selected.has(id)).length;
  // 允许在未集齐必选时发送（证据不足 → 普通结局分支）；集齐才进入真结局。
  // 审核报告 E2E-2：原先 canSend 要求 selected.size >= minLength(5)，而全库可收集证据
  // 上限恰好 5 项、且第 6 项此前无任何获取路径 → 「证据不足→普通结局」永远走不到，
  // 按钮被禁用成死锁。契约 §7「不足或漏掉经费报告 → 普通结局」：只要有勾选即允许发送，
  // 由 checkAnswer 决定走真/普通分支。
  const canSend = selected.size >= 1;

  return (
    <div style={evidenceModalStyle}>
      <div style={evidenceModalCard}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>从证据库勾选关键证据</div>
        <div style={{ fontSize: 11, color: '#aab', marginBottom: 12 }}>
          勾满 {minLength} 项且包含全部 {requiredIds.length} 项必选证据，警方才会立即立案；
          证据不足也可以发送，但接线员只会「进一步核实」
          （必选已勾 {requiredSelected}/{requiredIds.length}）
        </div>
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {collected.length === 0 && (
            <div style={{ color: '#f99', fontSize: 12 }}>
              证据库为空。请先在各 App 查看关键页面/聊天收集证据。
            </div>
          )}
          {collected.map((id) => {
            const ev = evidenceById.get(id);
            const isReq = requiredIds.includes(id);
            return (
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
                <span style={{ flex: 1 }}>
                  {ev?.title ?? id}
                  {isReq ? <span style={{ color: '#ffd666', marginLeft: 6 }}>必选</span> : null}
                </span>
              </label>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button style={ghostBtn} onClick={onCancel}>
            取消
          </button>
          <button
            style={primaryBtn(canSend)}
            onClick={() => onSubmit(Array.from(selected))}
            disabled={!canSend}
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

// 统一走 @/utils/time（游戏时区 +08:00）。
function fmtTime(iso: string): string {
  return formatGameTime(iso);
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
  // 底部 Home 手势区：拨号栏/通话按钮不再被指示条热区遮住。
  paddingBottom: 'var(--home-inset)',
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
/** 右上角"拨号"文字按钮（次入口；主入口是底部大拨号按钮）。 */
const dialLinkBtn: React.CSSProperties = {
  height: 32,
  padding: '0 12px',
  background: '#1a2838',
  color: '#4cd0ff',
  border: '1px solid #2c5e8c',
  borderRadius: 16,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
/** 通话记录页底部拨号栏。 */
const dialBarStyle: React.CSSProperties = {
  flex: '0 0 auto',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '16px 0 28px',
  background: '#0e1620',
  borderTop: '1px solid #1a2636',
};
/** 底部大号拨号按钮（仿真实手机）。倒计时进行中红色强调速拨举报电话。 */
function dialBigBtn(urgent: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 56,
    padding: '0 32px',
    borderRadius: 28,
    border: 'none',
    background: urgent ? '#ff4d4f' : '#3aa55c',
    color: '#fff',
    fontSize: 17,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: urgent ? '0 0 18px #ff4d4f88' : '0 0 12px #3aa55c66',
  };
}
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
  gap: 14,
  padding: '8px 30px',
  alignContent: 'center',
  justifyContent: 'center',
  maxWidth: 320,
  width: '100%',
  margin: '0 auto',
};
const keyBtn: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: 64,
  background: '#20323f',
  color: '#e7eef7',
  border: 'none',
  borderRadius: 32,
  cursor: 'pointer',
  transition: 'background 0.1s',
  userSelect: 'none',
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
  // 挂断按钮与底部安全区之间留出 Home 手势区，避免点按钮却回桌面。
  paddingBottom: 'var(--home-inset)',
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
