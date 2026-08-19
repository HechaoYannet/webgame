/**
 * src/apps/FilesApp/FilesApp.tsx — 文件管理
 *
 * - 下载的 PDF（论文 PDF、心理筛查名单 PDF）、截图、证据文件
 * - 论文 PDF 存在性是 puzzle-upload-paper 的前置（§6.5）：玩家在公众号上传时引擎检测论文
 *   PDF 是否已下载——本 App 提供"论文已就绪"标识供 WechatApp/引擎查询。
 * - 加密名单 PDF 需 puzzle-pdf-screening 密码 0312（本 App 提供 PDF 查看入口，解锁状态为
 *   本组件局部态；密码输入由 engine PuzzleService 校验，不硬编码，submit 内部已执行 onSuccess）
 *
 * 迁移说明：原 ../PhoneApp/runtime 已删除。谜题/证据状态走 @/engine/hooks +
 * @/engine/store/gameStore，反馈走 @/engine/feedback。
 * paperPdfDownloaded / screeningPdfUnlocked 为 UI 局部态（engine GameState 不含），保留 useState。
 */

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePuzzle } from '@/engine/hooks/usePuzzle';
import { useGameStore } from '@/engine/store/gameStore';
import * as HapticsService from '@/engine/feedback/HapticsService';
import { toast as engineToast } from '@/engine/feedback/AlertService';
import type { Evidence } from '@/types';
import { loadEvidence } from '../PhoneApp/data';

interface FileItem {
  id: string;
  name: string;
  kind: 'pdf' | 'image' | 'doc';
  size: string;
  /** 何时被收集/下载（描述性） */
  origin: string;
  /** 是否需要解密 */
  encrypted?: boolean;
  /** 解密的 puzzleId（PDF 密码） */
  unlockPuzzleId?: string;
  /** 是否为论文 PDF（puzzle-upload-paper 前置标识） */
  isPaperPdf?: boolean;
  /** 关联的证据 ID（若有） */
  evidenceId?: string;
  /** 是否需要先下载 */
  downloaded: boolean;
  downloadActionId?: string;
}

// 静态文件清单（CLAUDE.md §4：纯前端伪造，文件无真实后端）
const FILE_LIST: FileItem[] = [
  {
    id: 'file-paper-pdf',
    name: '源石结晶生物能源提取与人体内结晶生成机制研究.pdf',
    kind: 'pdf',
    size: '4.2 MB',
    origin: '山河医科大学实验室官网 · 论文栏目（预印本，2026-02-28 发布）',
    isPaperPdf: true,
    evidenceId: 'ev-paper-pdf',
    downloaded: false,
    downloadActionId: 'download-paper-pdf',
  },
  {
    id: 'file-screening-pdf',
    name: '学生心理筛查名单.pdf（加密）',
    kind: 'pdf',
    size: '188 KB',
    origin: '绿中内部系统 · 心理筛查通知附件（合同号 XH2026-0312）',
    encrypted: true,
    unlockPuzzleId: 'puzzle-pdf-screening',
    downloaded: false,
    downloadActionId: 'download-screening-pdf',
  },
  {
    id: 'file-evidence-screenshot-folder',
    name: '证据（截图）',
    kind: 'image',
    size: '—',
    origin: '查看关键页面时自动截图',
    downloaded: true,
  },
];

