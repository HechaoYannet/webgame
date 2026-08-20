/**
 * src/apps/AlbumApp/AlbumApp.tsx — 相册（含证据库视图，终章核心）
 *
 * 迁移后（玩家决策 2026-08-19 去引擎化）：
 * - 证据收集改为荣誉制：相册列出全部证据，玩家自行勾选 toggleEvidence；
 *   不再有"查看即取证/注册线索"的自动机制（view 已是 no-op）。
 * - 证据库视图去章节门控：全时可见可勾选。
 * - 终章证据勾选提交：checkAnswer('puzzle-evidence-finale', { selected }) 判定，
 *   达标 -> markPuzzleSolved + pushEnding('good')；不达标 -> pushEnding('normal')。
 * - 勾选 ev-lab-funding-report 后显示"启动举报倒计时"按钮 ->
 *   startCountdown('countdown-finale', 180) + advanceChapter('ch-finale') +
 *   deliverSms('sms-zhangqiang-threat') + deliverDoorbell('doorbell-dao-visit')
 *   （后两者来自 utils/shellState，自动推通知/震屏/红边/音频）。
 * - 数据用 data/loader 同步 getter（main.tsx 已 await loadGameData）。
 * - 动力源全部来自 game/gameStore + game/answerCheck + utils/shellState；
 *   不再 import src/engine。
 */

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useGameStore } from '@/game/gameStore';
import { checkAnswer } from '@/game/answerCheck';
import { listAll, getRequiredForFinale } from '@/game/evidence';
import { getPuzzleById } from '@/data/loader';
import {
  showToast,
  deliverSms,
  deliverDoorbell,
} from '@/utils/shellState';
import type { Evidence, EvidenceId, EndingId } from '@/types';

const FINALE_PUZZLE_ID = 'puzzle-evidence-finale';
const FUNDING_REPORT_EVIDENCE_ID: EvidenceId = 'ev-lab-funding-report';
const COUNTDOWN_FINALE_ID = 'countdown-finale';
const SMS_THREAT_ID = 'sms-zhangqiang-threat';
const DOORBELL_DAO_ID = 'doorbell-dao-visit';

type View = 'album' | 'vault';

/** 轻量震屏反馈（取代已废 HapticsService）。 */
function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // 忽略：某些环境没有振动 API
  }
}

export default function AlbumApp(): ReactNode {
  const [view, setView] = useState<View>('album');

  const collectedEvidenceIds = useGameStore((s) => s.collectedEvidenceIds);

  // loader 已在 main.tsx await 过，同步 getter 安全。
  const allEvidences = useMemo<Evidence[]>(() => listAll(), []);

  const collectedEvidences = useMemo<Evidence[]>(
    () => {
      const collected = new Set(collectedEvidenceIds);
      return allEvidences.filter((e) => collected.has(e.id));
    },
    [allEvidences, collectedEvidenceIds],
  );

  return (
    <div style={wrapStyle}>
      <div style={headerStyle}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>相册</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            style={view === 'album' ? tabActive : tabIdle}
            onClick={() => setView('album')}
          >
            证据相册
          </button>
          <button
            style={view === 'vault' ? tabActive : tabIdle}
            onClick={() => setView('vault')}
          >
            证据库
          </button>
        </div>
      </div>

      {view === 'album' && <AlbumView evidences={collectedEvidences} />}
      {view === 'vault' && <VaultView evidences={allEvidences} />}
    </div>
  );
}

function AlbumView({ evidences }: { evidences: Evidence[] }): ReactNode {
  if (evidences.length === 0) {
    return (
      <div style={{ padding: 24, color: '#778', fontSize: 13, textAlign: 'center' }}>
        调查过程中收集到的证据会自动截图保存在此。
        <br />
        先去微信/QQ/浏览器查看关键内容吧。
      </div>
    );
  }
  return (
    <div style={gridStyle}>
      {evidences.map((ev) => (
        <div key={ev.id} style={thumbCard(ev.isKey)}>
          <div style={thumbPlaceholder(ev.isKey)}>{ev.isKey ? '★' : '·'}</div>
          <div style={thumbTitle}>{ev.title}</div>
        </div>
      ))}
    </div>
  );
}

