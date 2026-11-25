/**
 * src/apps/PhoneShell/PhoneShell.tsx
 *
 * 手机设备框架（交互设计 §二）：PC 浏览器居中模拟手机。
 *
 * 2026-11 视觉改版：从"一块暗色圆角矩形"升级为一台放在暗房间里的真机——
 *   - 舞台：失焦房间背景 + 背光 + 暗角 + 取景框四角 + 角落监控水印；
 *   - 机身：金属中框（多层 ring）、侧键、动态岛、摄像头幽光、玻璃反光；
 *   - 屏幕：圆角裁切 + 内阴影 + 氛围层（颗粒/暗角/低语/故障，见 @/ui/atmosphere）。
 *
 * 全局视觉（保留原有行为）：
 *  - 风险红边（risk>70）：屏幕边缘红色 pulse 覆盖（useRisk.isRedAlert）。
 *  - 心跳视觉：红色告警时屏幕规律脉冲。
 *  - 屏幕震动（shellState.useShaking）：CSS 抖动（门铃/全屏警告触发）。
 */
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { useGameStore } from '@/game/gameStore'
import { useNavigate } from 'react-router'
import {
  useRisk,
  useShaking,
  useRedEdgeIntensity,
  watchCountdownExpiry,
  watchNewGameReset,
  watchSiteIdleSms,
  watchSmsTriggers,
  triggerThreatIncomingCall,
  startFinaleCountdown,
} from '@/utils/shellState'
import { ToastHost } from '@/apps/PhoneShell/ToastHost'
import { StatusBar } from '@/apps/PhoneShell/StatusBar'
import { NotificationBar } from '@/apps/PhoneShell/NotificationBar'
import { EndingOverlay } from '@/apps/PhoneShell/EndingOverlay'
import { useGameClock } from '@/apps/PhoneShell/useGameClock'
import { AtmosphereLayer } from '@/ui/atmosphere/AtmosphereLayer'
import { useDread } from '@/ui/atmosphere/dread'
import { formatClock } from '@/utils/time'
import bezelBg from '@/assets/phone/bezel.jpg'
import '@/apps/PhoneShell/phone-shell.css'

/** 登录实验室后台后触发的威胁来电谜题 id（详见 call-log.json call-zhangqiang-threat-incoming）。 */
const LAB_BACKEND_PUZZLE = 'puzzle-lab-backend'

