/**
 * src/game/audio.ts
 *
 * 音频播放原子。
 *
 * 唯一用途：3 分钟倒计时触发的心跳循环音（audio-heartbeat），以及门铃敲门音/
 * 通话回铃音。asset 缺失时静默降级，不抛错。
 *
 * 资源解析：public/data 的 assetId 不带扩展名（audio-heartbeat），真实文件带
 * （audio-heartbeat.mp3）。经 @/utils/assetUrl 的候选 URL 依序尝试，404 自动推进。
 */
import { getSettings } from './settingsStore'
import { mediaUrlCandidates } from '@/utils/assetUrl'

const pool = new Map<string, HTMLAudioElement>()

/** 依序尝试候选 URL，全部失败则放弃（静默）。 */
function tryPlay(assetId: string, candidates: string[], idx: number, loop: boolean): void {
  if (idx >= candidates.length) return
  let audio: HTMLAudioElement
  try {
    audio = new Audio(candidates[idx])
  } catch {
    return
  }
  const { masterVolume, sfxVolume } = getSettings()
  audio.volume = Math.max(0, Math.min(1, masterVolume * sfxVolume))
  audio.loop = loop
  audio.onerror = () => {
    pool.delete(assetId)
    tryPlay(assetId, candidates, idx + 1, loop)
  }
  const p = audio.play()
  if (p !== undefined) {
    p.catch(() => {
      // 自动播放策略拦截（非文件缺失）：不推进候选，等下一次用户手势触发的 play()
      pool.delete(assetId)
    })
  }
  pool.set(assetId, audio)
}

/** 播放某音频（同名先停）。loop=true 循环（心跳用）。音量按主音量*音效音量。 */
export function play(assetId: string, loop = false): void {
  try {
    stop(assetId)
    tryPlay(assetId, mediaUrlCandidates(assetId), 0, loop)
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
