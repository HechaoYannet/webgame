/**
 * src/apps/PhoneShell/IntroScreen.tsx
 *
 * 游戏入口主站（全屏电影感开场）。
 *
 * 触发逻辑（确定性，依据持久化在 localStorage 的存档）：
 *   - finished === false 且 solvedPuzzleIds 为空 → 全新开局，显示入口。
 *   - 有已解谜题 或 已达结局 → 视为有在玩/已通关，直接进游戏不打断。
 *   resetGame() 后存档清空 → 自然回到入口。
 *
 * 两阶段状态机：
 *   'landing'   — 证物档案式的宣传页：监控 HUD、证物照片、编号、玩法目录。
 *                 有未结束存档时显示「继续游戏」。可清空本地存档（二次确认）。
 *   'cinematic' — 全屏黑底、上下遮幅、逐行淡入淡出的前情提要字幕，可跳过。
 *
 * 氛围（2026-11 改版）：标题偶尔跳帧、久留后浮出半句话、右侧是"校园后墙"的
 * 证物照片（红圈圈住地上的钥匙）。恐怖不靠鬼脸，靠"这张照片本来不该被拍下来"。
 *
 * 进入游戏：onEnter() → 由 App.tsx 卸载本组件，露出下层 AppRouter/PhoneShell。
 * 本组件是 position:fixed;inset:0;z-index:1000 的全视口覆盖层。
 *
 * 前情提要是 meta 开场文案，写死在本组件（非解谜数据），不入 public/data，
 * 不与"前端不生成谜题数据"契约冲突；谜题答案仍只在 puzzles.json。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { useGameStore } from '@/game/gameStore'
import './intro.css'

/** 前情提要字幕（改编自剧情大纲序幕，不剧透谜题答案）。 */
const CINEMATIC_LINES: readonly string[] = [
  '2026年3月12日，周四，绿草中学男生宿舍。',
  '林哲和好友李桥瑞聊着即将公测的《明日方舟：终末地》。',
  '李桥瑞压低声音说：“今晚，我要干件大事。”',
  '那一夜，他被宿管带走，此后再没有回来。',
  '第二天，班主任说：“家长已经把他接走了。”',
  '可他的微信再没有回复，朋友圈只留下一句——“兄弟们，终末地见！”',
  '现在，你拿到了他的手机……',
]

/** 背景 / 证物照片：校园后墙夜景（同一张图在数据里的 assetId 为 qzone-li-0309-backwall-img）。 */
const WALL_URL = `${import.meta.env.BASE_URL}assets/qzone-li-0309-backwall-img.jpg`

type Phase = 'landing' | 'cinematic'

export function IntroScreen({ onEnter }: { onEnter: () => void }): ReactElement {
  const [phase, setPhase] = useState<Phase>('landing')

  return (
    <div className="intro">
      {phase === 'landing' ? (
        <Landing onStart={() => setPhase('cinematic')} onContinue={onEnter} />
      ) : (
        <Cinematic onDone={onEnter} />
      )}
    </div>
  )
}

// ===== 阶段 A：landing 宣传页 =====

