/**
 * src/game/audio.ts
 *
 * 音频播放原子（搬迁自 src/engine/feedback/AudioService，剥离 eventBus/日志）。
 *
 * 唯一用途：3 分钟倒计时触发的心跳循环音（audio-heartbeat），以及门铃敲门音/
 * 通话回铃音。asset 缺失（当前 public/assets/ 为空）时静默降级，不抛错。
 *
 * 用法：手机外壳/PhoneApp 直接调 play('audio-heartbeat', true) / stop('audio-heartbeat')。
 */
import { getSettings } from './settingsStore'

const pool = new Map<string, HTMLAudioElement>()

function resolveUrl(assetId: string): string {
  // import.meta.env.BASE_URL 必须原样出现（CLAUDE.md §2，构建时静态替换）
  return `${import.meta.env.BASE_URL}assets/${assetId}`
}

/** 播放某音频（同名先停）。loop=true 循环（心跳用）。音量按主音量*音效音量。 */
export function play(assetId: string, loop = false): void {
  try {
    stop(assetId)
    const audio = new Audio(resolveUrl(assetId))
    const { masterVolume, sfxVolume } = getSettings()
    audio.volume = Math.max(0, Math.min(1, masterVolume * sfxVolume))
    audio.loop = loop
    void audio.play().catch(() => {
      // 自动播放策略拦截或文件缺失：静默降级
    })
    pool.set(assetId, audio)
  } catch {
    // 忽略
  }
}

/** 停止某音频（assetId 省略则停全部）。 */
export function stop(assetId?: string): void {
  if (assetId) {
    const a = pool.get(assetId)
    if (a) {
      try {
        a.pause()
        a.currentTime = 0
      } catch {
        // 忽略
      }
      pool.delete(assetId)
    }
    return
  }
  for (const a of pool.values()) {
    try {
      a.pause()
      a.currentTime = 0
    } catch {
      // 忽略
    }
  }
  pool.clear()
}

/** 是否正在播放。 */
export function isPlaying(assetId: string): boolean {
  return pool.has(assetId)
}
