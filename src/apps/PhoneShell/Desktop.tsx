/**
 * src/apps/PhoneShell/Desktop.tsx
 *
 * 手机桌面（交互设计 §二）：图标网格，读 AppRegistry 渲染所有可用 App 图标。
 * 点击图标 navigate 到 /app/:appId。
 * 壁纸 + 顶部留出 StatusBar 高度的 padding（StatusBar 由 PhoneShell 注入 overlay）。
 */
import { useNavigate } from 'react-router'
import type { CSSProperties } from 'react'
import { useVisibleApps, type AppEntry } from '@/apps/PhoneShell/AppRegistry'
import { AppGlyph } from '@/ui/icons'
import { appColor, palette, radius, spacing } from '@/ui/theme'
import { EmptyState } from '@/ui/Primitives'

export function Desktop() {
  const visible = useVisibleApps()
  const navigate = useNavigate()

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'auto',
        background: `radial-gradient(120% 80% at 50% 0%, ${palette.bgScreen} 0%, ${palette.bgDarkest} 100%)`,
        paddingTop: 56, // 给 StatusBar 让位
        paddingBottom: spacing.xl,
      }}
    >
      {visible.length === 0 ? (
        <EmptyState
          icon="settings"
          title="桌面暂无可用应用"
          hint="应用将随剧情推进解锁。请从微信开始调查。"
        />
      ) : (
        <div style={gridStyle}>
          {visible.map((app) => (
            <DesktopIcon key={app.appId} app={app} onOpen={() => navigate(`/app/${app.appId}`)} />
          ))}
        </div>
      )}

      {/* 桌面底部 dock（常用：电话/短信/浏览器），仅当已解锁时显示 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: `${spacing.sm}px ${spacing.md}px ${spacing.md}px`,
          background: 'rgba(10,10,15,0.62)',
          backdropFilter: 'blur(14px)',
          borderTop: `1px solid ${palette.border}`,
          display: 'flex',
          justifyContent: 'center',
          gap: spacing.lg,
        }}
      >
        {visible
          .filter((a) => ['phone', 'sms', 'browser', 'wechat'].includes(a.appId))
          .slice(0, 4)
          .map((app) => (
            <DockIcon key={app.appId} app={app} onOpen={() => navigate(`/app/${app.appId}`)} />
          ))}
      </div>
    </div>
  )
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: `${spacing.md}px ${spacing.sm}px`,
  padding: `${spacing.lg}px ${spacing.md}px`,
  maxWidth: 320,
  margin: '0 auto',
}

function DesktopIcon({ app, onOpen }: { app: AppEntry; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`打开 ${app.title}`}
      style={{
        background: 'none',
        border: 'none',
        padding: `${spacing.sm}px 2px`,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        color: palette.textPrimary,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: radius.lg,
          background: appColor(app.appId) + '22',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 2px 8px ${appColor(app.appId)}22`,
        }}
      >
        <AppGlyph id={app.icon} size={40} color={appColor(app.appId)} fallbackLabel={app.title} />
      </div>
      <span
        style={{
          fontSize: 11,
          color: palette.textPrimary,
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 72,
          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        }}
      >
        {app.title}
      </span>
    </button>
  )
}

function DockIcon({ app, onOpen }: { app: AppEntry; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`打开 ${app.title}`}
      style={{
        background: 'rgba(255,255,255,0.08)',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        width: 50,
        height: 50,
        borderRadius: radius.lg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppGlyph id={app.icon} size={34} color={appColor(app.appId)} fallbackLabel={app.title} />
    </button>
  )
}
