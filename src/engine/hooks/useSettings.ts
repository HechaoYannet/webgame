/**
 * src/engine/hooks/useSettings.ts
 *
 * 用户偏好 hook（CLAUDE.md §hooks）。
 */

import { useSettingsStore } from '@/engine/store/settingsStore'

export function useSettings() {
  const masterVolume = useSettingsStore((s) => s.masterVolume)
  const sfxVolume = useSettingsStore((s) => s.sfxVolume)
  const vibrationEnabled = useSettingsStore((s) => s.vibrationEnabled)
  const subtitlesEnabled = useSettingsStore((s) => s.subtitlesEnabled)
  const onboarded = useSettingsStore((s) => s.onboarded)
  const setMasterVolume = useSettingsStore((s) => s.setMasterVolume)
  const setSfxVolume = useSettingsStore((s) => s.setSfxVolume)
  const setVibrationEnabled = useSettingsStore((s) => s.setVibrationEnabled)
  const setSubtitlesEnabled = useSettingsStore((s) => s.setSubtitlesEnabled)
  const setOnboarded = useSettingsStore((s) => s.setOnboarded)

  return {
    masterVolume,
    sfxVolume,
    vibrationEnabled,
    subtitlesEnabled,
    onboarded,
    setMasterVolume,
    setSfxVolume,
    setVibrationEnabled,
    setSubtitlesEnabled,
    setOnboarded,
  }
}
