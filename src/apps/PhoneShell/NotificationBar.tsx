/**
 * src/apps/PhoneShell/NotificationBar.tsx
 *
 * 系统通知中心（交互设计 §一映射表、§三.3）：短信推送 / 门铃推送 /
 * 全屏警告（AlertService）/ 通话来电。
 *
 * 通知队列来自 shellState.useNotifications（shell 自管，engine pushSms/pushDoorbell
 * 经 shellState.pushNotification 桥接）。全屏警告用 useFullscreenAlert 渲染覆盖层。
 * 通话来电用 useIncomingCall 锁屏振铃覆盖。
 *
 * 顶部下拉式通知抽屉：未展开时显示最近 1-2 条横幅；展开显示列表。
 */
import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  useNotifications,
  useFullscreenAlert,
  useIncomingCall,
  dismissNotification,
  clearNotifications,
  hideFullscreenAlert,
  setIncomingCall,
} from '@/utils/shellState'
import { appColor, alertStyleColor, palette, radius, spacing } from '@/ui/theme'
import { AppGlyph, Glyph } from '@/ui/icons'
import { Button } from '@/ui/Primitives'
import { formatShortDateTime } from '@/utils/time'
import { openSitePage } from '@/sites/sitePage'

export function NotificationBar() {
  const notifications = useNotifications()
  const fullscreen = useFullscreenAlert()
  const incomingCall = useIncomingCall()
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()

  // 通话来电覆盖在最上层
  if (incomingCall?.active) {
    return <IncomingCallOverlay />
  }
  // 全屏警告覆盖次上层
  if (fullscreen.visible) {
    return <FullscreenAlertOverlay />
  }

  if (notifications.length === 0) return null

  const handleOpen = (n: (typeof notifications)[number]) => {
    if (n.pageId) {
      // 调查网页通知 → 新标签打开全屏站点路由（BrowserApp 已移除）
      openSitePage(n.pageId)
    } else if (n.appId) {
      navigate(`/app/${n.appId}`)
    } else if (n.threadId) {
      navigate(`/app/sms`)
    }
    dismissNotification(n.id)
    setExpanded(false)
  }

  const recent = expanded ? notifications : notifications.slice(-2)

  return (
    <div
      style={{
        position: 'absolute',
        top: 44,
        left: 0,
        right: 0,
        zIndex: 28,
        padding: `${spacing.xs}px ${spacing.sm}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.xs,
        pointerEvents: 'none',
      }}
    >
      {recent.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => handleOpen(n)}
          onPointerDown={(e) => {
            // 下拉手势：双指/长按展开（这里简化为点击展开按钮）
            void e
          }}
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            padding: `${spacing.sm}px ${spacing.md}px`,
            background: 'rgba(28,28,38,0.92)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${alertStyleColor[n.style] ?? palette.border}66`,
            borderLeft: `3px solid ${alertStyleColor[n.style] ?? palette.accent}`,
            borderRadius: radius.md,
            color: palette.textPrimary,
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
            boxSizing: 'border-box',
            animation: 'ui-slide-down 0.25s ease-out',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.md,
              background: (appColor(n.appId ?? 'sms')) + '33',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AppGlyph id={n.appIcon ?? n.appId ?? 'sms'} size={20} color={appColor(n.appId ?? 'sms')} fallbackLabel={n.appId ?? '通知'} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.sm }}>
              <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {n.title}
              </span>
              <span style={{ fontSize: 10, color: palette.textTertiary, flexShrink: 0 }}>
                {formatShortDateTime(new Date(n.createdAt).toISOString())}
              </span>
            </div>
            <div style={{ fontSize: 12, color: palette.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
              {n.body}
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭通知"
            onClick={(e) => {
              e.stopPropagation()
              dismissNotification(n.id)
            }}
            style={{ background: 'none', border: 'none', color: palette.textTertiary, cursor: 'pointer', padding: 4, flexShrink: 0, display: 'flex' }}
          >
            <Glyph name="close" size={14} color={palette.textTertiary} />
          </button>
        </button>
      ))}

      {!expanded && notifications.length > 2 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            pointerEvents: 'auto',
            alignSelf: 'center',
            background: 'rgba(28,28,38,0.9)',
            border: `1px solid ${palette.border}`,
            borderRadius: radius.pill,
            color: palette.textSecondary,
            padding: '3px 12px',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          还有 {notifications.length - 2} 条通知 ▾
        </button>
      ) : null}

      {expanded ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: `0 ${spacing.xs}px`, pointerEvents: 'auto' }}>
          <Button variant="ghost" size="sm" iconLeft="close" onClick={clearNotifications}>
            全部清除
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function FullscreenAlertOverlay() {
  const alert = useFullscreenAlert()
  if (!alert.visible) return null
  const color = alertStyleColor[alert.style] ?? palette.danger
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="全屏警告"
      className="ui-flash"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        background: `radial-gradient(circle at 50% 50%, ${color}22 0%, rgba(0,0,0,0.86) 70%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        animation: 'ui-flash 0.5s ease-out',
      }}
    >
      <div
        style={{
          background: 'rgba(0,0,0,0.7)',
          border: `2px solid ${color}`,
          borderRadius: radius.lg,
          padding: spacing.xl,
          maxWidth: 320,
          textAlign: 'center',
          color: palette.textPrimary,
          boxShadow: `0 0 40px ${color}66`,
        }}
      >
        <div style={{ fontSize: 40, color, marginBottom: spacing.md, animation: 'ui-pulse 1s infinite' }}>
          <Glyph name="settings" size={48} color={color} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: spacing.sm, color }}>
          {alert.style === 'danger' ? '危险' : alert.style === 'warning' ? '警告' : alert.style === 'success' ? '成功' : '提示'}
        </div>
        <div style={{ fontSize: 14, color: palette.textSecondary, lineHeight: 1.6, marginBottom: spacing.lg }}>
          {alert.text}
        </div>
        <Button variant="danger" block onClick={hideFullscreenAlert}>
          知道了
        </Button>
      </div>
    </div>
  )
}

function IncomingCallOverlay() {
  const call = useIncomingCall()
  if (!call?.active) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="来电"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 62,
        background: 'linear-gradient(180deg, #1a3a2a 0%, #0a1a14 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${spacing.xl * 2}px ${spacing.xl}`,
        color: palette.textPrimary,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: palette.textSecondary, marginBottom: spacing.sm }}>来电</div>
        <div style={{ fontSize: 24, fontWeight: 700 }}>{call.callerName ?? '未知号码'}</div>
        <div style={{ fontSize: 12, color: palette.textTertiary, marginTop: spacing.xs }}>{call.callerId ?? ''}</div>
      </div>
      <div
        className="ui-call-pulse"
        style={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'ui-call-pulse 1.5s infinite',
        }}
      >
        <AppGlyph id="phone" size={44} color="#fff" />
      </div>
      <div style={{ display: 'flex', gap: spacing.xl * 2, alignItems: 'center' }}>
        <button
          type="button"
          aria-label="拒接"
          onClick={() => setIncomingCall(null)}
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: palette.danger,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: 'rotate(135deg)',
          }}
        >
          <AppGlyph id="phone" size={28} color="#fff" />
        </button>
        <button
          type="button"
          aria-label="接听"
          onClick={() => setIncomingCall(null)}
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: palette.success,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppGlyph id="phone" size={28} color="#fff" />
        </button>
      </div>
    </div>
  )
}
