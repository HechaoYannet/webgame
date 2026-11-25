/**
 * src/ui/icons.tsx
 *
 * 内置 SVG 图标集（无第三方依赖）。
 * App manifest 的 `icon` 字段是字符串 ID（如 'wechat' / 'qq' / 'browser'），
 * Desktop/DesktopIcon 用 <AppGlyph id={icon} /> 渲染；未知 ID 回退通用方块。
 *
 * App 主图标（wechat/qq/phone/sms/doorbell/baidu）使用玩家提供的品牌 SVG
 * （src/assets/phone/*.svg）经 ?url 导入，以 <img> 渲染——保留原 SVG 的背景与配色，
 * 圆角裁剪。manifest 里 icon 可能写成带后缀形如 'wechat.png'，渲染前会去掉后缀归一化。
 *
 * 各 App agent 也可在自己目录 manifest 里写 icon 字符串，
 * 只要本文件 export 了对应 Glyph 或 fallback 生效即可。
 * 新增 App 图标：在本文件追加 case + SVG path，无需改 types。
 */
import type { CSSProperties } from 'react'

// 玩家提供的 6 个品牌 App 图标 SVG（src/assets/phone/*.svg）。?url 取构建后带 hash 的路径。
import wechatIconUrl from '@/assets/phone/wechat.svg?url'
import qqIconUrl from '@/assets/phone/qq.svg?url'
import phoneIconUrl from '@/assets/phone/phone.svg?url'
import smsIconUrl from '@/assets/phone/sms.svg?url'
import doorbellIconUrl from '@/assets/phone/doorbell.svg?url'
import baiduIconUrl from '@/assets/phone/baidu.svg?url'

/**
 * manifest icon id（去后缀后）→ 品牌 SVG 图 URL。
 * 命中即以 <img> 渲染原 SVG（保留背景/配色），不走内联 PATHS。
 */
const ICON_IMG: Record<string, string> = {
  wechat: wechatIconUrl,
  qq: qqIconUrl,
  phone: phoneIconUrl,
  sms: smsIconUrl,
  doorbell: doorbellIconUrl,
  baidu: baiduIconUrl,
}

/** 把 manifest 可能带后缀的 icon id（'wechat.png'）归一化为 'wechat'。 */
function normalizeIconId(id: string): string {
  return id.replace(/\.(png|svg|jpe?g)$/i, '')
}

/**
 * 该 icon id 是否由玩家提供的品牌 SVG 渲染（命中 ICON_IMG）。
 * 宿主（Desktop/Dock）据此决定是否给图标块加背景色 tile：
 * 品牌图标自带背景 → 直接 full-bleed；线条图标（如 doorbell 24×24 无背景）→ 加色 tile。
 */
export function hasAppIconImg(id: string): boolean {
  return normalizeIconId(id) in ICON_IMG
}

/**
 * 命中 ICON_IMG 的图标里，哪些是无背景的线条/纯轮廓图标（自带透明背景，
 * 直接铺到深色壁纸上会"消失"），需要宿主给它套一层色 tile。
 * 其余品牌 SVG（wechat/qq/phone/sms/baidu）自带不透明背景，full-bleed 即可。
 */
const LINE_ICON_IDS = new Set(['doorbell'])

/** 命中 ICON_IMG 但属无背景线条图标 → 需要宿主套色 tile。 */
export function needsIconTile(id: string): boolean {
  return LINE_ICON_IDS.has(normalizeIconId(id))
}

export type GlyphProps = {
  size?: number
  color?: string
  style?: CSSProperties
  className?: string
}

