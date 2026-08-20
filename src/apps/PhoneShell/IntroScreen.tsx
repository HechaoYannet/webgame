/**
 * src/apps/PhoneShell/IntroScreen.tsx
 *
 * 游戏入口主站（玩家需求 2026-08-21）：全屏电影感开场。
 *
 * 触发逻辑（确定性，依据持久化存档，不再用 sessionStorage）：
 *   - finished === false 且 solvedPuzzleIds 为空 → 是全新开局，显示入口。
 *   - 有已解谜题 / 已达结局 → 视为有在玩/已通关的进度，直接进游戏不打断。
 *   resetGame() 后存档清空（solvedPuzzleIds=[]、finished=false）→ 自然回到入口。
 *   因此「清空本地存档」按钮 = resetGame()，落地页上随时可点。
 *
 * 两阶段状态机：
 *   'landing'   — 游戏宣传页（标题 + 介绍 + 玩法要点 + 开始游戏按钮）。
 *                 有未结束存档时显示「继续游戏」（跳过字幕直接进）。
 *                 附「清空本地存档」按钮（带二次确认）。
 *   'cinematic' — 点击「开始游戏」后，全屏黑底、居中逐行淡入淡出的前情提要字幕。
 *                 可「跳过」；末条淡出后自动进入游戏。
 *
 * 进入游戏：onEnter() → 由 App.tsx 卸载本组件，露出下层 AppRouter/PhoneShell。
 * 本组件是 position:fixed;inset:0;z-index:1000 的全视口覆盖层。
 *
 * 前情提要是 meta 开场文案，写死在本组件（非解谜数据），不入 public/data，
 * 不与"前端不生成谜题数据"契约冲突；谜题答案仍只在 puzzles.json。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import { useGameStore } from '@/game/gameStore'
import { palette, radius, spacing } from '@/ui/theme'

/** 前情提要字幕（改编自剧情大纲序幕，不剧透谜题答案）。 */
const CINEMATIC_LINES: readonly string[] = [
  '2026年3月12日，周五，绿草中学男生宿舍。',
  '林哲和好友李桥瑞聊着即将公测的《明日方舟：终末地》。',
  '李桥瑞压低声音说：“今晚，我要干件大事。”',
  '随后他和闫欣泽被宿管带走，彻夜未归。',
  '第二天，班主任说：“家长已经把他接走了。”',
  '可他的微信再没有回复，朋友圈只留下一句——“兄弟们，终末地见！”',
  '现在，你拿到了他的手机……',
]

type Phase = 'landing' | 'cinematic'

export function IntroScreen({ onEnter }: { onEnter: () => void }): ReactElement {
  const [phase, setPhase] = useState<Phase>('landing')

  function enter() {
    onEnter()
  }

  return (
    <div style={overlayStyle}>
      {phase === 'landing' ? (
        <Landing
          onStart={() => setPhase('cinematic')}
          onContinue={enter}
        />
      ) : (
        <Cinematic onDone={enter} />
      )}
    </div>
  )
}

// ===== 视口覆盖层 =====
const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: `radial-gradient(circle at 50% 35%, ${palette.bgScreen} 0%, ${palette.bgDarkest} 70%, #000 100%)`,
  color: palette.textPrimary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif',
}