function Landing({ onStart, onContinue }: { onStart: () => void; onContinue: () => void }): ReactElement {
  // 已有未结束存档 → 显示「继续游戏」。
  const hasProgress = useGameStore((s) => s.solvedPuzzleIds.length > 0 && !s.finished)
  const resetGame = useGameStore((s) => s.resetGame)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [hint, setHint] = useState<{ id: number; text: string } | null>(null)

  // 久留：第 16 秒、第 46 秒各浮出半句话。只是一句"房间里的声音"，不涉及剧情。
  useEffect(() => {
    const t1 = window.setTimeout(() => setHint({ id: 1, text: '门没有锁。' }), 16_000)
    const t2 = window.setTimeout(() => setHint({ id: 2, text: '开始以后，就别回头了。' }), 46_000)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [])

  function handleClearSave() {
    if (!confirmingReset) {
      setConfirmingReset(true)
      return
    }
    resetGame()
    setConfirmingReset(false)
  }

  return (
    <>
      <div className="intro-bg" aria-hidden="true">
        <div className="intro-photo" style={{ backgroundImage: `url(${WALL_URL})` }} />
        <div className="intro-grade" />
        <div className="intro-scan" />
        <div className="intro-grain" />
        <div className="intro-vignette" />
      </div>

      <header className="intro-hud">
        <div className="hud-left">
          <span className="hud-rec">REC</span>
          <span>CAM 03 · 定点回放</span>
          <span className="hud-sep" />
          <span>2026-03-13 15:02:11</span>
        </div>
        <div className="hud-right">
          <span>CASE FILE 03-13</span>
          <span className="hud-sep" />
          <span>湖南 · 绿草中学</span>
        </div>
      </header>

      <div className="intro-rail" aria-hidden="true">
        CASE 03-13 · 绿草中学 · 2026
      </div>

      <main className="intro-main">
        <div className="intro-grid">
          <div className="intro-copy">
            <p className="intro-kicker">互动解谜 · 模拟手机调查</p>

            <h1 className="intro-title" data-text="张强宿舍大逃杀">
              张强宿舍大逃杀
            </h1>

            <div className="intro-meta">
              <span>2026.03.13</span>
              <i className="dot" />
              <span className="meta-en">THE DORMITORY</span>
              <i className="dot" />
              <span>单人 · 约 60–90 分钟</span>
            </div>

            <div className="intro-lead">
              <p>
                你的同学李桥瑞一夜之间失联。班主任说，家长已经把他接走了——
                <strong>可他的微信再没有回复。</strong>
              </p>
              <p>
                你拿到了他的手机。翻微信、翻 QQ、翻浏览器与短信，把散落的信息拼成一条线。
                真相可能不体面，甚至危险——但你有权知道。
              </p>
            </div>

            <ul className="intro-feats">
              <li className="intro-feat">
                <i>01</i>
                <span>
                  <b>手机取证</b> · 微信 / QQ / 短信 / 电话 / 门铃 / 相册 / 百度搜索
                </span>
              </li>
              <li className="intro-feat">
                <i>02</i>
                <span>
                  <b>网页交叉验证</b> · 官网公告、公开档案、论文与公众号，线索藏在字里行间
                </span>
              </li>
              <li className="intro-feat">
                <i>03</i>
                <span>
                  <b>三种结局</b> · 你留下的证据、还剩下的时间，会决定故事的走向
                </span>
              </li>
            </ul>

            <div className="intro-actions">
              <button type="button" className="intro-btn intro-btn-primary" onClick={onStart}>
                {hasProgress ? '重新开始' : '开始游戏'}
              </button>
              {hasProgress ? (
                <button type="button" className="intro-btn intro-btn-ghost" onClick={onContinue}>
                  继续游戏
                </button>
              ) : null}
            </div>
            <p className="intro-note">开始后播放前情提要 · 可随时跳过</p>

            {hasProgress ? (
              <button
                type="button"
                className={confirmingReset ? 'intro-reset confirming' : 'intro-reset'}
                onClick={handleClearSave}
                aria-label="清空本地存档"
              >
                {confirmingReset ? '再点一次，确认清空存档' : '清空本地存档'}
              </button>
            ) : null}
          </div>

          <aside className="intro-case" aria-hidden="true">
            <div className="intro-case-ghost">0313</div>
            <div className="case-frame">
              <div className="case-tape tl" />
              <div className="case-tape br" />
              <div className="case-photo" style={{ backgroundImage: `url(${WALL_URL})` }}>
                <span className="case-stamp">未归</span>
              </div>
              <div className="case-caption">
                <span>3月13日 15:02 · 拍摄地点不明</span>
                <span>IMG_0412</span>
              </div>
            </div>
            <p className="case-note">Evidence 03 / 来源未标注</p>
          </aside>
        </div>
      </main>

      <footer className="intro-foot">
        <span>
          <b>建议全屏 · 建议佩戴耳机</b>
        </span>
        <span>纯前端 · 无后端 · 进度保存在本机</span>
      </footer>

      {hint ? (
        <div key={hint.id} className="intro-hint">
          {hint.text}
        </div>
      ) : null}
    </>
  )
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
    <div className="cine">
      <div className="cine-grain" aria-hidden="true" />
      <div className="cine-bar top" aria-hidden="true" />
      <div className="cine-bar bottom" aria-hidden="true" />

      <div className="cine-hud">
        <span className="hud-rec">REC</span>
        <span>回放 · 3月12日 23:18</span>
      </div>

      <div className="cine-text" key={index} style={{ opacity }}>
        {CINEMATIC_LINES[index]}
      </div>

      <div className="cine-dots" aria-hidden="true">
        {CINEMATIC_LINES.map((_, i) => (
          <span key={i} className={i === index ? 'cine-dot active' : 'cine-dot'} />
        ))}
      </div>

      <button type="button" className="cine-skip" onClick={onDone}>
        跳过
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
