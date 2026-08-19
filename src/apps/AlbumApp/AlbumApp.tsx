/**
 * src/apps/AlbumApp/AlbumApp.tsx — 相册（含证据库视图，终章核心）
 *
 * - 相册：玩家查看过的关键页面自动截图入"证据"文件夹（engine ClueRegistry 调 ScreenshotService
 *   产出 screenshotAssetId；本 Agent 直接消费 engine store 的 collectedEvidenceIds）。
 * - 证据库视图（终章）：列出已收集证据（collectedEvidenceIds + evidence-registry.json），
 *   玩家勾选 ≥5 项关键证据 → 调 engine usePuzzle().submit({ selected }) →
 *   引擎 evidenceSet 校验（requiredEvidenceIds 5项, minLength 5）→ 通过则可拨举报电话（真结局）；
 *   不足普通结局。
 *
 * strict: 答案不硬编码——requiredEvidenceIds 全部从 puzzles.json puzzle-evidence-finale 读，
 * 本组件只做 UI 勾选与提交，校验由 engine PuzzleService 完成（submit 内部已执行 onSuccess）。
 *
 * 迁移说明：原 ../PhoneApp/runtime 已删除。证据/谜题/章节状态走 @/engine/hooks，
 * 反馈走 @/engine/feedback，App 切换走 @/engine/feedback/AppNavigationService。
 */

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  loadEvidence,
  loadPuzzles,
} from '../PhoneApp/data';
import { usePuzzle } from '@/engine/hooks/usePuzzle';
import { useGameStore } from '@/engine/store/gameStore';
import * as HapticsService from '@/engine/feedback/HapticsService';
import { toast as engineToast } from '@/engine/feedback/AlertService';
import { openApp } from '@/engine/feedback/AppNavigationService';
import type { Evidence, EvidenceId, Puzzle } from '@/types';

const FINALE_PUZZLE_ID = 'puzzle-evidence-finale';

type View = 'album' | 'vault';

export default function AlbumApp(): ReactNode {
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [view, setView] = useState<View>('album');

  const collectedEvidenceIds = useGameStore((s) => s.collectedEvidenceIds);
  const finaleSolved = useGameStore((s) => s.solvedPuzzleIds.includes(FINALE_PUZZLE_ID));
  const currentChapterId = useGameStore((s) => s.currentChapterId);

  useEffect(() => {
    let mounted = true;
    Promise.all([loadEvidence(), loadPuzzles()])
      .then(([evs, ps]) => {
        if (!mounted) return;
        setEvidences(evs);
        setPuzzles(ps);
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        setLoadErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      mounted = false;
    };
  }, []);

  const finalePuzzle = useMemo(
    () => puzzles.find((p) => p.id === FINALE_PUZZLE_ID),
    [puzzles],
  );

  const collectedEvidences = useMemo(
    () => evidences.filter((e) => collectedEvidenceIds.includes(e.id)),
    [evidences, collectedEvidenceIds],
  );

  if (loadErr) {
    return <div style={{ padding: 24, color: '#f88' }}>证据加载失败：{loadErr}</div>;
  }

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
      {view === 'vault' && (
        <VaultView
          evidences={collectedEvidences}
          finalePuzzle={finalePuzzle}
          finaleSolved={finaleSolved}
          inFinale={currentChapterId === 'ch-finale' || currentChapterId === 'ch-5'}
        />
      )}
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
  finalePuzzle: Puzzle | undefined;
  finaleSolved: boolean;
  inFinale: boolean;
}
function VaultView({ evidences, finalePuzzle, finaleSolved, inFinale }: VaultViewProps): ReactNode {
  const [selected, setSelected] = useState<Set<EvidenceId>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | { ok: boolean }>(null);
  // engine usePuzzle(puzzleId)：submit({ selected }) 走 PuzzleService（内部已执行 onSuccess）
  const { submit } = usePuzzle(FINALE_PUZZLE_ID);

  const requiredIds = useMemo<EvidenceId[]>(() => {
    if (finalePuzzle?.matchStrategy.kind === 'evidenceSet') {
      return finalePuzzle.matchStrategy.requiredEvidenceIds;
    }
    return [];
  }, [finalePuzzle]);
  const minLength = finalePuzzle?.matchStrategy.kind === 'evidenceSet'
    ? finalePuzzle.matchStrategy.minLength
    : 5;

  const toggle = (id: EvidenceId) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const requiredSelectedCount = useMemo(
    () => requiredIds.filter((id) => selected.has(id)).length,
    [selected, requiredIds],
  );

  const canSubmit = inFinale && collectedCount(evidences) >= minLength && selected.size >= minLength;
  function collectedCount(ev: Evidence[]): number {
    return ev.length;
  }

  const handleSubmit = () => {
    if (!finalePuzzle) return;
    setSubmitting(true);
    // engine submit({ selected })：内部已执行 onSuccess（advanceChapter ch-finale）
    const r = submit({ selected: Array.from(selected) });
    setResult({ ok: r.success });
    setSubmitting(false);
    HapticsService.vibrate(r.success ? 'long' : 'double');
    if (r.success) {
      engineToast('证据已提交，去电话 App 拨打 0731-88888888', 'success');
    } else {
      engineToast('证据不足，无法立案。继续收集关键证据。', 'warning');
    }
  };

  const goCallPolice = () => {
    // engine AppNavigationService：HashRouter 路由跳转（phone-shell 已 bindNavigate）
    openApp('phone');
  };

  if (!inFinale) {
    return (
      <div style={{ padding: 24, color: '#778', fontSize: 13, textAlign: 'center' }}>
        证据库将在第五章解锁——届时你需在此整理证据并拨打举报电话。
      </div>
    );
  }

  return (
    <div style={vaultWrapStyle}>
      <div style={hintRow}>
        勾选至少 {minLength} 项关键证据（含全部 {requiredIds.length} 项必选）才能立案举报
      </div>
      <div style={{ fontSize: 11, color: '#789', padding: '0 12px' }}>
        已选 {selected.size} / 已收集 {evidences.length} / 必选已勾 {requiredSelectedCount}/{requiredIds.length}
      </div>

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
                  {ev.id} · {ev.source.kind}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div style={actionBar}>
        {!finaleSolved ? (
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
