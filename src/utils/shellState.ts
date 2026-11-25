/**
 * src/utils/shellState.ts
 *
 * 重写后（玩家决策 2026-08-19）：引擎 feedback 服务已删。本文件不再"桥接 engine 事件流"，
 * 而是手机外壳自管的轻量运行态 + 极简 game store 的 React 适配层。
 *
 * 职责：
 *  1) shell 本地运行态（与剧情无关的 UI 态）：通知队列 / 全屏警告 / toast / 震屏 / 红边 / 来电。
 *     用 useSyncExternalStore 自管，纯 React，不碰引擎。
 *  2) SMS / 门铃"已送达"列表：高潮由手机内"启动举报倒计时"动作触发——deliverSms /
 *     deliverDoorbell 把 phone/sms.json、phone/doorbell-events.json 的事件推入已送达列表
 *     + 生成通知横幅 + 震屏/红边/音频。SmsApp / DoorbellApp 读这些列表。
 *  3) 倒计时到期监听：watchCountdownExpiry 在 countdown-finale 过期时调 pushEnding('bad')。
 *  4) 极简 game store 的 thin hooks（useChapter / useCountdown / useEvidence / useSolvedPuzzles）
 *     从 @/game 适配为 shell 期望形状。
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ChapterId, EndingId, EvidenceId, PuzzleId } from '@/types'
import { useGameStore } from '@/game/gameStore'
import * as countdown from '@/game/countdown'
import { isFinaleSatisfied, listAll, getKeyEvidence, getRequiredForFinale } from '@/game/evidence'
import { play as playAudio, stop as stopAudio } from '@/game/audio'
import { getAllSmsEvents, getSmsEventById, getDoorbellEventById, getMonologueByChapter } from '@/data/loader'
import type { SmsEvent, DoorbellEvent, Monologue } from '@/types'
import { gameNowMs } from '@/utils/time'

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

/**
 * 来电运行态。threat=true 表示威胁来电（登录新希望后台后由监视者触发）：
 * 振铃 + 心跳双音频循环，接听走 phone/phone/call-scripts.json call-script-zhangqiang-threat-incoming（6 秒静默挂断），
 * 拒接仅停振铃。普通来电（暂未启用）threat=false 仅振铃。
 */
export interface IncomingCallState {
  active: boolean
  callerName?: string
  callerId?: string
  threat?: boolean
  scriptId?: string
}

interface ShellRuntimeState {
  notifications: NotificationItem[]
  fullscreenAlert: FullscreenAlertState
  toasts: ToastItem[]
  shaking: boolean
  redEdgeIntensity: number
  incomingCall: IncomingCallState | null
  /** 玩家"接听"后待 PhoneApp 自动开启的通话脚本 id（答录信号）。 */
  pendingAnsweredCallScriptId: string | null
  /** 已送达短信事件 id 列表（SmsApp 收件箱来源）。 */
  deliveredSmsIds: string[]
  /** 已送达门铃事件 id 列表（DoorbellApp 来源）。 */
  deliveredDoorbellIds: string[]
  /** 当前激活的门铃事件 id（推送一次激活一个）。 */
  activeDoorbellId: string | null
}

