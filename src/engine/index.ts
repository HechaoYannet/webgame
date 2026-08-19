/**
 * src/engine/index.ts
 *
 * 引擎聚合入口（重写后，玩家决策 2026-08-19）：
 *  1. 绑定 EffectHandlers（把 EffectExecutor 现存 effect 接到 store/services）
 *  2. 启动 ChapterDirector（章节推进 + 页面 onViewEffects）
 *  3. 对外导出统一 API
 *
 * 已移除：RiskService / RiskEventDispatcher（风险值系统废除）、initHeartbeatWatcher
 * （心跳改由 playAudio effect 直接驱动，不再绑 risk>70）、ClueRegistry（线索注册装饰废除）。
 */

import { bindEffectHandlers, enableEffectLogging, type EffectHandlers } from './puzzle/EffectExecutor'
import { initChapterDirector, reevaluateChapters } from './chapter/ChapterDirector'
import { getGameStore } from './store/gameStore'
import * as CountdownService from './countdown/CountdownService'
import * as EvidenceService from './evidence/EvidenceService'
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

  // 1) 绑定效应处理器（重写后已无 addRisk/removeRisk/registerClue/openNewsApp handler）
  const handlers: EffectHandlers = {
    startCountdown: (id, sec) => CountdownService.startCountdown(id, sec),
    advanceChapter: (chapterId) => {
      // advanceChapter effect 直接进入目标章节（绕过 enterCondition 评估）
      getGameStore().advanceChapter(chapterId)
      reevaluateChapters()
    },
    pushSms: (smsEventId) => SmsService.pushSms(smsEventId),
    pushDoorbell: (doorbellEventId) => DoorbellService.pushDoorbell(doorbellEventId),
    collectEvidence: (evidenceId) => EvidenceService.collect(evidenceId),
    playAudio: (assetId, loop) => AudioService.play(assetId, loop),
    stopAudio: (assetId) => AudioService.stop(assetId),
    vibrate: () => HapticsService.vibrate('long'),
    fullscreenAlert: (text) => AlertService.fullscreenAlert(text, 'danger'),
    pushEnding: (endingId) => {
      getGameStore().pushEnding(endingId)
    },
    openApp: (appId) => AppNavigationService.openApp(appId),
  }
  bindEffectHandlers(handlers)

  // 开发期开启 effect 日志（reviewer 离线验证用）
  enableEffectLogging(true)

  // 2) 启动 ChapterDirector（监听 puzzleSolved/evidenceCollected/pageFirstVisited）
  initChapterDirector()

  // 3) 首次评估章节（处理已加载存档直接进入对应章节的情况）
  reevaluateChapters()
}

/** 重置全部引擎运行态（新游戏用）。 */
export function resetEngineRuntime(): void {
  getGameStore().resetGame()
  SmsService.resetSms()
  DoorbellService.resetDoorbell()
  AlertService.clearAlerts()
  AudioService.stop()
}

// 统一导出常用 API
export {
  getGameStore,
  CountdownService,
  EvidenceService,
  PuzzleService,
  AudioService,
  HapticsService,
  AlertService,
  SmsService,
  DoorbellService,
  AppNavigationService,
  on,
}

// 子模块默认导出（便于 import { usePuzzle } from '@/engine/hooks' 这类路径聚合）
export * as store from './store/gameStore'
export * as persistence from './store/persistence'
