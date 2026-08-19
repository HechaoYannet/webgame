/**
 * src/engine/store/settingsStore.ts
 *
 * 用户偏好（音量/震动/字幕开关），独立 persist（CLAUDE.md §2）。
 * 与 gameStore 分离：清除存档时不影响用户偏好；清除偏好时不影响游戏进度。
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface SettingsState {
  /** 主音量 0..1。 */
  masterVolume: number
  /** 音效音量 0..1。 */
  sfxVolume: number
  /** 是否开启震动（移动端 navigator.vibrate / 桌面 CSS 抖动）。 */
  vibrationEnabled: boolean
  /** 是否显示字幕（语音/通话字幕兜底，无障碍）。 */
  subtitlesEnabled: boolean
  /** 是否已接受开场提示/首次进入引导。 */
  onboarded: boolean
  // actions
  setMasterVolume: (v: number) => void
  setSfxVolume: (v: number) => void
  setVibrationEnabled: (v: boolean) => void
  setSubtitlesEnabled: (v: boolean) => void
  setOnboarded: (v: boolean) => void
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      masterVolume: 0.8,
      sfxVolume: 0.8,
      vibrationEnabled: true,
      subtitlesEnabled: true,
      onboarded: false,
      setMasterVolume: (v) => set({ masterVolume: clamp01(v) }),
      setSfxVolume: (v) => set({ sfxVolume: clamp01(v) }),
      setVibrationEnabled: (v) => set({ vibrationEnabled: v }),
      setSubtitlesEnabled: (v) => set({ subtitlesEnabled: v }),
      setOnboarded: (v) => set({ onboarded: v }),
    }),
    {
      name: 'webgame-settings',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // 全部字段都持久化
      partialize: (s) => s,
    },
  ),
)

/** 非 React 上下文取值用（services 内）。 */
export function getSettings(): SettingsState {
  return useSettingsStore.getState()
}
