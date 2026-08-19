/**
 * src/engine/clue/ClueRegistry.ts
 *
 * "查看即取证"核心（CLAUDE.md §4.2 + 各 agent 定义 §clue）。
 *
 * onView(payload)：
 *  1. 查 data/clustering/clue-map.json，findCluesByViewPayload 命中线索
 *  2. 对每条 autoRegisterOnView && 未注册的线索 → registerClue +
 *     emit clueRegistered +
 *     关联证据自动收集（仅 collectingCondition=='onView' 且 triggerClueId===该线索）+
 *     ScreenshotService 截图入相册（仅 collectingCondition=='onScreenshot' 也照收 onView 类）
 *     + 写备忘录（追加线索摘要到 notes）+ toast 反馈
 *  3. payload 支持 message / page / moment / article / qzone / sms / call / doorbell
 *
 * App 组件在关键交互处调 useClue().view(payload)——App 不知道哪些消息有线索，ClueRegistry 查表决定。
 */

import { getGameStore } from '@/engine/store/gameStore'
import { emit } from '@/engine/eventBus'
import { findCluesByViewPayload, getClueById, getEvidenceById, getAllEvidence, type ViewPayload } from '@/data/loader'
import * as ScreenshotService from './ScreenshotService'
import type { Clue, Evidence } from '@/types'

export interface ClueViewResult {
  /** 本次命中的线索（含未注册的）。 */
  matchedClues: Clue[]
  /** 本次新注册的线索。 */
  newlyRegistered: ClueId[]
  /** 本次新收集的证据。 */
  newlyCollected: EvidenceId[]
  /** 截图记录 id（用于 toast）。 */
  screenshotIds: string[]
  /** toast 反馈文案（注册到的线索标题），空数组表示无新发现。 */
  toasts: string[]
}

import type { ClueId, EvidenceId } from '@/types'

/**
 * 处理一次"查看"事件。
 * @param payload 视图载体
 * @param domEl 可选：截图目标 DOM（线索/证据收集时入相册）
 */
export async function onView(payload: ViewPayload, domEl?: HTMLElement | null): Promise<ClueViewResult> {
  const matched = findCluesByViewPayload(payload)
  const store = getGameStore()

  const newlyRegistered: ClueId[] = []
  const newlyCollected: EvidenceId[] = []
  const screenshotIds: string[] = []
  const toasts: string[] = []

  for (const clue of matched) {
    // 仅 autoRegisterOnView 的线索在查看时自动注册；其它（如红鲱鱼 false）忽略
    if (!clue.autoRegisterOnView) continue
    // 已注册则跳过
    if (store.registeredClueIds.includes(clue.id)) continue

    // 注册线索
    const first = store.registerClue(clue.id)
    if (!first) continue
    newlyRegistered.push(clue.id)
    emit('clueRegistered', { clueId: clue.id })
    toasts.push(`线索：${clue.title}`)

    // 关联证据自动收集：
    //  - 该线索 relatedEvidenceIds 中，证据 collectingCondition==='onView'
    //  - 或 evidence.triggerClueId 命中此 clueId
    const relatedEvidence = collectRelatedEvidence(clue)
    for (const ev of relatedEvidence) {
      if (store.collectedEvidenceIds.includes(ev.id)) continue
      const firstEv = store.collectEvidence(ev.id)
      if (firstEv) {
        newlyCollected.push(ev.id)
        emit('evidenceCollected', { evidenceId: ev.id })
        toasts.push(`证据：${ev.title}`)
        // 截图入相册
        const shotId = `shot-${ev.id}-${Date.now()}`
        ScreenshotService.capture(domEl, { id: shotId, title: ev.title, clueId: clue.id, evidenceId: ev.id })
        screenshotIds.push(shotId)
      }
    }

    // 写备忘录：追加线索摘要到调查笔记
    appendClueToNotes(clue)
  }

  return {
    matchedClues: matched,
    newlyRegistered,
    newlyCollected,
    screenshotIds,
    toasts,
  }
}

/** 收集与某线索关联、且 collectingCondition==='onView' 的证据。 */
function collectRelatedEvidence(clue: Clue): Evidence[] {
  const out: Evidence[] = []
  // 1) clue.relatedEvidenceIds
  for (const eid of clue.relatedEvidenceIds) {
    const ev = getEvidenceById(eid)
    if (ev && (ev.collectingCondition === 'onView' || ev.triggerClueId === clue.id)) {
      out.push(ev)
    }
  }
  // 2) 全局:triggerClueId===clue.id（兜底未在 relatedEvidenceIds 中声明的）
  for (const ev of getAllEvidence()) {
    if (ev.triggerClueId === clue.id && ev.collectingCondition === 'onView' && !out.includes(ev)) {
      out.push(ev)
    }
  }
  return out
}

/** 追加线索摘要到备忘录（内存态 note，UI NotesApp 读取）。 */
const _clueNotes: { id: string; title: string; body: string; createdAt: string; fromClueId: string; pinned?: boolean }[] = []
export function getClueNotes(): readonly { id: string; title: string; body: string; createdAt: string; fromClueId: string }[] {
  return _clueNotes
}
function appendClueToNotes(clue: Clue): void {
  if (_clueNotes.some((n) => n.fromClueId === clue.id)) return
  _clueNotes.push({
    id: `note-clue-${clue.id}`,
    title: clue.title,
    body: clue.summary,
    createdAt: new Date().toISOString(),
    fromClueId: clue.id,
  })
}

/** 手动注册线索（EffectExecutor registerClue / 解谜 onSuccess 触发，非 onView 路径）。 */
export function registerClue(clueId: ClueId): boolean {
  const store = getGameStore()
  const first = store.registerClue(clueId)
  if (!first) return false
  emit('clueRegistered', { clueId })
  const clue = getClueById(clueId)
  if (clue) {
    toasts_push(`线索：${clue.title}`)
    appendClueToNotes(clue)
  }
  return true
}

// 临时 toast 队列（UI useClue 取走）
const _toastQueue: string[] = []
function toasts_push(t: string): void {
  _toastQueue.push(t)
}
export function drainToasts(): string[] {
  const out = [..._toastQueue]
  _toastQueue.length = 0
  return out
}

/** 已注册线索清单（对象）。 */
export function getRegisteredClues(): Clue[] {
  const ids = getGameStore().registeredClueIds
  const out: Clue[] = []
  for (const id of ids) {
    const c = getClueById(id)
    if (c) out.push(c)
  }
  return out
}

/** 单纯查询 onView 命中但不强制注册（UI 预览）。 */
export function previewMatched(payload: ViewPayload): Clue[] {
  return findCluesByViewPayload(payload)
}

export { getClueById }
