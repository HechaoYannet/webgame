/**
 * src/engine/eventBus.ts
 *
 * 极轻量引擎内部事件总线。解耦 service 之间的相互监听：
 *  - PuzzleService 不直接知道 ChapterDirector / ClueRegistry / RiskService
 *  - 各 service 订阅自己关心的事件，PuzzleService 只 emit
 *
 * 事件名稳定，reviewer 可离线验证事件流。
 */

export type EngineEventName =
  | 'puzzleSolved'
  | 'puzzleFailed'
  | 'evidenceCollected'
  | 'clueRegistered'
  | 'riskChanged'
  | 'countdownStarted'
  | 'countdownExpired'
  | 'chapterAdvanced'
  | 'pageFirstVisited'
  | 'endingPushed'
  | 'smsPushed'
  | 'doorbellPushed'
  | 'audioPlayed'
  | 'audioStopped'

export interface EngineEventPayload {
  puzzleSolved: { puzzleId: string; newlySolved: boolean }
  puzzleFailed: { puzzleId: string; wrongAttempts: number; locked: boolean }
  evidenceCollected: { evidenceId: string }
  clueRegistered: { clueId: string }
  riskChanged: { risk: number; delta: number }
  countdownStarted: { countdownId: string; durationSec: number }
  countdownExpired: { countdownId: string }
  chapterAdvanced: { fromChapterId?: string; toChapterId: string }
  pageFirstVisited: { pageId: string }
  endingPushed: { endingId: 'good' | 'normal' | 'bad' }
  smsPushed: { smsEventId: string }
  doorbellPushed: { doorbellEventId: string }
  audioPlayed: { assetId: string; loop?: boolean }
  audioStopped: { assetId?: string }
}

type Handler<P> = (payload: P) => void

// 用 Record<string, Set<Function>> 承载所有事件订阅，避免联合 key 下的分布式 Set
// 类型推断冲突（TS 无法把 Set<Handler<EngineEventPayload[K]>> 收敛到具体 K 的 Set）。
// on/emit 内部做窄化 cast，对外保持类型安全。
const _handlers = new Map<EngineEventName, Set<(payload: unknown) => void>>()

export function on<K extends EngineEventName>(
  name: K,
  handler: Handler<EngineEventPayload[K]>,
): () => void {
  let set = _handlers.get(name)
  if (!set) {
    set = new Set()
    _handlers.set(name, set)
  }
  set.add(handler as (payload: unknown) => void)
  return () => {
    _handlers.get(name)?.delete(handler as (payload: unknown) => void)
  }
}

export function emit<K extends EngineEventName>(name: K, payload: EngineEventPayload[K]): void {
  const set = _handlers.get(name)
  if (!set) return
  for (const h of set) {
    try {
      ;(h as Handler<EngineEventPayload[K]>)(payload)
    } catch (err) {
      console.error(`[eventBus] handler for "${name}" 抛错`, err)
    }
  }
}

export function offAll(): void {
  for (const set of _handlers.values()) {
    set.clear()
  }
  _handlers.clear()
}