function Svg({
  size = 24,
  color = 'currentColor',
  children,
  style,
  className,
  viewBox = '0 0 24 24',
}: GlyphProps & { children: React.ReactNode; viewBox?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ color, display: 'block', ...style }}
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const PATHS: Record<string, (p: GlyphProps) => React.ReactElement> = {
  wechat: (p) => (
    <Svg {...p} viewBox="0 0 24 24">
      <path
        fill={p.color ?? '#07c160'}
        d="M9.5 4C5.36 4 2 6.69 2 10c0 1.74.93 3.3 2.4 4.4L4 17l3-1.6c.8.2 1.6.3 2.5.3.27 0 .53-.01.79-.03A5.4 5.4 0 0 1 9.5 12c0-3.1 2.95-5.6 6.6-5.6.2 0 .39 0 .58.02C15.62 5.04 12.8 4 9.5 4Zm-2.3 3.4a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Zm4.6 0a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z"
      />
      <path
        fill={p.color ?? '#07c160'}
        d="M22 14.2c0-2.6-2.6-4.7-5.8-4.7s-5.8 2.1-5.8 4.7 2.6 4.7 5.8 4.7c.6 0 1.2-.08 1.7-.22L20 20l-.5-1.7c1.5-.86 2.5-2.27 2.5-3.86Zm-7.6-.9a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Zm3.6 0a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Z"
      />
    </Svg>
  ),
  qq: (p) => (
    <Svg {...p} viewBox="0 0 24 24">
      <path
        fill={p.color ?? '#12b7f5'}
        d="M12 2c3.3 0 6 3 6 6.5 0 1.2-.2 2.3-.6 3.3.6.5 1.5 1.7 1.8 3.4.3 1.7-.2 3-.8 3-.5 0-.8-.8-1.2-1.7-.2 1.8-.9 3.6-2.4 4.6.6.2 1.2.5 1.4.8.2.3 0 .6-.5.6h-3.4c-.5 0-.7-.3-.5-.6.2-.3.8-.6 1.4-.8-1.5-1-2.2-2.8-2.4-4.6-.4.9-.7 1.7-1.2 1.7-.6 0-1.1-1.3-.8-3 .3-1.7 1.2-2.9 1.8-3.4-.4-1-.6-2.1-.6-3.3C6 5 8.7 2 12 2Z"
      />
    </Svg>
  ),
  browser: (p) => (
    <Svg {...p} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill={p.color ?? '#2563eb'} />
      <path
        fill="#fff"
        d="M12 4.5c-2 0-3.7 2.4-4 5.5h8c-.3-3.1-2-5.5-4-5.5ZM4.5 12c0 .7.1 1.4.3 2H9c-.1-.7-.1-1.3-.1-2s0-1.3.1-2H4.8c-.2.6-.3 1.3-.3 2Zm12.5-2c.1.7.1 1.3.1 2s0 1.3-.1 2h3.6c.2-.6.3-1.3.3-2s-.1-1.4-.3-2H17Zm-5 6.5c2 0 3.7-2.4 4-5.5H8c.3 3.1 2 5.5 4 5.5Z"
      />
    </Svg>
  ),
  phone: (p) => (
    <Svg {...p} viewBox="0 0 24 24">
      <path
        fill={p.color ?? '#22c55e'}
        d="M6.6 2h10.8c.9 0 1.6.7 1.6 1.6v16.8c0 .9-.7 1.6-1.6 1.6H6.6c-.9 0-1.6-.7-1.6-1.6V3.6C5 2.7 5.7 2 6.6 2ZM8 4v13h8V4H8Zm4 14a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z"
      />
    </Svg>
  ),
  sms: (p) => (
    <Svg {...p} viewBox="0 0 24 24">
      <path
        fill={p.color ?? '#f97316'}
        d="M3 5h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1Zm5 5v1.5h8V10H8Zm0 3v1.5h5V13H8Z"
      />
    </Svg>
  ),
  doorbell: (p) => (
    <Svg {...p} viewBox="0 0 24 24">
      <path
        fill={p.color ?? '#06b6d4'}
        d="M12 2a5 5 0 0 1 5 5v4l1.5 3.5h-13L7 11V7a5 5 0 0 1 5-5Zm0 18a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Z"
      />
    </Svg>
  ),
  album: (p) => (
    <Svg {...p} viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="16" rx="2" fill={p.color ?? '#a855f7'} />
      <circle cx="8" cy="9" r="1.6" fill="#fff" />
      <path d="m4 18 5-5 4 4 3-3 4 4v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-1Z" fill="#fff" opacity=".9" />
    </Svg>
  ),
  files: (p) => (
    <Svg {...p} viewBox="0 0 24 24">
      <path
        fill={p.color ?? '#eab308'}
        d="M4 5a1 1 0 0 1 1-1h6l2 2h6a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Z"
      />
    </Svg>
  ),
  notes: (p) => (
    <Svg {...p} viewBox="0 0 24 24">
      <path
        fill={p.color ?? '#facc15'}
        d="M5 3h14a1 1 0 0 1 1 1v14l-4 4H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 6h8v1.5H8V9Zm0 3h6v1.5H8V12Zm7 7v-3h3l-3 3Z"
      />
    </Svg>
  ),
  heart: (p) => (
    <Svg {...p} viewBox="0 0 24 24">
      <path
        fill={p.color ?? '#ef4444'}
        d="M12 20.6 4.6 13.4A4.9 4.9 0 0 1 11.6 6.5l.4.5.4-.5a4.9 4.9 0 0 1 7 6.9L12 20.6Z"
      />
    </Svg>
  ),
  warning: (p) => (
    <Svg {...p} viewBox="0 0 24 24">
      <path fill={p.color ?? '#f59e0b'} d="M12 2.6 23 21H1L12 2.6Z" />
      <path d="M11 9.5h2v5.2h-2V9.5Zm0 6.6h2v2h-2v-2Z" fill="#191919" />
    </Svg>
  ),
  settings: (p) => (
    <Svg {...p} viewBox="0 0 24 24">
      <path
        fill={p.color ?? '#6b7280'}
        d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm0-8 .8 2.4 2.5-.4.5 2.4 2.3-1 .4 2.5-.4 2.5 1 .5-2.3 2.4.4 2.5-2.4.5-.8 2.4h-2.5L12 22l-.8-2.4H8.7l-1-2.3-2.4.5.4-2.5L3.4 13l1-.5L3.4 10l2.3-1L5.3 6.6l2.4.4 2.3-1-.4-2.4L12 4l.5-2.3L12 2Z"
      />
    </Svg>
  ),
  back: (p) => (
    <Svg {...p}>
      <path d="M15 5l-7 7 7 7" stroke={p.color ?? 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  close: (p) => (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6L6 18" stroke={p.color ?? 'currentColor'} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  ),
  search: (p) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6" stroke={p.color ?? 'currentColor'} strokeWidth="2" />
      <path d="m20 20-4-4" stroke={p.color ?? 'currentColor'} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  ),
  zoom: (p) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" stroke={p.color ?? 'currentColor'} strokeWidth="2" />
      <path d="M11 8v6M8 11h6M20 20l-4-4" stroke={p.color ?? 'currentColor'} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  ),
  home: (p) => (
    <Svg {...p}>
      <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-9Z" fill={p.color ?? 'currentColor'} />
    </Svg>
  ),
  battery: (p) => (
    <Svg {...p} viewBox="0 0 24 24">
      <rect x="2" y="7" width="18" height="10" rx="2" stroke={p.color ?? 'currentColor'} strokeWidth="1.5" fill="none" />
      <rect x="20.5" y="9.5" width="2" height="5" rx="1" fill={p.color ?? 'currentColor'} />
      <rect x="4" y="9" width="13" height="6" rx="1" fill={p.color ?? 'currentColor'} />
    </Svg>
  ),
  signal: (p) => (
    <Svg {...p} viewBox="0 0 24 24">
      <rect x="3" y="15" width="3" height="5" rx="1" fill={p.color ?? 'currentColor'} />
      <rect x="8" y="12" width="3" height="8" rx="1" fill={p.color ?? 'currentColor'} />
      <rect x="13" y="8" width="3" height="12" rx="1" fill={p.color ?? 'currentColor'} />
      <rect x="18" y="4" width="3" height="16" rx="1" fill={p.color ?? 'currentColor'} />
    </Svg>
  ),
}

export type AppIconId = keyof typeof PATHS | string

/**
 * App 图标渲染器：manifest.icon 字符串 → 图标。
 * 优先级：
 *  1) ICON_IMG 命中（玩家提供的品牌 SVG，去后缀归一化匹配）→ <img> 渲染原 SVG，
 *     保留背景与配色，圆角裁剪。
 *  2) PATHS 内联 SVG（系统级小图标信号/电量等）。
 *  3) 回退：圆角方块 + 首字母。
 */
export function AppGlyph({
  id,
  size = 48,
  color,
  fallbackLabel,
  style,
}: {
  id: string
  size?: number
  color?: string
  fallbackLabel?: string
  style?: CSSProperties
}) {
  const imgSrc = ICON_IMG[normalizeIconId(id)]
  if (imgSrc) {
    // 门铃 SVG 为 24×24 无背景纯线条图标，其余 5 个为 512×512 全彩带背景。
    // 统一用 <img> 渲染：SVG 矢量缩放无损；object-fit contain 居中，圆角裁剪。
    return (
      <img
        src={imgSrc}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'block',
          ...style,
        }}
      />
    )
  }
  // 归一化后再查 PATHS：manifest 里可能写 'album.png' / 'notes.png'，
  // 此前只对品牌 SVG 归一化，PATHS 用原始 id 查 → album.png 查不到，
  // 桌面第一项退化成「相」字方块（审核报告 D 末条 / 2.E 图标语义错）。
  const factory = PATHS[normalizeIconId(id)]
  if (factory) return factory({ size, color, style })
  // 回退：圆角方块 + 首字母
  const letter = (fallbackLabel ?? id).trim().slice(0, 1).toUpperCase()
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
        background: color ?? '#3b82f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 600,
        fontSize: Math.round(size * 0.5),
        ...style,
      }}
      aria-hidden="true"
    >
      {letter}
    </div>
  )
}

/** 通用小图标（back/close/search 等系统级）。 */
export function Glyph({ name, size = 24, color, style, className }: GlyphProps & { name: AppIconId }) {
  const factory = PATHS[name]
  if (factory) return factory({ size, color, style, className })
  return null
}
