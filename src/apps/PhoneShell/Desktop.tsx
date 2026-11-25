/**
 * src/apps/PhoneShell/Desktop.tsx
 *
 * 手机桌面（交互设计 §二）：图标网格，读 AppRegistry 渲染所有可用 App 图标。
 * 点击图标 navigate 到 /app/:appId。
 *
 * 2026-11 改版：
 *  - 顶部加一块 iOS 风格的大时钟（游戏内时间，与状态栏同源）；
 *  - 图标统一 58px 圆角块 + 一致的投影/描边，hover 有轻微上浮；
 *  - dock 改成悬浮玻璃条，下方加页码点；
 *  - 壁纸压暗 + 冷调 + 暗角，让白色标签在任何照片上都读得清。
 */
import { useNavigate } from 'react-router'
import { useVisibleApps, type AppEntry } from '@/apps/PhoneShell/AppRegistry'
import { AppGlyph, hasAppIconImg, needsIconTile } from '@/ui/icons'
import { appColor } from '@/ui/theme'
import { EmptyState } from '@/ui/Primitives'
import { openSitePage } from '@/sites/sitePage'
import { useGameClock } from '@/apps/PhoneShell/useGameClock'
import { formatClock } from '@/utils/time'
// 玩家提供的手机壁纸（src/assets/phone/wallpaper.jpg）作为桌面背景。
import wallpaperUrl from '@/assets/phone/wallpaper.jpg?url'

/** 桌面底部 dock 常驻 App。dock 与网格互斥，避免同一 App 出现两次
 *  （审核报告 2.E：实测「打开 电话/短信/微信」各出现两次）。
 *  'browser' 是已删除的 App，不能再留在过滤表里。 */
const DOCK_APP_IDS = ['phone', 'sms', 'wechat']

export function Desktop() {
  const visible = useVisibleApps()
  const navigate = useNavigate()
  // 分钟级显示：10s 刷一次足够，且避免每秒重渲染整页。
  const clockMs = useGameClock(10_000)

  const gridApps = visible.filter((app) => !DOCK_APP_IDS.includes(app.appId))
  const dockApps = visible.filter((app) => DOCK_APP_IDS.includes(app.appId))

  return (
    <div
      className="desk"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(8, 8, 12, 0.5) 0%, rgba(8, 8, 12, 0.34) 38%, rgba(8, 8, 12, 0.72) 100%), url(${wallpaperUrl})`,
      }}
    >
      <div className="desk-clock">
        <div className="desk-time">{formatClock(clockMs)}</div>
        <div className="desk-date-row">
          <span>3月13日 周五</span>
          <i className="dot" />
          <span>绿草中学 · 男生宿舍</span>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon="settings"
          title="桌面暂无可用应用"
          hint="应用将随剧情推进解锁。请从微信开始调查。"
        />
      ) : (
        <div className="desk-grid">
          {gridApps.map((app) => (
            <DesktopIcon key={app.appId} app={app} onOpen={() => navigate(`/app/${app.appId}`)} />
          ))}
          {/* 搜索（百度站入口）：伪浏览器 App 已删除，玩家靠此"一级站点"图标打开百度，
              在百度站搜关键词跳各官网。剧情大纲"搜索湖南绿草中学官网"由它承载。 */}
          <button
            type="button"
            className="desk-icon"
            onClick={() => openSitePage('page-baidu-search')}
            aria-label="打开百度搜索"
          >
            <div className="desk-tile">
              <AppGlyph id="baidu" size={58} fallbackLabel="百度" />
            </div>
            <span className="desk-label">百度一下</span>
          </button>
        </div>
      )}

      <div className="desk-dots" aria-hidden="true">
        <span className="desk-dot active" />
        <span className="desk-dot" />
      </div>

      {dockApps.length > 0 ? (
        <div className="dock">
          {dockApps.map((app) => (
            <DockIcon key={app.appId} app={app} onOpen={() => navigate(`/app/${app.appId}`)} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function DesktopIcon({ app, onOpen }: { app: AppEntry; onOpen: () => void }) {
  // 品牌图标是否自带不透明背景（wechat/qq/phone/sms/baidu 这类全彩 SVG）。
  // 自带背景 → full-bleed 铺满图标块（仅圆角裁剪，不再套色 tile）。
  // 线条图标（doorbell 无背景）或非 IMG 图标 → 套色 tile + 居中小图标。
  const isFullBleed = hasAppIconImg(app.icon) && !needsIconTile(app.icon)
  return (
    <button type="button" onClick={onOpen} aria-label={`打开 ${app.title}`} className="desk-icon">
      {isFullBleed ? (
        <div className="desk-tile">
          <AppGlyph id={app.icon} size={58} fallbackLabel={app.title} />
        </div>
      ) : (
        <div
          className="desk-tile desk-tile--line"
          style={{ background: appColor(app.appId) + '24' }}
        >
          <AppGlyph id={app.icon} size={38} color={appColor(app.appId)} fallbackLabel={app.title} />
        </div>
      )}
      <span className="desk-label">{app.title}</span>
    </button>
  )
}

function DockIcon({ app, onOpen }: { app: AppEntry; onOpen: () => void }) {
  const isFullBleed = hasAppIconImg(app.icon) && !needsIconTile(app.icon)
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`打开 ${app.title}`}
      className={isFullBleed ? 'dock-btn' : 'dock-btn dock-btn--line'}
      style={isFullBleed ? undefined : { background: 'rgba(255,255,255,0.08)' }}
    >
      <AppGlyph
        id={app.icon}
        size={isFullBleed ? 54 : 34}
        color={isFullBleed ? undefined : appColor(app.appId)}
        fallbackLabel={app.title}
      />
    </button>
  )
}