interface VaultViewProps {
  evidences: Evidence[];
}
function VaultView({ evidences }: VaultViewProps): ReactNode {
  const navigate = useNavigate();
  const collectedEvidenceIds = useGameStore((s) => s.collectedEvidenceIds);
  const finaleSolved = useGameStore((s) => s.solvedPuzzleIds.includes(FINALE_PUZZLE_ID));
  const finished = useGameStore((s) => s.finished);
  const toggleEvidence = useGameStore((s) => s.toggleEvidence);
  const markPuzzleSolved = useGameStore((s) => s.markPuzzleSolved);
  const pushEnding = useGameStore((s) => s.pushEnding);
  const startCountdown = useGameStore((s) => s.startCountdown);
  const advanceChapter = useGameStore((s) => s.advanceChapter);

  const [selected, setSelected] = useState<Set<EvidenceId>>(new Set(collectedEvidenceIds));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | { ok: boolean }>(null);

  const finalePuzzle = useMemo(() => getPuzzleById(FINALE_PUZZLE_ID), []);

  const requiredIds = useMemo<EvidenceId[]>(
    () => (finalePuzzle?.matchStrategy.kind === 'evidenceSet'
      ? finalePuzzle.matchStrategy.requiredEvidenceIds
      : getRequiredForFinale()),
    [finalePuzzle],
  );
  const minLength = finalePuzzle?.matchStrategy.kind === 'evidenceSet'
    ? finalePuzzle.matchStrategy.minLength
    : 5;

  const toggle = (id: EvidenceId): void => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    // 荣誉制：勾选即写入 gameStore.collectedEvidenceIds（供 AlbumView/终章判定读）
    toggleEvidence(id);
  };

  const requiredSelectedCount = useMemo(
    () => requiredIds.filter((id) => selected.has(id)).length,
    [selected, requiredIds],
  );

  const canSubmit = collectedCount(evidences) >= minLength && selected.size >= minLength;
  function collectedCount(ev: Evidence[]): number {
    return ev.length;
  }

  const fundingReportChecked = selected.has(FUNDING_REPORT_EVIDENCE_ID);
  const countdownStarted = !!useGameStore((s) => s.countdowns?.[COUNTDOWN_FINALE_ID]);

  /** 启动举报倒计时：勾选经费报告后可见。触发倒计时 + 推进终章 + 推威胁短信 + 推刀哥门铃。 */
  const handleStartCountdown = (): void => {
    startCountdown(COUNTDOWN_FINALE_ID, 180);
    advanceChapter('ch-finale');
    deliverSms(SMS_THREAT_ID);
    deliverDoorbell(DOORBELL_DAO_ID);
    vibrate(30);
    showToast('举报倒计时已启动！威胁短信与门铃已到达', 'danger');
  };

  const handleSubmit = (): void => {
    setSubmitting(true);
    const ok = checkAnswer(FINALE_PUZZLE_ID, { selected: Array.from(selected) });
    setResult({ ok });
    setSubmitting(false);
    vibrate(ok ? 30 : [30, 40, 30]);
    if (ok) {
      markPuzzleSolved(FINALE_PUZZLE_ID);
      showToast('证据充分，已立案举报', 'success');
      // 达标 -> 真结局（拨打电话的分支由 PhoneApp 处理；此处直接落真结局）
      pushEnding('good' as EndingId);
    } else {
      showToast('证据不足，无法立案。继续收集关键证据。', 'warning');
      // 不达标 -> 普通结局
      pushEnding('normal' as EndingId);
    }
  };

  const goCallPolice = (): void => {
    navigate('/app/phone');
  };

  return (
    <div style={vaultWrapStyle}>
      <div style={hintRow}>
        勾选至少 {minLength} 项关键证据（含全部 {requiredIds.length} 项必选）才能立案举报
      </div>
      <div style={{ fontSize: 11, color: '#789', padding: '0 12px' }}>
        已选 {selected.size} / 可选 {evidences.length} / 必选已勾 {requiredSelectedCount}/{requiredIds.length}
      </div>

      {fundingReportChecked && !countdownStarted && !finished && (
        <div style={countdownCtaRow}>
          <button style={countdownCtaBtn} onClick={handleStartCountdown}>
            ⏱ 整理证据，启动举报倒计时（3 分钟）
          </button>
        </div>
      )}

      <div style={vaultListStyle}>
        {evidences.length === 0 && (
          <div style={{ padding: 24, color: '#f88', textAlign: 'center', fontSize: 13 }}>
            证据库为空。先去各 App 查看关键页面/聊天收集证据。
          </div>
        )}
        {evidences.map((ev) => {
          const isReq = requiredIds.includes(ev.id);
          const checked = selected.has(ev.id);
          return (
            <label key={ev.id} style={rowStyle(checked, isReq)}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(ev.id)}
                style={{ marginRight: 8 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', gap: 6, alignItems: 'center' }}>
                  {ev.title}
                  {ev.isKey && <span style={keyTag}>关键</span>}
                  {isReq && <span style={reqTag}>必选</span>}
                </div>
                <div style={{ fontSize: 11, color: '#9aa6b5', marginTop: 2, lineHeight: 1.4 }}>
                  {ev.description}
                </div>
                <div style={{ fontSize: 10, color: '#566', marginTop: 4, fontFamily: 'monospace' }}>
                  {ev.id}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div style={actionBar}>
        {!finaleSolved && !finished ? (
          <button
            style={primaryBtn(canSubmit && !submitting)}
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
          >
            {submitting ? '提交中…' : '提交证据（终章立案）'}
          </button>
        ) : result?.ok || finaleSolved ? (
          <>
            <div style={{ fontSize: 11, color: '#3aa55c' }}>
              证据已通过终章校验，可直接拨号举报
            </div>
            <button style={callBtn} onClick={goCallPolice}>
              ☎ 拨打 0731-88888888
            </button>
          </>
        ) : (
          <button style={primaryBtn(canSubmit && !submitting)} disabled={!canSubmit || submitting} onClick={handleSubmit}>
            {submitting ? '提交中…' : '重新提交证据'}
          </button>
        )}
      </div>
      {result && (
        <div style={{ fontSize: 11, color: '#9aa6b5', padding: '4px 12px 8px', textAlign: 'center' }}>
          {result.ok ? '✓ 证据充分，可拨打举报电话' : '× 证据不足或缺失关键项，需继续收集'}
        </div>
      )}
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
  padding: '0 10px',
  background: '#141f2c',
  borderBottom: '1px solid #1d2a3a',
};
const tabActive: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 12,
  background: '#2c5e8c',
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
const gridStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 10,
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 10,
  alignContent: 'start',
};
function thumbCard(isKey: boolean): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    background: '#141f2c',
    border: `1px solid ${isKey ? '#3a6e3a' : '#24374d'}`,
    borderRadius: 6,
    overflow: 'hidden',
  };
}
function thumbPlaceholder(isKey: boolean): React.CSSProperties {
  return {
    height: 90,
    background: isKey
      ? 'linear-gradient(135deg,#1a3320,#0e1620)'
      : 'linear-gradient(135deg,#1a2838,#0e1620)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    color: isKey ? '#3aa55c' : '#3a4a5e',
  };
}
const thumbTitle: React.CSSProperties = {
  fontSize: 11,
  padding: '4px 6px',
  color: '#cfd8e3',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const vaultWrapStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};
const hintRow: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  color: '#ff9a6a',
  background: '#2a1d12',
  borderBottom: '1px solid #4d3a1f',
};
const vaultListStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '6px 8px',
};
function rowStyle(checked: boolean, _isReq: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '8px 10px',
    margin: '4px 0',
    background: checked ? '#1a2e1f' : '#141f2c',
    border: `1px solid ${checked ? '#3a6e3a' : '#1d2a3a'}`,
    borderRadius: 6,
    cursor: 'pointer',
  };
}
const keyTag: React.CSSProperties = {
  fontSize: 9,
  padding: '1px 5px',
  borderRadius: 4,
  background: '#3a6e3a',
  color: '#fff',
  fontWeight: 600,
};
const reqTag: React.CSSProperties = {
  fontSize: 9,
  padding: '1px 5px',
  borderRadius: 4,
  background: '#8c4a2c',
  color: '#fff',
  fontWeight: 600,
};
const actionBar: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 10,
  alignItems: 'center',
  padding: '10px 12px',
  borderTop: '1px solid #1a2838',
  background: '#101a26',
};
function primaryBtn(enabled: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: enabled ? '#3aa55c' : '#2c3a4d',
    color: enabled ? '#fff' : '#789',
    fontSize: 13,
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}
const callBtn: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#ff4d4f',
  color: '#fff',
  fontSize: 13,
  cursor: 'pointer',
  fontWeight: 600,
};
const countdownCtaRow: React.CSSProperties = {
  padding: '8px 12px',
  display: 'flex',
  justifyContent: 'center',
};
const countdownCtaBtn: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: 'none',
  background: '#c0392b',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