// ===== 阶段 A：landing 宣传页 =====
function Landing({
  onStart,
  onContinue,
}: {
  onStart: () => void
  onContinue: () => void
}): ReactElement {
  // 已有未结束存档 → 显示「继续游戏」。
  const hasProgress = useGameStore((s) => s.solvedPuzzleIds.length > 0 && !s.finished)
  const resetGame = useGameStore((s) => s.resetGame)

  const [confirmingReset, setConfirmingReset] = useState(false)

  function handleClearSave() {
    if (!confirmingReset) {
      setConfirmingReset(true)
      return
    }
    // 二次确认 → 清空存档。
    resetGame()
    setConfirmingReset(false)
  }

  return (
    <div style={landingWrapStyle}>
      <div style={kickerStyle}>互动解谜 · 模拟手机调查</div>

      <h1 style={titleStyle}>张强宿舍大逃杀</h1>
      <div style={dividerStyle} />

      <p style={introTextStyle}>
        你的同学李桥瑞一夜之间失联，班主任说“家长已经把他接走了”，
        可他的微信再没有回复。
      </p>
      <p style={introTextStyle}>
        你拿到了他的手机。翻看微信、QQ、浏览器、短信……
        在无数条真假难辨的信息里，拼出真相，收集证据，
        在倒计时归零前，拨通报警电话。
      </p>

      <ul style={featuresStyle}>
        <li>九大 App 自由索证：微信 / QQ / 浏览器 / 短信 / 电话 / 门铃 / 相册 / 文件 / 备忘录</li>
        <li>真实网页交叉验证：官网、天眼查、论文、公众号……线索藏在字里行间</li>
        <li>三种结局：证据是否充分、倒计时是否守住，决定谁还能被救回</li>
      </ul>

      <div style={buttonRowStyle}>
        <button type="button" style={primaryBtnStyle} onClick={onStart}>
          {hasProgress ? '重新开始（看开场）' : '开始游戏'}
        </button>
        {hasProgress ? (
          <button type="button" style={secondaryBtnStyle} onClick={onContinue}>
            继续游戏
          </button>
        ) : null}
      </div>

      <button
        type="button"
        style={confirmingReset ? resetBtnConfirmStyle : resetBtnStyle}
        onClick={handleClearSave}
        aria-label="清空本地存档"
      >
        {confirmingReset
          ? '再点一次确认清空存档'
          : hasProgress
            ? '清空本地存档'
            : '清空本地存档（无存档）'}
      </button>

      <div style={footnoteStyle}>建议在桌面浏览器全屏体验</div>
    </div>
  )
}

const landingWrapStyle: CSSProperties = {
  width: 'min(680px, 92vw)',
  maxHeight: '92vh',
  overflowY: 'auto',
  textAlign: 'center',
  padding: `${spacing.xl}px ${spacing.xl}px ${spacing.lg}px`,
  scrollbarWidth: 'thin',
}

const kickerStyle: CSSProperties = {
  fontSize: 12,
  letterSpacing: 3,
  color: palette.textTertiary,
  textTransform: 'none',
  marginBottom: spacing.md,
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 'clamp(34px, 6vw, 56px)',
  fontWeight: 800,
  letterSpacing: 2,
  color: palette.textPrimary,
  textShadow: '0 2px 24px rgba(0,0,0,0.6)',
}

const dividerStyle: CSSProperties = {
  width: 56,
  height: 2,
  margin: `${spacing.md}px auto ${spacing.lg}px`,
  background: palette.danger,
  opacity: 0.8,
}

const introTextStyle: CSSProperties = {
  margin: `0 0 ${spacing.md}px`,
  fontSize: 'clamp(14px, 1.6vw, 16px)',
  lineHeight: 1.8,
  color: palette.textSecondary,
}

const featuresStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: `${spacing.lg}px 0 ${spacing.xl}px`,
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.xs,
  textAlign: 'left',
  width: 'fit-content',
  marginInline: 'auto',
  color: palette.textTertiary,
  fontSize: 13,
  lineHeight: 1.7,
}

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: spacing.md,
  justifyContent: 'center',
  flexWrap: 'wrap',
  marginTop: spacing.xl,
}

const primaryBtnStyle: CSSProperties = {
  padding: `${spacing.sm}px ${spacing.xl}px`,
  fontSize: 16,
  fontWeight: 600,
  color: '#fff',
  background: palette.danger,
  border: 'none',
  borderRadius: radius.pill,
  cursor: 'pointer',
  letterSpacing: 2,
  boxShadow: '0 6px 20px rgba(239,68,68,0.35)',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
}

const secondaryBtnStyle: CSSProperties = {
  padding: `${spacing.sm}px ${spacing.xl}px`,
  fontSize: 16,
  fontWeight: 600,
  color: palette.textPrimary,
  background: 'transparent',
  border: `1px solid ${palette.borderLight}`,
  borderRadius: radius.pill,
  cursor: 'pointer',
  letterSpacing: 2,
  transition: 'border-color 0.15s ease, color 0.15s ease',
}

const resetBtnStyle: CSSProperties = {
  marginTop: spacing.lg,
  background: 'transparent',
  border: 'none',
  color: palette.textTertiary,
  fontSize: 12,
  cursor: 'pointer',
  padding: `${spacing.xs}px ${spacing.md}px`,
  opacity: 0.7,
  transition: 'opacity 0.15s ease, color 0.15s ease',
}

const resetBtnConfirmStyle: CSSProperties = {
  marginTop: spacing.lg,
  background: 'transparent',
  border: `1px solid ${palette.danger}`,
  color: palette.danger,
  fontSize: 12,
  cursor: 'pointer',
  borderRadius: radius.pill,
  padding: `${spacing.xs}px ${spacing.md}px`,
  transition: 'opacity 0.15s ease',
}

