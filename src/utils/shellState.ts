/**
 * src/utils/shellState.ts
 *
 * PhoneShell 与 engine 的集成适配层（frontend-phone-shell 自有文件）。
 *
 * 背景（CLAUDE.md §3）：src/engine/** 由 frontend-engine agent 独占；
 * src/apps/PhoneShell/** + src/ui/** + src/main.tsx + src/App.tsx + src/utils/**
 * 由本 agent（frontend-phone-shell）独占。engine 已实现完整 hooks/services：
 *   useRisk / useCountdown / useEvidence / useChapter / useClue（@/engine/hooks）
 *   AlertService / SmsService / DoorbellService（@/engine/feedback）
 *   eventBus.on（@/engine/eventBus）
 *
 * 本文件职责：
 *  1) 适配 engine hooks 到 shell 期望的形状（统一命名，便于 shell 内部使用），
 *     并把 engine 的真值暴露给 UI。
 *  2) 维护 shell 本地"通用通知队列"（engine 不管的 UI 级横幅，如系统样式的
 *     普通推送）+ 屏幕震动 / 红边强度 / 来电振铃 等 PhoneShell 视觉态。
 *  3) 订阅 engine 事件（smsPushed / doorbellPushed / fullscreenAlert），
 *     把引擎侧的一次性副作用映射成 shell UI 反馈（横幅 + 震动 + 红边）。
 *
 * 任何 engine 路径变更只需改本文件，shell 组件保持不变。
 */
import { useSyncExternalStore } from 'react'
import type {
  ChapterId,
  ClueId,
  EndingId,
  EvidenceId,
  PuzzleId,
} from '@/types'
import { useRisk as engineUseRisk } from '@/engine/hooks/useRisk'
import { useCountdown as engineUseCountdown } from '@/engine/hooks/useCountdown'
import { useEvidence as engineUseEvidence } from '@/engine/hooks/useEvidence'
import { useChapter as engineUseChapter } from '@/engine/hooks/useChapter'
import { useClue as engineUseClue } from '@/engine/hooks/useClue'
import { useGameStore } from '@/engine/store/gameStore'
import {
  fullscreenAlert as engineFullscreenAlert,
  dismissFullscreenAlert as engineDismissAlert,
  subscribeFullscreenAlert,
  toast as engineToast,
  subscribeToasts,
  type FullscreenAlertState as EngineFullscreenAlert,
} from '@/engine/feedback/AlertService'
import { subscribeDelivered as subscribeSmsDelivered } from '@/engine/feedback/SmsService'
import { subscribe as subscribeDoorbell, getActive as getActiveDoorbell } from '@/engine/feedback/DoorbellService'
import { on as onEngineEvent } from '@/engine/eventBus'
import { onView as clueOnView } from '@/engine/clue/ClueRegistry'
import { getSmsEventById } from '@/data/loader'
import type { ViewPayload } from '@/data/loader'
import type { SmsEvent, DoorbellEvent } from '@/types'

// ===== shell 本地轻量 store：通知队列 + 视觉态（与剧情无关，纯 UI）=====
export interface NotificationItem {
  id: string
  kind: 'sms' | 'doorbell' | 'call' | 'alert' | 'system'
  appIcon?: string
  title: string
  body: string
  style: 'danger' | 'warning' | 'info' | 'success'
  appId?: string
  threadId?: string
  pageId?: string
  createdAt: number
  fullscreen?: boolean
}

export interface FullscreenAlertState {
  visible: boolean
  text: string
  style: 'danger' | 'warning' | 'info' | 'success'
}

export interface ToastItem {
  id: number
  text: string
  variant: 'info' | 'success' | 'warning' | 'danger'
}

interface ShellRuntimeState {
  notifications: NotificationItem[]
  fullscreenAlert: FullscreenAlertState
  toasts: ToastItem[]
  shaking: boolean
  redEdgeIntensity: number
  incomingCall: { active: boolean; callerName?: string; callerId?: string } | null
}

let runtimeState: ShellRuntimeState = {
  notifications: [],
  fullscreenAlert: { visible: false, text: '', style: 'info' },
  toasts: [],
  shaking: false,
  redEdgeIntensity: 0,
  incomingCall: null,
}

const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