let runtimeState: ShellRuntimeState = {
  notifications: [],
  fullscreenAlert: { visible: false, text: '', style: 'info' },
  toasts: [],
  shaking: false,
  redEdgeIntensity: 0,
  incomingCall: null,
  pendingAnsweredCallScriptId: null,
  deliveredSmsIds: [],
  deliveredDoorbellIds: [],
  activeDoorbellId: null,
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

// ===== 通用通知队列 action（shell 自管）=====
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
  return `notif-${notifSeq}`
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
    createdAt: gameNowMs(),
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

/**
 * 触发威胁来电（登录新希望后台后由监视者打进）。振铃 audio-call-ringback + 心跳
 * audio-heartbeat 双音频循环，并推一条系统通知。幂等：已在振铃则不重复触发。
 */
export function triggerThreatIncomingCall(): void {
  if (runtimeState.incomingCall?.active) return
  const scriptId = 'call-script-zhangqiang-threat-incoming'
  setState({
    incomingCall: {
      active: true,
      callerName: '未知号码',
      callerId: '来电',
      threat: true,
      scriptId,
    },
  })
  playAudio('audio-call-ringback', true)
  playAudio('audio-heartbeat', true)
  pushNotification({
    kind: 'call',
    title: '来电',
    body: '未知号码',
    style: 'danger',
    appId: 'phone',
    appIcon: 'phone',
  })
}

/** 停止来电振铃（接听/拒接/超时调用）。停双音频，清来电态。 */
export function endIncomingCall(): void {
  stopAudio('audio-call-ringback')
  stopAudio('audio-heartbeat')
  setState({ incomingCall: null })
}

/**
 * 玩家"接听"威胁来电：停振铃，登记 pendingAnsweredCallScriptId 供 PhoneApp 接管，
 * 调用方随后导航到 /app/phone。PhoneApp 挂载时 consumePendingAnsweredCall 取走并
 * 直接进入 CallView 播放该脚本。
 */
export function answerIncomingCall(): string | null {
  const call = runtimeState.incomingCall
  if (!call?.active) return null
  const scriptId = call.scriptId ?? null
  endIncomingCall()
  setState({ pendingAnsweredCallScriptId: scriptId })
  return scriptId
}

/** PhoneApp 取走（并清空）待答录的通话脚本 id。 */
export function consumePendingAnsweredCall(): string | null {
  const id = runtimeState.pendingAnsweredCallScriptId
  if (id) setState({ pendingAnsweredCallScriptId: null })
  return id
}

/** 订阅"待答录通话"信号（PhoneApp 用）：返回当前待播放脚本 id，不含清空副作用。 */
export function usePendingAnsweredCall(): string | null {
  return useShellRuntime().pendingAnsweredCallScriptId
}

// ===== 全屏警告 / toast（shell 自管，不再委托 engine AlertService）=====
let alertSeq = 0
let toastSeq = 0
const toastTimers = new Map<number, ReturnType<typeof setTimeout>>()

export function showFullscreenAlert(text: string, style: FullscreenAlertState['style'] = 'danger'): void {
  alertSeq += 1
  setState({ fullscreenAlert: { visible: true, text, style } })
  if (style === 'danger') setShaking(true)
}

export function hideFullscreenAlert(): void {
  setState({ fullscreenAlert: { ...runtimeState.fullscreenAlert, visible: false } })
  setShaking(false)
}

export function showToast(text: string, variant: ToastItem['variant'] = 'info'): void {
  toastSeq += 1
  const id = toastSeq
  const item: ToastItem = { id, text, variant }
  const next = [...runtimeState.toasts, item]
  setState({ toasts: next })
  const t = setTimeout(() => {
    setState({ toasts: runtimeState.toasts.filter((x) => x.id !== id) })
    toastTimers.delete(id)
  }, 3500)
  toastTimers.set(id, t)
}

export function dismissToast(id: number): void {
  const t = toastTimers.get(id)
  if (t) { clearTimeout(t); toastTimers.delete(id) }
  setState({ toasts: runtimeState.toasts.filter((x) => x.id !== id) })
}

// ===== SMS / 门铃"已送达"（高潮触发，折进 shell plain React）=====

/** 推送一条短信到已送达列表 + 通知横幅。smsEventId 来自 phone/sms.json。 */
export function deliverSms(smsEventId: string): void {
  if (runtimeState.deliveredSmsIds.includes(smsEventId)) return
  const ev: SmsEvent | undefined = getSmsEventById(smsEventId)
  setState({ deliveredSmsIds: [...runtimeState.deliveredSmsIds, smsEventId] })
  if (ev) {
    pushNotification({
      kind: 'sms',
      title: '短信',
      body: ev.body.slice(0, 60),
      style: ev.alertStyle === 'success' ? 'success' : ev.alertStyle === 'danger' ? 'danger' : ev.alertStyle === 'warning' ? 'warning' : 'info',
      appId: 'sms',
      appIcon: 'sms',
    })
    if (ev.alertStyle === 'danger') {
      showFullscreenAlert(ev.body, 'danger')
    }
  }
}

/** 推送一条门铃事件（激活实时画面）+ 震屏 + 红边 + 敲门音频。doorbellEventId 来自 phone/doorbell-events.json。 */
export function deliverDoorbell(doorbellEventId: string): void {
  const ev: DoorbellEvent | undefined = getDoorbellEventById(doorbellEventId)
  if (runtimeState.deliveredDoorbellIds.includes(doorbellEventId)) {
    setState({ activeDoorbellId: doorbellEventId })
  } else {
    setState({
      deliveredDoorbellIds: [...runtimeState.deliveredDoorbellIds, doorbellEventId],
      activeDoorbellId: doorbellEventId,
    })
  }
  setShaking(true)
  setRedEdgeIntensity(0.9)
  if (ev) {
    pushNotification({
      kind: 'doorbell',
      title: ev.title,
      body: ev.pushNotification.body,
      style: 'danger',
      appId: 'doorbell',
      appIcon: 'doorbell',
    })
    if (ev.audio?.assetId) {
      playAudio(ev.audio.assetId, ev.audio.loop ?? true)
      // 敲门音循环 15 秒后自动停（避免无限敲门噪音；心跳音由倒计时全程驱动）
      if (ev.audio.loop !== false) {
        setTimeout(() => stopAudio(ev.audio!.assetId), 15000)
      }
    }
  }
}

/** 关闭当前门铃激活态（震屏停、红边交还倒计时驱动）。 */
export function dismissDoorbell(): void {
  setState({ activeDoorbellId: null })
  setShaking(false)
  stopAudio()
}

// ===== 终局三件套（去引擎化后由"查看经费报告页"单点触发，幂等）=====

/**
 * 启动终局倒计时：3 分钟倒计时 + 威胁短信 + 刀哥门铃 + 心跳音 + 红边 + 推进终章。
 * 幂等：倒计时已在运行则不重复触发（store.startCountdown 内部已防重）。
 * 触发点：玩家在实验室后台打开经费申请报告页（site-shanhe-med 经 gameEvent 上报）。
 */
export function startFinaleCountdown(): void {
  const store = useGameStore.getState()
  const c = store.countdowns?.[COUNTDOWN_FINALE_ID]
  if (c && !c.expired) return
  countdown.startCountdown(COUNTDOWN_FINALE_ID, 180)
  store.advanceChapter('ch-finale')
  deliverSms('sms-zhangqiang-threat')
  deliverDoorbell('doorbell-dao-visit')
  playAudio('audio-heartbeat', true)
  setRedEdgeIntensity(0.9)
  setShaking(true)
  pushNotification({
    kind: 'alert',
    title: '危险',
    body: '倒计时已开始：尽快整理证据并报警！',
    style: 'danger',
    appIcon: 'album',
    appId: 'album',
  })
}

/** 终局倒计时 id（StatusBar/DoorbellApp/PhoneShell 共用常量）。 */
export const COUNTDOWN_FINALE_ID = 'countdown-finale'

/** 取已送达短信 id 列表（SmsApp 用）。 */
export function getDeliveredSmsIds(): string[] {
  return runtimeState.deliveredSmsIds
}
export function subscribeDeliveredSms(cb: () => void): () => void {
  return subscribe(cb)
}

/** 取已送达门铃 id 列表 + 当前激活 id（DoorbellApp 用）。 */
export function getDeliveredDoorbellIds(): string[] {
  return runtimeState.deliveredDoorbellIds
}
export function getActiveDoorbellId(): string | null {
  return runtimeState.activeDoorbellId
}
export function subscribeDoorbell(cb: () => void): () => void {
  return subscribe(cb)
}

// ===== 对外暴露的 shell hooks（UI 消费）=====
export function useNotifications(): NotificationItem[] {
  return useShellRuntime().notifications
}

export function useFullscreenAlert(): FullscreenAlertState {
  return useShellRuntime().fullscreenAlert
}

export function useToasts(): ToastItem[] {
  return useShellRuntime().toasts
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

/** 已送达短信 id 列表（订阅式，供 SmsApp）。 */
export function useDeliveredSmsIds(): string[] {
  return useSyncExternalStore(subscribeDeliveredSms, getDeliveredSmsIds, getDeliveredSmsIds)
}

/** 门铃：已送达 id 列表 + 当前激活 id（订阅式，供 DoorbellApp）。 */
export function useDoorbellState(): { deliveredIds: string[]; activeId: string | null } {
  const snap = useShellRuntime()
  return { deliveredIds: snap.deliveredDoorbellIds, activeId: snap.activeDoorbellId }
}

// ===== 风险已废（no-op 保留以维持 Shell/StatusBar 编译过渡）=====
export interface RiskSnapshot {
  risk: number
  isRedAlert: boolean
  isMaxed: boolean
}
/** no-op：风险系统已废。红边/心跳改由门铃/倒计时驱动。 */
export function useRisk(): RiskSnapshot {
  return { risk: 0, isRedAlert: false, isMaxed: false }
}

// ===== 倒计时 / 证据 / 章节 / 谜题：从 @/game 适配 =====
export interface CountdownSnapshot {
  active: boolean
  remainingSec: number
  totalSec: number
  expired: boolean
  countdownId: string | null
}

export function useCountdown(countdownId?: string): CountdownSnapshot {
  const id = countdownId ?? 'countdown-finale'
  // 订阅 gameStore 的 countdowns 变化（start / expire 会触发重渲染）。
  const entries = useGameStore((s) => s.countdowns)
  const entry = entries?.[id]
  const running = Boolean(entry && !entry.expired)
  // 进行中每秒强制重算剩余秒：store 只在 start/expire 时变化，
  // 若不 tick，UI 上的 mm:ss 会冻结在起始值、到点直接跳 expired。
  const [, forceTick] = useState(0)
  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => forceTick((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [running, id])
  const cd = countdown.getCountdownInfo(id) ?? { id, remainingSec: 0, durationSec: 0, expired: false, progress: 0 }
  return {
    active: cd.remainingSec > 0 && !cd.expired,
    remainingSec: cd.remainingSec,
    totalSec: cd.durationSec,
    expired: cd.expired,
    countdownId: cd.remainingSec > 0 || cd.expired ? id : null,
  }
}

export interface EvidenceSnapshot {
  collectedEvidenceIds: EvidenceId[]
  isCollected: (id: EvidenceId) => boolean
  all: ReturnType<typeof listAll>
  keyEvidence: ReturnType<typeof getKeyEvidence>
  requiredForFinale: EvidenceId[]
  finaleSatisfied: boolean
}

export function useEvidence(): EvidenceSnapshot {
  const collectedEvidenceIds = useGameStore((s) => s.collectedEvidenceIds)
  return {
    collectedEvidenceIds,
    isCollected: (id) => collectedEvidenceIds.includes(id),
    all: listAll(),
    keyEvidence: getKeyEvidence(),
    requiredForFinale: getRequiredForFinale(),
    finaleSatisfied: isFinaleSatisfied(),
  }
}

export interface ChapterSnapshot {
  currentChapterId: ChapterId
  endingId?: EndingId
  finished: boolean
  /** 当前章节开场独白（getMonologueByChapter(currentChapterId)）。 */
  monologue?: Monologue
}

export function useChapter(): ChapterSnapshot {
  const currentChapterId = useGameStore((s) => s.currentChapterId)
  const endingId = useGameStore((s) => s.endingId)
  const finished = useGameStore((s) => s.finished)
  const monologue = getMonologueByChapter(currentChapterId)
  return { currentChapterId, endingId, finished, monologue }
}

export function useSolvedPuzzles(): Set<PuzzleId> {
  const solved = useGameStore((s) => s.solvedPuzzleIds)
  return new Set<PuzzleId>(solved)
}

// ===== 倒计时到期监听 → 坏结局 =====
let _expiryWired = false
let _expiryTimer: ReturnType<typeof setInterval> | null = null

/**
 * 监听 countdown-finale：每 250ms tick，归零则 pushEnding('bad') + 清震屏/红边 + 显示坏结局告警。
 * 在 PhoneShell 挂载时调一次（幂等）。倒计时仅内存，刷新清空故不会误触发。
 */
export function watchCountdownExpiry(): void {
  if (_expiryWired) return
  _expiryWired = true
  const ID = 'countdown-finale'
  _expiryTimer = setInterval(() => {
    const info = countdown.tick(ID)
    if (info && info.expired && !useGameStore.getState().finished) {
      setShaking(false)
      setRedEdgeIntensity(0)
      stopAudio()
      useGameStore.getState().pushEnding('bad')
    }
  }, 250)
}

/**
 * 重置 shell 运行态（换新周目时调用）。
 *
 * 解决：旧周目的通知横幅、已送达短信/门铃、来电、震屏会留在模块内存里，
 * 玩家点「返回主菜单」开新局后仍能看到上一局的威胁短信（剧透）与门铃通知。
 * 存档由 gameStore.resetGame 清空，这里负责把"不落盘的界面态"一起清干净。
 *
 * 注意：不清倒计时监听定时器——它每 250ms tick 一次，store 里没有倒计时就是空转，
 * 保留它才能让新周目的终章倒计时继续被监听（watchCountdownExpiry 是幂等的）。
 */
export function resetShellRuntime(): void {
  for (const t of toastTimers.values()) clearTimeout(t)
  toastTimers.clear()
  stopAudio()
  runtimeState = {
    notifications: [],
    fullscreenAlert: { visible: false, text: '', style: 'info' },
    toasts: [],
    shaking: false,
    redEdgeIntensity: 0,
    incomingCall: null,
    pendingAnsweredCallScriptId: null,
    deliveredSmsIds: [],
    deliveredDoorbellIds: [],
    activeDoorbellId: null,
  }
  // 忽略"重置时仍停留在某个站点页"的活动心跳，直到玩家离开该页再回来。
  _idleIgnorePage = readSiteActivityPage()
  _idleSeen.clear()
  emit()
}

/** 新周目监听：存档回到"无证据/无谜题/未结局"时清一次 shell 运行态。 */
export function watchNewGameReset(): () => void {
  const isFresh = (s: ReturnType<typeof useGameStore.getState>): boolean =>
    s.collectedEvidenceIds.length === 0 &&
    s.solvedPuzzleIds.length === 0 &&
    !s.finished &&
    !s.endingId
  let wasFresh = isFresh(useGameStore.getState())
  return useGameStore.subscribe((s) => {
    const fresh = isFresh(s)
    if (fresh && !wasFresh) resetShellRuntime()
    wasFresh = fresh
  })
}

// ===== 游戏态驱动的短信推送（sms.json 的 pushTriggerPuzzleId / pushTriggerEndingId / chapterEntered）=====
let _smsWired = false

/**
 * 按 gameStore 状态补投短信（数据驱动，不在代码里硬编码短信 id）。
 *
 * 覆盖三类声明式触发：
 *  - pushTriggerPuzzleId（可叠加 pushTriggerEndingId 门控）：谜题解开/结局达成时投递；
 *  - chapterEntered：进入指定章节时投递；
 *  - askedContact 由 SmsApp 的对话流程直接投递（不在此重复）；
 *  - idleOnPage 由 watchSiteIdleSms 依据站点活动心跳投递。
 * risk 事件（pushTriggerRiskEventId）随 RiskService 删除而永久失效，不处理。
 */
export function watchSmsTriggers(): void {
  if (_smsWired) return
  _smsWired = true
  const evaluate = (): void => {
    const s = useGameStore.getState()
    for (const ev of getAllSmsEvents()) {
      if (runtimeState.deliveredSmsIds.includes(ev.id)) continue
      if (ev.pushTriggerPuzzleId) {
        if (!s.solvedPuzzleIds.includes(ev.pushTriggerPuzzleId)) continue
        if (ev.pushTriggerEndingId && s.endingId !== ev.pushTriggerEndingId) continue
        deliverSms(ev.id)
        continue
      }
      const trigger = ev.pushTrigger
      if (trigger?.kind === 'chapterEntered' && s.currentChapterId === trigger.chapterId) {
        deliverSms(ev.id)
      }
    }
  }
  evaluate()
  useGameStore.subscribe(evaluate)
  setInterval(evaluate, 2000)
}

// ===== 站点停留（idleOnPage）→ 短信 =====
/** 站点活动心跳键（sites/shared/gameEvent 写入，手机标签页读取；同源 localStorage 跨标签可见）。 */
export const SITE_ACTIVITY_KEY = 'webgame-site-activity'
let _idleWired = false
let _idleIgnorePage: string | null = null
const _idleSeen = new Map<string, number>()

function readSiteActivityPage(): string | null {
  try {
    const raw = localStorage.getItem(SITE_ACTIVITY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { pageId?: unknown }
    return typeof parsed.pageId === 'string' ? parsed.pageId : null
  } catch {
    return null
  }
}

/**
 * 监听站点活动心跳：同一页面连续停留达到数据声明的 seconds 时投递 idleOnPage 短信。
 * 心跳 >12s 未刷新视为已离开（站点关闭/切换），重置计时。
 */
export function watchSiteIdleSms(): void {
  if (_idleWired) return
  _idleWired = true
  setInterval(() => {
    interface Activity { pageId?: unknown; at?: unknown }
    let activity: Activity | null = null
    try {
      activity = JSON.parse(localStorage.getItem(SITE_ACTIVITY_KEY) ?? 'null') as Activity | null
    } catch {
      activity = null
    }
    const pageId = typeof activity?.pageId === 'string' ? activity.pageId : null
    const at = typeof activity?.at === 'number' ? activity.at : 0
    if (!pageId || Date.now() - at > 12_000) {
      _idleSeen.clear()
      // 页面已关闭/心跳过期：解除"重置后忽略该页"的标记，避免以后再也收不到该页的 idle 短信。
      _idleIgnorePage = null
      return
    }
    if (_idleIgnorePage && _idleIgnorePage !== pageId) _idleIgnorePage = null
    if (_idleIgnorePage === pageId) return
    if (!_idleSeen.has(pageId)) _idleSeen.set(pageId, Date.now())
    const dwellSec = (Date.now() - (_idleSeen.get(pageId) as number)) / 1000
    for (const ev of getAllSmsEvents()) {
      const trigger = ev.pushTrigger
      if (trigger?.kind === 'idleOnPage' && trigger.pageId === pageId && dwellSec >= trigger.seconds) {
        deliverSms(ev.id)
      }
    }
  }, 1000)
}

/** 仅测试用：重置 shell 运行态 + 计时器。 */
export function _resetShellRuntimeForTest(): void {
  if (_expiryTimer) { clearInterval(_expiryTimer); _expiryTimer = null }
  _expiryWired = false
  for (const t of toastTimers.values()) clearTimeout(t)
  toastTimers.clear()
  runtimeState = {
    notifications: [],
    fullscreenAlert: { visible: false, text: '', style: 'info' },
    toasts: [],
    shaking: false,
    redEdgeIntensity: 0,
    incomingCall: null,
    pendingAnsweredCallScriptId: null,
    deliveredSmsIds: [],
    deliveredDoorbellIds: [],
    activeDoorbellId: null,
  }
  emit()
}

// ===== 类型 re-export 便于 App agent 使用 =====
export type { SmsEvent, DoorbellEvent } from '@/types'
