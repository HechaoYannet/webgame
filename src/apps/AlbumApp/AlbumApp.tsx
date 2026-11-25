/**
 * src/apps/AlbumApp/AlbumApp.tsx — 相册（证据归档展示，非终局操作台）
 *
 * 去引擎化后的定位（2026-08-19 玩家决策 + 2026-08-23 流程梳理）：
 * - 证据收集 = 查看即归档（查看关键聊天/页面自动 collectEvidence，幂等），
 *   不再是"荣誉制勾选"；本 App 只读展示已收集证据。
 * - 终局判定唯一入口 = 举报电话（PhoneApp 拨打 0731-88888888，通话内勾选证据），
 *   本 App 不再提供"提交证据/启动倒计时"按钮——那会导致不调查直接通关、
 *   且与通话内勾选重复。倒计时改由"查看实验室经费申请报告页"触发。
 *
 * 数据用 data/loader 同步 getter（main.tsx 已 await loadGameData）。
 * 勾选/结局逻辑全部移除，本组件为纯展示。
 */
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useGameStore } from '@/game/gameStore'
import { getCollected } from '@/game/evidence'
import { getRequiredForFinale } from '@/game/evidence'
import type { Evidence } from '@/types'

export default function AlbumApp(): ReactNode {
  const collectedEvidenceIds = useGameStore((s) => s.collectedEvidenceIds)

  // loader 已在 main.tsx await 过，同步 getter 安全。
  const collected = useMemo<Evidence[]>(() => getCollected(), [collectedEvidenceIds])
  const requiredIds = useMemo(() => new Set(getRequiredForFinale()), [])

  const requiredCount = collected.filter((e) => requiredIds.has(e.id)).length

  return (
    <div style={wrapStyle}>
      <div style={headerStyle}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>证据</div>
        <div style={subHeaderStyle}>调查归档</div>
      </div>

      {collected.length === 0 ? (
        <div style={emptyStyle}>
          还没有归档任何内容。
          <br />
          <span style={{ color: "#566", fontSize: 12 }}>查看聊天记录、网页、论文时会自动归档到这里。</span>
        </div>
      ) : (
        <>
          <div style={hintRow}>
            已归档 {collected.length} 项 · 关键证据 {requiredCount}/{requiredIds.size}
          </div>
          <div style={gridStyle}>
            {collected.map((ev) => (
              <div key={ev.id} style={cardStyle(ev.isKey)}>
                <div style={thumbStyle(ev.isKey)}>{ev.isKey ? "★" : "·"}</div>
                <div style={titleStyle}>{ev.title}</div>
                <div style={descStyle}>{ev.description}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const wrapStyle: React.CSSProperties = {
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: "#0e1620",
  color: "#e7eef7",
  fontFamily: "system-ui, -apple-system, \"PingFang SC\", sans-serif",
  overflowY: "auto",
  paddingBottom: "var(--home-inset)",
}
const headerStyle: React.CSSProperties = {
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 12px",
  background: "#141f2c",
  borderBottom: "1px solid #1d2a3a",
  position: "sticky",
  top: 0,
  zIndex: 2,
}
const subHeaderStyle: React.CSSProperties = { fontSize: 12, color: "#9aa6b5" }
const emptyStyle: React.CSSProperties = {
  padding: 32,
  color: "#778",
  fontSize: 13,
  textAlign: "center",
  lineHeight: 1.8,
}
const hintRow: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  color: "#9aa6b5",
  background: "rgba(58,165,92,0.08)",
  borderBottom: "1px solid #1d2a3a",
}
const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 10,
  padding: 12,
}
function cardStyle(isKey: boolean): React.CSSProperties {
  return {
    background: "#16202e",
    border: `1px solid ${isKey ? "#3aa55c66" : "#1d2a3a"}`,
    borderRadius: 10,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  }
}
function thumbStyle(isKey: boolean): React.CSSProperties {
  return {
    height: 72,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 26,
    color: isKey ? "#ffd666" : "#5a6a7a",
    background: isKey ? "rgba(255,214,102,0.10)" : "rgba(255,255,255,0.04)",
  }
}
const titleStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  lineHeight: 1.4,
  color: "#e7eef7",
}
const descStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#9aa6b5",
  lineHeight: 1.6,
  maxHeight: 88,
  overflow: "hidden",
}
// （原 missingHintStyle：直接写给玩家「拨打 0731-88888888 举报」的通关指令，已移除）
