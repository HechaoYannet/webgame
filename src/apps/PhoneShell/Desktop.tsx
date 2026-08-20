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
import { AppGlyph, hasAppIconImg, needsIconTile } from '@/ui/icons'
import { appColor, palette, radius, spacing } from '@/ui/theme'
import { EmptyState } from '@/ui/Primitives'
import { openSitePage } from '@/sites/sitePage'
// 玩家提供的手机壁纸（src/assets/phone/wallpaper.jpg）作为桌面背景。
import wallpaperUrl from '@/assets/phone/wallpaper.jpg?url'

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
        // 玩家提供的壁纸铺满桌面（cover 居中裁剪），壁纸之上叠一层暗色渐变保证
        // 图标文字可读。StatusBar 由 PhoneShell 注入 overlay，此处仍留 paddingTop。
        backgroundImage: `linear-gradient(180deg, rgba(10,10,15,0.35) 0%, rgba(10,10,15,0.55) 100%), url(${wallpaperUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: palette.bgDarkest,
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
          {/* 搜索（百度站入口）：伪浏览器 App 已删除，玩家靠此"一级站点"图标打开百度，
              在百度站搜关键词跳各官网。剧情大纲"搜索湖南绿草中学官网"由它承载。 */}
          <button
            type="button"
            onClick={() => openSitePage('page-baidu-search')}
            aria-label="打开百度搜索"
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
            {/* 百度品牌 SVG：512×512 自带白底蓝掌印，全填满图标块（圆角裁剪） */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.lg,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppGlyph id="baidu" size={56} fallbackLabel="百度" />
            </div>
            <span
              style={{
                fontSize: 11,
                color: palette.textPrimary,
                textAlign: 'center',
                textShadow: '0 1px 2px rgba(0,0,0,0.6)',
              }}
            >
              百度一下
            </span>
          </button>
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
  // 品牌图标是否自带不透明背景（wechat/qq/phone/sms/baidu 这类全彩 SVG）。
  // 自带背景 → full-bleed 铺满 56×56 图标块（仅圆角裁剪，不再套色 tile）。
  // 线条图标（doorbell 无背景）或非 IMG 图标 → 套色 tile + 居中小图标。
  const isFullBleed = hasAppIconImg(app.icon) && !needsIconTile(app.icon)
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
      {isFullBleed ? (
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.lg,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppGlyph id={app.icon} size={56} fallbackLabel={app.title} />
        </div>
      ) : (
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
      )}
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
  // 桌面底部 dock：与桌面图标同样的 full-bleed / tile 策略（dock 块 50×50）。
  const isFullBleed = hasAppIconImg(app.icon) && !needsIconTile(app.icon)
  if (isFullBleed) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={`打开 ${app.title}`}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          width: 50,
          height: 50,
          borderRadius: radius.lg,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppGlyph id={app.icon} size={50} fallbackLabel={app.title} />
      </button>
    )
  }
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