export function PhoneShell({ children }: { children?: ReactNode }) {
  const navigate = useNavigate()
  const { isRedAlert } = useRisk()
  const shaking = useShaking()
  const redEdge = useRedEdgeIntensity()
  const redEdgeOpacity = isRedAlert ? Math.max(0.45, redEdge || 0.7) : redEdge
  const { level } = useDread()
  const clockMs = useGameClock(30_000)

  // 存档回到全新状态（返回主菜单 / 清空本地存档 / 另一标签页重置）时，
  // 把路由带回桌面：否则入口主站浮层下面还停在旧的通话页/证据页，
  // 点「开始游戏」会直接看到上一局的界面（含已结束的通话记录）。
  const isFreshSave = useGameStore(
    (s) => s.collectedEvidenceIds.length === 0 && s.solvedPuzzleIds.length === 0 && !s.finished,
  )
  const wasFreshRef = useRef(isFreshSave)
  useEffect(() => {
    if (isFreshSave && !wasFreshRef.current) navigate('/')
    wasFreshRef.current = isFreshSave
  }, [isFreshSave, navigate])

  // 挂载时启动：倒计时到期监听（→ 坏结局）、短信触发分派（谜题/章节/结局）、
  // 站点停留监听（idleOnPage）、以及"新周目清空 shell 运行态"。均幂等。
  useEffect(() => {
    watchCountdownExpiry()
    watchSmsTriggers()
    watchSiteIdleSms()
    return watchNewGameReset()
  }, [])

  // 登录实验室后台（puzzle-lab-backend 解）→ 监视者打进威胁来电（振铃+心跳）。
  // 仅在"刚解出后"触发一次：用 ref 记录是否已对该 puzzle 触发过，避免反复振铃。
  // finished 后不再触发（结局已定）。
  const solvedPuzzleIds = useGameStore((s) => s.solvedPuzzleIds)
  const finished = useGameStore((s) => s.finished)

  // 终章由「手机侧」启动（审核报告 E2E-3）：站点在另一个标签页只看经费报告并归档证据，
  // 跨标签同步后本标签页观察到 ev-lab-funding-report → 启动 3 分钟倒计时 + 威胁短信
  // + 刀哥门铃 + 心跳。startFinaleCountdown 内部幂等（已在跑则不重复）。
  const collectedEvidenceIds = useGameStore((s) => s.collectedEvidenceIds)
  useEffect(() => {
    if (finished) return
    if (!collectedEvidenceIds.includes('ev-lab-funding-report')) return
    startFinaleCountdown()
  }, [collectedEvidenceIds, finished])

  const triggeredRef = useRef(false)
  useEffect(() => {
    if (triggeredRef.current) return
    if (finished) return
    if (solvedPuzzleIds.includes(LAB_BACKEND_PUZZLE)) {
      triggeredRef.current = true
      // 略延迟，给"登录跳转财务页"一个节奏，随后手机被来电打断。
      const t = setTimeout(() => triggerThreatIncomingCall(), 1500)
      return () => clearTimeout(t)
    }
  }, [solvedPuzzleIds, finished])

  return (
    <div className="stage" style={{ '--dread': String(level) } as CSSProperties}>
      {/* 舞台：失焦的房间背景 */}
      <div aria-hidden="true" className="stage-bg" style={{ backgroundImage: `url(${bezelBg})` }} />
      <div className="stage-haze" aria-hidden="true" />
      <div className="stage-vignette" aria-hidden="true" />
      <div className="stage-brackets" aria-hidden="true" />
      <div className="stage-slug" aria-hidden="true">
        CAM 03 · 宿舍楼
      </div>
      <div className="stage-slug stage-slug-right" aria-hidden="true">
        {formatClock(clockMs)} · 2026-03-13
      </div>

      {/* 机身 + 屏幕 */}
      <div className={shaking ? 'phone ui-shake' : 'phone'}>
        <span className="phone-key key-mute" aria-hidden="true" />
        <span className="phone-key key-vol-up" aria-hidden="true" />
        <span className="phone-key key-vol-down" aria-hidden="true" />
        <span className="phone-key key-power" aria-hidden="true" />

        <div className="phone-screen">
          {/* 动态岛（含摄像头幽光） */}
          <div className="phone-island" aria-hidden="true">
            <span className="phone-cam" />
          </div>

          <div className="phone-content">
            <StatusBar />
            <NotificationBar />
            <ToastHost />
            <div className="phone-app">
              {children}
              {/* 全局结局覆盖层（H1/H2/M1）：finished=true 时 zIndex 100 强制遮罩，
                  覆盖任何当前 App（PhoneApp 拨号途中倒计时归零也能看到坏结局）。 */}
              <EndingOverlay />
            </div>
          </div>

          {/* 氛围层：颗粒 / 暗角 / 扫描线 / 低语 / 故障（pointer-events:none） */}
          <AtmosphereLayer />
          {/* 玻璃反光 */}
          <div className="phone-glass" aria-hidden="true" />

          {/* 风险红边覆盖 */}
          {redEdgeOpacity > 0 ? (
            <div
              aria-hidden="true"
              className="ui-red-edge"
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 55,
                pointerEvents: 'none',
                boxShadow: `inset 0 0 ${40 + redEdgeOpacity * 60}px ${10 + redEdgeOpacity * 20}px rgba(220,30,30,${redEdgeOpacity})`,
                animation: 'ui-red-edge-pulse 1.2s ease-in-out infinite',
                borderRadius: 52,
              }}
            />
          ) : null}

          {/* Home indicator：可点击返回桌面。 */}
          <button type="button" onClick={() => navigate('/')} aria-label="返回桌面" title="返回桌面" className="phone-home">
            <span aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

/** 外部容器（PC 居中）+ 媒体查询：窄屏时铺满。 */
export function PhoneShellStage({ children }: { children?: ReactNode }) {
  return <div className="stage">{children ?? <PhoneShell />}</div>
}
