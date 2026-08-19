/**
 * src/ui/theme.ts
 *
 * 共享主题（frontend-phone-shell 自有，CLAUDE.md §2 + 交互设计 §二）。
 * 暗色基调，各 App 主题色：微信绿 / QQ 蓝 / 浏览器等。
 * 仅导出常量 + CSS 变量名，组件用 inline style 或 className 引用。
 */

export const palette = {
  // 系统底色（暗色基调）
  bgDarkest: '#0a0a0f',
  bgPhoneShell: '#111118',
  bgScreen: '#16161e',
  bgCard: '#1c1c26',
  bgCardAlt: '#22222e',
  bgElevated: '#2a2a36',
  bgInput: '#0e0e14',

  // 文字
  textPrimary: '#f2f2f7',
  textSecondary: '#aeaeb4',
  textTertiary: '#6b6b76',
  textInverse: '#0a0a0f',

  // 边框 / 分隔
  border: '#2c2c38',
  borderLight: '#3a3a48',
  divider: '#26262f',

  // 系统强调
  accent: '#3b82f6',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  info: '#38bdf8',

  // 各 App 主题色
  wechatGreen: '#07c160',
  qqBlue: '#12b7f5',
  browserBlue: '#2563eb',
  phoneGreen: '#22c55e',
  smsOrange: '#f97316',
  doorbellCyan: '#06b6d4',
  albumPurple: '#a855f7',
  filesAmber: '#eab308',
  notesYellow: '#facc15',
  settingsGray: '#6b7280',
} as const

export type PaletteKey = keyof typeof palette

/** App 主题色映射：appId -> 主题色（与 manifest 一致）。 */
export const appThemeColor: Record<string, string> = {
  wechat: palette.wechatGreen,
  qq: palette.qqBlue,
  browser: palette.browserBlue,
  phone: palette.phoneGreen,
  sms: palette.smsOrange,
  doorbell: palette.doorbellCyan,
  album: palette.albumPurple,
  files: palette.filesAmber,
  notes: palette.notesYellow,
  settings: palette.settingsGray,
}

/** alertStyle -> 颜色（用于通知/全屏警告）。 */
export const alertStyleColor: Record<string, string> = {
  danger: palette.danger,
  warning: palette.warning,
  info: palette.info,
  success: palette.success,
}

/** callout variant -> 颜色。 */
export const calloutVariantColor: Record<string, string> = {
  info: palette.info,
  warning: palette.warning,
  danger: palette.danger,
}

/** 通用圆角 / 间距 token（数字，便于 inline 计算）。 */
export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const

/** inline style helper：把 palette key 转为 { color: ... }。 */
export function colorOf(key: PaletteKey): { color: string } {
  return { color: palette[key] }
}

/** 获取某 appId 主题色，未知则回退 accent。 */
export function appColor(appId: string): string {
  return appThemeColor[appId] ?? palette.accent
}