function setState(patch: Partial<ShellRuntimeState>): void {
  runtimeState = { ...runtimeState, ...patch }
  emit()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot(): ShellRuntimeState {
  return runtimeState
}

function useShellRuntime(): ShellRuntimeState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

// ===== 通用通知队列 action（shell 自管：UI 级横幅，非剧情副作用）=====
export interface PushNotificationInput {
  kind: NotificationItem['kind']
  title: string
  body: string
  style?: NotificationItem['style']
  appIcon?: string
  appId?: string
  threadId?: string
  pageId?: string
  fullscreen?: boolean
}

let notifSeq = 0
function nextNotifId(): string {
  notifSeq += 1
  return `notif-${Date.now().toString(36)}-${notifSeq}`
}

export function pushNotification(input: PushNotificationInput): string {
  const item: NotificationItem = {
    id: nextNotifId(),
    kind: input.kind,
    title: input.title,
    body: input.body,
    style: input.style ?? 'info',
    appIcon: input.appIcon,
    appId: input.appId,
    threadId: input.threadId,
    pageId: input.pageId,
    fullscreen: input.fullscreen ?? false,
    createdAt: Date.now(),
  }
  const next = [...runtimeState.notifications, item]
  if (next.length > 30) next.splice(0, next.length - 30)
  setState({ notifications: next })
  return item.id
}

export function dismissNotification(id: string): void {
  setState({ notifications: runtimeState.notifications.filter((n) => n.id !== id) })
}

export function clearNotifications(): void {
  setState({ notifications: [] })
}

export function setShaking(shaking: boolean): void {
  if (runtimeState.shaking !== shaking) setState({ shaking })
}

export function setRedEdgeIntensity(intensity: number): void {
  const clamped = Math.max(0, Math.min(1, intensity))
  if (runtimeState.redEdgeIntensity !== clamped) setState({ redEdgeIntensity: clamped })
}

export function setIncomingCall(call: ShellRuntimeState['incomingCall']): void {
  setState({ incomingCall: call })
}

// ===== 全屏警告：委托 engine AlertService（engine 是全屏告警的唯一真源）=====
export function showFullscreenAlert(text: string, style: FullscreenAlertState['style'] = 'danger'): void {
  const variant = style === 'success' ? 'info' : style === 'info' ? 'info' : style === 'warning' ? 'warning' : 'danger'
  engineFullscreenAlert(text, variant)
}

export function hideFullscreenAlert(): void {
  engineDismissAlert()
}

export function showToast(text: string, variant: ToastItem['variant'] = 'info'): void {
  engineToast(text, variant)
}

// ===== 对外暴露的 shell hooks（UI 消费）=====
export function useNotifications(): NotificationItem[] {
  return useShellRuntime().notifications
}

export function useFullscreenAlert(): FullscreenAlertState {
  // engine AlertService 是全屏告警的唯一真源；shell 不再维护本地 alert 状态
  const engineAlert = useEngineFullscreenAlert()
  return { visible: engineAlert.visible, text: engineAlert.text, style: mapVariant(engineAlert.variant) }
}

export function useToasts(): ToastItem[] {
  return useEngineToasts()
}

export function useShaking(): boolean {
  return useShellRuntime().shaking
}

export function useRedEdgeIntensity(): number {
  return useShellRuntime().redEdgeIntensity
}

export function useIncomingCall(): ShellRuntimeState['incomingCall'] {
  return useShellRuntime().incomingCall
}

// ===== engine hooks 适配（统一形状）=====
function mapVariant(v: 'info' | 'warning' | 'danger'): FullscreenAlertState['style'] {
  return v === 'warning' ? 'warning' : v === 'danger' ? 'danger' : 'info'
}

/** 订阅 engine AlertService fullscreen（用 useSyncExternalStore）。 */
function useEngineFullscreenAlert(): EngineFullscreenAlert {
  return useSyncExternalStore(subscribeFullscreenAlert, _getEngineAlertCached, _getEngineAlertCached)
}

// AlertService 没有暴露 getSnapshot，但其暴露了 getFullscreenAlert()。
// 我们用订阅回调缓存最新值，给 useSyncExternalStore 使用。
let _engineAlertCache: EngineFullscreenAlert = { id: 0, text: '', variant: 'info', visible: false }
function _getEngineAlertCached(): EngineFullscreenAlert {
  return _engineAlertCache
}
// 立即订阅一次（模块加载即连），保证缓存新鲜
subscribeFullscreenAlert((a) => {
  _engineAlertCache = a
})

/** engine toasts 通过 subscribeToasts 订阅。 */
function useEngineToasts(): ToastItem[] {
  return useSyncExternalStore(subscribeToasts, () => _engineToastsCache)
}
let _engineToastsCache: ToastItem[] = []
subscribeToasts((ts) => {
  _engineToastsCache = ts.map((t) => ({
    id: t.id,
    text: t.text,
    variant: (t.variant ?? 'info') as ToastItem['variant'],
  }))
})

// ===== 风险值 / 倒计时 / 证据 / 章节 / 谜题 / 线索：直接转发 engine hooks =====
export interface RiskSnapshot {
  risk: number
  isRedAlert: boolean
  isMaxed: boolean
}

export function useRisk(): RiskSnapshot {
  const r = engineUseRisk()
  return { risk: r.risk, isRedAlert: r.redAlert, isMaxed: r.riskMaxed }
}

export interface CountdownSnapshot {
  active: boolean
  remainingSec: number
  totalSec: number
  expired: boolean
  countdownId: string | null
}

export function useCountdown(countdownId?: string): CountdownSnapshot {
  const id = countdownId ?? 'countdown-finale'
  const cd = engineUseCountdown(id)
  return {
    active: cd.active,
    remainingSec: cd.remainingSec,
    totalSec: cd.durationSec,
    expired: cd.expired,
    countdownId: cd.active ? id : null,
  }
}

export interface EvidenceSnapshot {
  collectedEvidenceIds: EvidenceId[]
  isCollected: (id: EvidenceId) => boolean
}

export function useEvidence(): EvidenceSnapshot {
  const e = engineUseEvidence()
  return {
    collectedEvidenceIds: e.collectedEvidenceIds,
    isCollected: (id) => e.collectedEvidenceIds.includes(id),
  }
}

export function useRegisteredClues(): ClueId[] {
  const c = engineUseClue()
  return c.registeredClueIds
}

export interface ChapterSnapshot {
  currentChapterId: ChapterId
  endingId?: EndingId
  finished: boolean
}

export function useChapter(): ChapterSnapshot {
  const c = engineUseChapter()
  const endingId = useGameStore((s) => s.endingId)
  return { currentChapterId: c.currentChapterId, endingId, finished: c.finished }
}

export function useSolvedPuzzles(): Set<PuzzleId> {
  const solved = useGameStore((s) => s.solvedPuzzleIds)
  return new Set<PuzzleId>(solved)
}

/**
 * 注册"查看事件"触发线索注册（engine useClue().view 闸口）。
 * 各 App 在关键交互处调用以触发"查看即取证"。
 */
export function viewClueSource(payload: ViewPayload): void {
  // useClue().view 是 hook-bound 回调，这里直接走 ClueRegistry.onView（非 React 路径）
  // 但 onView 是 async 且依赖 domEl；这里 fire-and-forget。
  void triggerClueView(payload)
}

async function triggerClueView(payload: ViewPayload): Promise<void> {
  try {
    await clueOnView(payload, null)
  } catch {
    // 静默：引擎未就绪或数据未加载时不破坏 UI
  }
}

// ===== engine 集成：phone-shell 启动时绑定（在 App 顶层 useEffect 调一次）=====
let _engineWired = false

/** 绑定 shell 视觉态到 engine 事件流（App 顶层调用一次，幂等）。 */
export function wireShellToEngine(): void {
  if (_engineWired) return
  _engineWired = true

  // 1) SMS 推送 → 通知横幅
  subscribeSmsDelivered((ids) => {
    // 仅对最新一条生成横幅（避免重放存档时刷屏）
    const last = ids[ids.length - 1]
    if (!last) return
    const ev: SmsEvent | undefined = getSmsEventById(last)
    if (!ev) return
    pushNotification({
      kind: 'sms',
      title: '短信',
      body: ev.body.slice(0, 60),
      style: ev.alertStyle === 'success' ? 'success' : ev.alertStyle === 'danger' ? 'danger' : ev.alertStyle === 'warning' ? 'warning' : 'info',
      appId: 'sms',
      appIcon: 'sms',
    })
  })

  // 2) 门铃推送 → 全屏告警已由 engine DoorbellService 触发；这里仅补充震屏 + 红边
  subscribeDoorbell((activeId) => {
    if (activeId) {
      setShaking(true)
      setRedEdgeIntensity(0.9)
      const ev: DoorbellEvent | null = getActiveDoorbell()
      if (ev) {
        pushNotification({
          kind: 'doorbell',
          title: ev.title,
          body: ev.pushNotification.body,
          style: 'danger',
          appId: 'doorbell',
          appIcon: 'doorbell',
        })
      }
    } else {
      setShaking(false)
      // 红边强度交还风险值驱动（见 riskChanged）
    }
  })

  // 3) 风险值变化 → 红边强度
  onEngineEvent('riskChanged', ({ risk }) => {
    if (risk > 70) setRedEdgeIntensity(Math.min(1, 0.5 + (risk - 70) / 60))
    else setRedEdgeIntensity(0)
  })

  // 4) 倒计时到期 → 屏幕黑屏 + 震屏停止
  onEngineEvent('countdownExpired', () => {
    setShaking(false)
  })

  // 5) 结局推送 → 清通知 + 来电结束
  onEngineEvent('endingPushed', () => {
    setIncomingCall(null)
  })
}

// ===== 类型 re-export 便于 App agent 使用 =====
export type { ViewPayload } from '@/data/loader'
export type { SmsEvent, DoorbellEvent } from '@/types'

/** engine 连接器类型（供需要注入的组件声明 props 用）。 */
export interface EngineConnector {
  useRisk: typeof useRisk
  useCountdown: typeof useCountdown
  useEvidence: typeof useEvidence
  useChapter: typeof useChapter
  useSolvedPuzzles: typeof useSolvedPuzzles
  useRegisteredClues: typeof useRegisteredClues
  viewClueSource: typeof viewClueSource
}

export const defaultEngineConnector: EngineConnector = {
  useRisk,
  useCountdown,
  useEvidence,
  useChapter,
  useSolvedPuzzles,
  useRegisteredClues,
  viewClueSource,
}

// 重置（仅测试用）
export function _resetShellRuntimeForTest(): void {
  runtimeState = {
    notifications: [],
    fullscreenAlert: { visible: false, text: '', style: 'info' },
    toasts: [],
    shaking: false,
    redEdgeIntensity: 0,
    incomingCall: null,
  }
  emit()
}