const footnoteStyle: CSSProperties = {
  marginTop: spacing.xl,
  fontSize: 11,
  color: palette.textTertiary,
  opacity: 0.7,
}

// ===== 阶段 B：cinematic 电影字幕 =====
/**
 * 逐行淡入淡出。每条字幕一个周期：
 *   fadeInMs → holdMs → fadeOutMs → 下一条。
 * RAF 驱动 opacity 插值；reduced-motion 时压缩为极短。
 */
function Cinematic({ onDone }: { onDone: () => void }): ReactElement {
  const [index, setIndex] = useState(0)
  const [opacity, setOpacity] = useState(0)

  const reduced = usePrefersReducedMotion()

  // 每行时序（ms）。reduced-motion 下大幅压缩，仍可完整走完。
  const timing = useMemo(
    () => (reduced ? { fadeIn: 80, hold: 400, fadeOut: 60, gap: 120 } : { fadeIn: 1200, hold: 2200, fadeOut: 1000, gap: 300 }),
    [reduced],
  )

  // RAF 时序引擎：维护当前阶段 + 阶段起点时间戳，驱动 opacity / 推进 index。
  // 关键：onDone 用 ref 缓存，避免因父级回调变化重启 effect 导致字幕卡死/乱跳。
  const rafRef = useRef<number | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  useEffect(() => {
    const t = timing
    let stage: 'in' | 'hold' | 'out' | 'gap' | 'done' = 'in'
    let stageStart = 0
    let cancelled = false

    function tick(now: number) {
      if (cancelled) return
      if (stageStart === 0) stageStart = now
      const elapsed = now - stageStart

      switch (stage) {
        case 'in': {
          const p = Math.min(1, elapsed / t.fadeIn)
          setOpacity(p)
          if (p >= 1) {
            stage = 'hold'
            stageStart = now
          }
          break
        }
        case 'hold': {
          setOpacity(1)
          if (elapsed >= t.hold) {
            stage = 'out'
            stageStart = now
          }
          break
        }
        case 'out': {
          const p = Math.max(0, 1 - elapsed / t.fadeOut)
          setOpacity(p)
          if (p <= 0) {
            // 末条淡出完毕 → 进入游戏。
            setIndex((i) => {
              if (i >= CINEMATIC_LINES.length - 1) {
                // 在 setState 回调里触发 done 不稳妥，改在 gap 末尾。
                stage = 'done'
                stageStart = now
                return i
              }
              stage = 'gap'
              stageStart = now
              return i
            })
          }
          break
        }
        case 'gap': {
          setOpacity(0)
          if (elapsed >= t.gap) {
            setIndex((i) => Math.min(i + 1, CINEMATIC_LINES.length - 1))
            stage = 'in'
            stageStart = now
          }
          break
        }
        case 'done': {
          setOpacity(0)
          if (elapsed >= t.gap) {
            cancelled = true
            onDoneRef.current()
            return
          }
          break
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [timing])

  // 键盘：空格/回车跳过当前剩余，Esc 直接进入。
  // 同样用 ref 避免回调变化时反复增删监听。
  const onDoneRef2 = useRef(onDone)
  onDoneRef2.current = onDone
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        onDoneRef2.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        key={index}
        style={{
          maxWidth: 'min(760px, 86vw)',
          padding: `0 ${spacing.xl}px`,
          textAlign: 'center',
          fontSize: 'clamp(18px, 2.6vw, 26px)',
          fontWeight: 500,
          lineHeight: 1.9,
          letterSpacing: 1.5,
          color: '#e8e8ea',
          opacity,
          textShadow: '0 2px 16px rgba(0,0,0,0.8)',
          transition: 'none',
        }}
      >
        {CINEMATIC_LINES[index]}
      </div>

      <button
        type="button"
        onClick={onDone}
        style={{
          position: 'absolute',
          right: spacing.xl,
          bottom: spacing.xl,
          background: 'transparent',
          border: `1px solid ${palette.border}`,
          color: palette.textTertiary,
          padding: `${spacing.xs}px ${spacing.md}px`,
          borderRadius: radius.pill,
          fontSize: 13,
          cursor: 'pointer',
          letterSpacing: 1,
          transition: 'color 0.15s ease, border-color 0.15s ease',
        }}
      >
        跳过 ⏭
      </button>
    </div>
  )
}

/** 监听 prefers-reduced-motion，返回布尔（SSR/无 matchMedia 时默认 false）。 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    function onChange() {
      setReduced(mq.matches)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}
