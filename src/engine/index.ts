/**
 * src/engine/index.ts
 *
 * 引擎聚合入口：
 *  1. 绑定 EffectHandlers（把 EffectExecutor 的 14 种 effect 接到实际 store/services）
 *  2. 启动 ChapterDirector / 心跳监听
 *  3. 对外导出统一 API
 */

import { bindEffectHandlers, enableEffectLogging, type EffectHandlers } from './puzzle/EffectExecutor'
import { initChapterDirector, reevaluateChapters } from './chapter/ChapterDirector'
import { initHeartbeatWatcher } from './feedback/AudioService'
import { getGameStore } from './store/gameStore'
import * as RiskService from './risk/RiskService'
import {
  initRiskEventDispatcher,
  resetRiskEventDispatcher,
  riskOnAskedContact,
  dispatchVisitSensitivePage,
} from './risk/RiskEventDispatcher'
import * as RiskEventDispatcher from './risk/RiskEventDispatcher'
import * as CountdownService from './countdown/CountdownService'
import * as EvidenceService from './evidence/EvidenceService'
import * as ClueRegistry from './clue/ClueRegistry'
import * as PuzzleService from './puzzle/PuzzleService'
import * as AudioService from './feedback/AudioService'
import * as HapticsService from './feedback/HapticsService'
import * as AlertService from './feedback/AlertService'
import * as SmsService from './feedback/SmsService'
import * as DoorbellService from './feedback/DoorbellService'
import * as AppNavigationService from './feedback/AppNavigationService'
import { on } from './eventBus'

let _initialized = false

/** 引擎初始化（App 顶层调用一次，幂等）。 */
export function initEngine(): void {
  if (_initialized) return
  _initialized = true

  // 1) 绑定效应处理器
  const handlers: EffectHandlers = {
    addRisk: (amount) => RiskService.addRisk(amount),
    removeRisk: (amount) => RiskService.removeRisk(amount),
    startCountdown: (id, sec) => CountdownService.startCountdown(id, sec),
    advanceChapter: (chapterId) => {
      // advanceChapter effect 直接进入目标章节（绕过 enterCondition 评估）
      getGameStore().advanceChapter(chapterId)
      reevaluateChapters()
    },
    pushSms: (smsEventId) => SmsService.pushSms(smsEventId),
    pushDoorbell: (doorbellEventId) => DoorbellService.pushDoorbell(doorbellEventId),
    registerClue: (clueId) => ClueRegistry.registerClue(clueId),
    collectEvidence: (evidenceId) => EvidenceService.collect(evidenceId),
    playAudio: (assetId, loop) => AudioService.play(assetId, loop),
    stopAudio: (assetId) => AudioService.stop(assetId),
    vibrate: () => HapticsService.vibrate('long'),
    fullscreenAlert: (text) => AlertService.fullscreenAlert(text, 'danger'),
    pushEnding: (endingId) => {
      const store = getGameStore()
      store.pushEnding(endingId)
    },
    openNewsApp: (endingId) => AppNavigationService.openNewsApp(endingId),
    openApp: (appId) => AppNavigationService.openApp(appId),
  }
  bindEffectHandlers(handlers)

  // 开发期开启 effect 日志（reviewer 离线验证用）
  enableEffectLogging(true)

  // 2) 启动 ChapterDirector（监听 puzzleSolved/evidenceCollected/clueRegistered/pageFirstVisited）
  initChapterDirector()

  // 3) 心跳监听（risk>70 启 audio-heartbeat）
  initHeartbeatWatcher()

  // 4) 风险事件分发器（REVIEW_REPORT H4）：监听 pageFirstVisited → visitSensitivePage 加风险；
  //    askedContact 由 WechatApp/SmsApp 主动调 riskOnAskedContact。
  initRiskEventDispatcher()

  // 5) 首次评估章节（处理已加载存档直接进入对应章节的情况）
  reevaluateChapters()
}

/** 重置全部引擎运行态（新游戏用）。 */
export function resetEngineRuntime(): void {
  getGameStore().resetGame()
  SmsService.resetSms()
  DoorbellService.resetDoorbell()
  AlertService.clearAlerts()
  AudioService.stop()
  resetRiskEventDispatcher()
}

// 统一导出常用 API
export {
  getGameStore,
  RiskService,
  CountdownService,
  EvidenceService,
  ClueRegistry,
  PuzzleService,
  AudioService,
  HapticsService,
  AlertService,
  SmsService,
  DoorbellService,
  AppNavigationService,
  RiskEventDispatcher,
  riskOnAskedContact,
  dispatchVisitSensitivePage,
  on,
}

// 子模块默认导出（便于 import { usePuzzle } from '@/engine/hooks' 这类路径聚合）
export * as store from './store/gameStore'
export * as persistence from './store/persistence'
