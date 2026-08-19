/**
 * src/engine/feedback/AudioService.ts
 *
 * 音频反馈服务（CLAUDE.md agent 定义 §feedback）。
 *
 * 数据驱动：音频 assetId → 实际 <audio> 元素，按 AssetRegistry 解析 URL。
 * 支持循环（心跳 audio-heartbeat / 门铃敲击 audio-doorbell-knock）。
 *
 * 触发源：
 *  - EffectExecutor.playAudio(assetId, loop)
 *  - RiskService risk>70 → 自启 audio-heartbeat 循环
 *  - 倒计时 tick 期间低频心跳
 *  - 门铃事件 audio.loop
 *
 * 音量由 settingsStore.masterVolume / sfxVolume 控制。
 */

import { emit, on } from '@/engine/eventBus'
import { getSettings } from '@/engine/store/settingsStore'
import { isRedAlert } from '@/engine/risk/RiskService'

/** assetId → 音频 URL 解析（由前端 AssetRegistry 注入；默认走 public/assets/<id>.mp3）。 */
let _assetResolver: ((assetId: string) => string | undefined) | null = null

export function bindAssetResolver(fn: (assetId: string) => string | undefined): void {
  _assetResolver = fn
}

/** 活跃音频实例表：assetId → HTMLAudioElement。 */
const _active = new Map<string, HTMLAudioElement>()

function resolveUrl(assetId: string): string | undefined {
  if (_assetResolver) {
    const u = _assetResolver(assetId)
    if (u) return u
  }
  // 默认：public/assets/<assetId>.mp3；import.meta.env.BASE_URL 原样出现（CLAUDE.md §2）
  return `${import.meta.env.BASE_URL}assets/${assetId}.mp3`
}

/** 播放音频。loop=true 创建独立循环实例（如心跳）。 */
export function play(assetId: string, loop?: boolean): void {
  stop(assetId) // 同 id 先停
  const url = resolveUrl(assetId)
  if (!url) return
  try {
    const audio = new Audio(url)
    const settings = getSettings()
    audio.volume = settings.sfxVolume * settings.masterVolume
    audio.loop = !!loop
    audio.play().catch((e) => {
      // 浏览器自动播放策略拦截：静默失败（用户首次交互后通常可播）
      console.warn(`[AudioService] play 拦截 ${assetId}`, e)
    })
    _active.set(assetId, audio)
    emit('audioPlayed', { assetId, loop })
  } catch (e) {
    console.warn('[AudioService] 创建 Audio 失败', assetId, e)
  }
}

/** 停止音频（assetId 缺省停全部）。 */
export function stop(assetId?: string): void {
  if (assetId) {
    const a = _active.get(assetId)
    if (a) {
      a.pause()
      a.currentTime = 0
      a.src = ''
      _active.delete(assetId)
    }
    emit('audioStopped', { assetId })
  } else {
    for (const [, a] of _active) {
      a.pause()
      a.currentTime = 0
      a.src = ''
    }
    _active.clear()
    emit('audioStopped', {})
  }
}

/** 是否在播某音频。 */
export function isPlaying(assetId: string): boolean {
  return _active.has(assetId)
}

/** 心跳管理：risk>70 启 / 否则停。 */
export function syncHeartbeatWithRisk(): void {
  if (isRedAlert()) {
    if (!isPlaying('audio-heartbeat')) play('audio-heartbeat', true)
  } else {
    if (isPlaying('audio-heartbeat')) stop('audio-heartbeat')
  }
}

let _heartInit = false
/** 启动心跳风险监听（engine 初始化时调用一次）。 */
export function initHeartbeatWatcher(): void {
  if (_heartInit) return
  _heartInit = true
  on('riskChanged', () => syncHeartbeatWithRisk())
}
