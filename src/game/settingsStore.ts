/**
 * src/game/settingsStore.ts
 *
 * 用户偏好（音量/震动/字幕），独立 persist（搬迁自 src/engine/store/settingsStore.ts）。
 * 与 gameStore 分离：清存档不影响偏好，清偏好不影响进度。
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface SettingsState {
  /** 主音量 0..1。 */
  masterVolume: number
  /** 音效音量 0..1。 */
  sfxVolume: number
  /** 是否开启震动（桌面 CSS 抖动 / 移动端 navigator.vibrate）。 */
  vibrationEnabled: boolean
  /** 是否显示字幕。 */
  subtitlesEnabled: boolean
  /** 是否已接受开场引导。 */
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

/** 非 React 上下文取值用。 */
export function getSettings(): SettingsState {
  return useSettingsStore.getState()
}