export default function FilesApp(): ReactNode {
  // 论文 PDF 下载态 / 筛查 PDF 解锁态：UI 局部态（engine GameState 不含这两个字段，
  // 它们是 puzzle-upload-paper 前置与 PDF 查看入口的纯 UI 标识，不属于游戏全局态）
  const [paperPdfDownloaded, setPaperPdfDownloaded] = useState(false);
  const [screeningPdfUnlocked, setScreeningPdfUnlocked] = useState(false);

  // 已收集证据来自 engine store（真值，由 engine ClueRegistry/EvidenceService 写入）
  const collectedEvidenceIds = useGameStore((s) => s.collectedEvidenceIds);

  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  // engine usePuzzle(puzzleId)：submit(pw) 走 PuzzleService（内部已执行 onSuccess registerClue）
  const { submit: submitScreening } = usePuzzle('puzzle-pdf-screening');

  useEffect(() => {
    let mounted = true;
    loadEvidence()
      .then((evs) => {
        if (mounted) setEvidences(evs);
      })
      .catch(() => {
        // 静默：组件容错显示空
      });
    return () => {
      mounted = false;
    };
  }, []);

  const files = useMemo<FileItem[]>(() => {
    return FILE_LIST.map((f) => {
      if (f.id === 'file-paper-pdf') {
        return { ...f, downloaded: paperPdfDownloaded };
      }
      if (f.id === 'file-screening-pdf') {
        return {
          ...f,
          downloaded: screeningPdfUnlocked || paperPdfDownloaded,
        };
      }
      return f;
    });
  }, [paperPdfDownloaded, screeningPdfUnlocked]);

  // 截图文件夹：来自 collectedEvidenceIds 中 collectionCondition 为 onScreenshot 的
  const screenshotEvidences = useMemo(
    () => evidences.filter((e) => collectedEvidenceIds.includes(e.id)),
    [evidences, collectedEvidenceIds],
  );

  const handleDownload = (f: FileItem) => {
    if (f.downloadActionId === 'download-paper-pdf') {
      setPaperPdfDownloaded(true);
      HapticsService.vibrate('short');
      engineToast('论文 PDF 已下载到文件管理', 'success');
      return;
    }
    if (f.downloadActionId === 'download-screening-pdf') {
      // 筛查名单 PDF：先下载占位，打开时仍需解密
      setScreeningPdfUnlocked(false);
      HapticsService.vibrate('short');
      engineToast('加密 PDF 已下载，需输入密码查看', 'info');
      setOpenId(f.id);
      return;
    }
  };

  return (
    <div style={wrapStyle}>
      <div style={headerStyle}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>文件管理</div>
      </div>

      <div style={listStyle}>
        {files.map((f) => {
          const isUnlocked = !f.encrypted || (f.id === 'file-screening-pdf' && screeningPdfUnlocked);
          return (
            <div key={f.id} style={rowStyle}>
              <div style={fileIcon(f.kind, f.encrypted, isUnlocked)}>{iconGlyph(f.kind)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={fileNameStyle(f.encrypted === true && !isUnlocked)}>
                  {f.name}
                  {f.encrypted && (
                    <span style={badge(isUnlocked)}>
                      {isUnlocked ? '已解密' : '加密'}
                    </span>
                  )}
                  {f.isPaperPdf && f.downloaded && (
                    <span style={okBadge}>论文已就绪</span>
                  )}
                </div>
                <div style={metaStyle}>{f.size} · {f.origin}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {!f.downloaded && f.downloadActionId && (
                  <button style={dlBtn} onClick={() => handleDownload(f)}>
                    下载
                  </button>
                )}
                {f.downloaded && (
                  <button
                    style={viewBtn(isUnlocked)}
                    onClick={() => setOpenId(f.id)}
                    disabled={f.encrypted === true && !isUnlocked && f.id !== 'file-screening-pdf'}
                  >
                    {f.id === 'file-evidence-screenshot-folder' ? '打开' : '查看'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {openId && (
        <FileViewer
          fileId={openId}
          onClose={() => setOpenId(null)}
          onUnlockWithPassword={(pw) => {
            // engine submit(pw)：内部已校验 + 执行 onSuccess（registerClue clue-screening-list）
            const r = submitScreening(pw);
            if (r.success) {
              setScreeningPdfUnlocked(true);
              engineToast('密码正确，已解锁名单 PDF', 'success');
              HapticsService.vibrate('long');
            } else {
              engineToast('密码错误', 'warning');
              HapticsService.vibrate('double');
            }
          }}
          screenshotEvidences={screenshotEvidences}
          screeningUnlocked={screeningPdfUnlocked}
        />
      )}
    </div>
  );
}

function FileViewer({
  fileId,
  onClose,
  onUnlockWithPassword,
  screenshotEvidences,
  screeningUnlocked,
}: {
  fileId: string;
  onClose: () => void;
  onUnlockWithPassword: (pw: string) => void;
  screenshotEvidences: Evidence[];
  screeningUnlocked: boolean;
}): ReactNode {
  const [pw, setPw] = useState('');
  const f = FILE_LIST.find((x) => x.id === fileId)!;

  return (
    <div style={modalStyle}>
      <div style={modalCard}>
        <div style={modalHeader}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{f.name}</span>
          <button style={closeBtn} onClick={onClose} aria-label="关闭">×</button>
        </div>

        {fileId === 'file-evidence-screenshot-folder' && (
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 12, color: '#9aa6b5', marginBottom: 8 }}>
              已收集证据的截图（共 {screenshotEvidences.length} 项）
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {screenshotEvidences.length === 0 && (
                <div style={{ color: '#778', fontSize: 12, gridColumn: 'span 3' }}>
                  暂无截图
                </div>
              )}
              {screenshotEvidences.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    aspectRatio: '1/1',
                    background: '#141f2c',
                    border: '1px solid #24374d',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    color: '#9aa6b5',
                    padding: 4,
                    textAlign: 'center',
                  }}
                >
                  {ev.title.slice(0, 6)}
                </div>
              ))}
            </div>
          </div>
        )}

        {fileId === 'file-paper-pdf' && (
          <div style={{ padding: 14, color: '#cfd8e3', fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              源石结晶生物能源提取与人体内结晶生成机制研究
            </div>
            <div style={{ fontSize: 11, color: '#9aa6b5', marginBottom: 8 }}>
              陈建国 等 · 基金号 2025YFC0123456 · 预印本 2026-02-28
            </div>
            <div>
              摘要：本研究探讨从生物体内源石结晶中提取能源的可行性与机制……
              实验对象为青少年志愿者（注：伦理审批栏为空）……
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: '#ffa940' }}>
              提示：在公众号"论文AI翻译解读"上传本 PDF 可获取完整 AI 解读，揭示实验室后台地址与密码线索。
            </div>
          </div>
        )}

        {fileId === 'file-screening-pdf' && (
          <div style={{ padding: 14 }}>
            {!screeningUnlocked ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, color: '#ffa940' }}>
                  加密 PDF — 输入合同号末4位密码查看名单
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="4 位数字密码"
                  style={pwInput}
                  maxLength={8}
                />
                <button
                  style={primaryBtn(pw.length >= 4)}
                  disabled={pw.length < 4}
                  onClick={() => onUnlockWithPassword(pw)}
                >
                  解密
                </button>
                <div style={{ fontSize: 10, color: '#566' }}>
                  线索：合同编号 XH2026-0312
                </div>
              </div>
            ) : (
              <div style={{ color: '#cfd8e3', fontSize: 13, lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>绿草中学 2026 春季心理筛查名单</div>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>姓名</th>
                      <th style={thStyle}>班级</th>
                      <th style={thStyle}>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td style={tdStyle}>李桥瑞</td><td style={tdStyle}>高二一班</td><td style={tdStyle}>3/13 入组</td></tr>
                    <tr><td style={tdStyle}>闫欣泽</td><td style={tdStyle}>高二一班</td><td style={tdStyle}>3/13 入组</td></tr>
                    <tr><td style={tdStyle}>……</td><td style={tdStyle}>……</td><td style={tdStyle}>……</td></tr>
                  </tbody>
                </table>
                <div style={{ marginTop: 8, fontSize: 11, color: '#3aa55c' }}>
                  名单与实验室受试者名单一致，构成证据闭环。
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function iconGlyph(kind: FileItem['kind']): string {
  if (kind === 'pdf') return '📄';
  if (kind === 'image') return '🖼';
  return '📄';
}

function fileIcon(kind: FileItem['kind'], encrypted: boolean | undefined, unlocked: boolean): React.CSSProperties {
  if (kind === 'pdf') {
    return {
      width: 36,
      height: 44,
      background: encrypted && !unlocked ? '#3a2a1a' : '#5a1d1d',
      borderRadius: 4,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 20,
      color: '#fff',
    };
  }
  return {
    width: 36,
    height: 36,
    background: '#1a2838',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
  };
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
const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 6,
};
const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: 10,
  margin: '4px 0',
  background: '#141f2c',
  border: '1px solid #1d2a3a',
  borderRadius: 8,
};
function fileNameStyle(dim: boolean): React.CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 500,
    color: dim ? '#778' : '#e7eef7',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  };
}
const metaStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#7a8',
  marginTop: 2,
};
function badge(unlocked: boolean): React.CSSProperties {
  return {
    fontSize: 9,
    padding: '1px 5px',
    borderRadius: 3,
    background: unlocked ? '#3a6e3a' : '#8c4a2c',
    color: '#fff',
    fontWeight: 600,
  };
}
const okBadge: React.CSSProperties = {
  fontSize: 9,
  padding: '1px 5px',
  borderRadius: 3,
  background: '#3a5e8c',
  color: '#fff',
  fontWeight: 600,
};
const dlBtn: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  border: 'none',
  background: '#2c5e8c',
  color: '#fff',
  fontSize: 12,
  cursor: 'pointer',
};
function viewBtn(enabled: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #24374d',
    background: enabled ? '#1a2838' : '#10141c',
    color: enabled ? '#cfd8e3' : '#455',
    fontSize: 12,
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}
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
const pwInput: React.CSSProperties = {
  padding: '8px 10px',
  background: '#0e1620',
  border: '1px solid #24374d',
  borderRadius: 6,
  color: '#fff',
  fontSize: 16,
  letterSpacing: 4,
  fontFamily: 'ui-monospace, monospace',
};
function primaryBtn(enabled: boolean): React.CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 6,
    border: 'none',
    background: enabled ? '#3aa55c' : '#2c3a4d',
    color: enabled ? '#fff' : '#789',
    fontSize: 13,
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}
const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '4px 6px',
  borderBottom: '1px solid #2a3a4d',
  fontSize: 11,
  color: '#9aa6b5',
};
const tdStyle: React.CSSProperties = {
  padding: '4px 6px',
  borderBottom: '1px solid #1d2a3a',
  fontSize: 12,
};
