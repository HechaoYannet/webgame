/**
 * src/apps/PhoneShell/PhoneShell.tsx
 *
 * 手机设备框架（交互设计 §二）：PC 浏览器居中模拟手机。圆角/刘海/比例。
 * 包裹 AppRouter / StatusBar / NotificationBar。
 *
 * 全局视觉：
 *  - 风险值红边（risk>70）：屏幕边缘红色 pulse 覆盖（useRisk.isRedAlert）。
 *  - 心跳视觉：risk>70 或倒计时进行时屏幕规律脉冲（CSS animation）。
 *  - 屏幕震动（shellState.useShaking）：CSS 抖动（门铃/全屏警告触发）。
 */
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { useGameStore } from '@/game/gameStore'
import { useRisk, useShaking, useRedEdgeIntensity, watchCountdownExpiry, triggerThreatIncomingCall } from '@/utils/shellState'
import { StatusBar } from '@/apps/PhoneShell/StatusBar'
import { NotificationBar } from '@/apps/PhoneShell/NotificationBar'
import { EndingOverlay } from '@/apps/PhoneShell/EndingOverlay'
import { palette } from '@/ui/theme'
import bezelBg from '@/assets/phone/bezel.jpg'

/** 登录新希望后台后触发的威胁来电谜题 id（详见 call-log.json call-zhangqiang-threat-incoming）。 */
const XINXWANG_BACKEND_PUZZLE = 'puzzle-xinxwang-backend'

export function PhoneShell({ children }: { children?: ReactNode }) {
  const { isRedAlert } = useRisk()
  const shaking = useShaking()
  const redEdge = useRedEdgeIntensity()
  const redEdgeOpacity = isRedAlert ? Math.max(0.45, redEdge || 0.7) : redEdge

  // 挂载时启动倒计时到期监听 → 坏结局（幂等）。
  useEffect(() => {
    watchCountdownExpiry()
  }, [])

  // 登录新希望后台（puzzle-xinxwang-backend 解）→ 监视者打进威胁来电（振铃+心跳）。
  // 仅在"刚解出后"触发一次：用 ref 记录是否已对该 puzzle 触发过，避免反复振铃。
  // finished 后不再触发（结局已定）。
  const solvedPuzzleIds = useGameStore((s) => s.solvedPuzzleIds)
  const finished = useGameStore((s) => s.finished)
  const triggeredRef = useRef(false)
  useEffect(() => {
    if (triggeredRef.current) return
    if (finished) return
    if (solvedPuzzleIds.includes(XINXWANG_BACKEND_PUZZLE)) {
      triggeredRef.current = true
      // 略延迟，给"登录跳转财务页"一个节奏，随后手机被来电打断。
      const t = setTimeout(() => triggerThreatIncomingCall(), 1500)
      return () => clearTimeout(t)
    }
  }, [solvedPuzzleIds, finished])

  return (
    <div
      style={{
        // PC 居中
        position: 'fixed',
        inset: 0,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* 边框外背景：原 #000 纯黑 → 换成 bezel.jpg + 模糊。手机外框不带 filter，保持清晰。 */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${bezelBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(18px) brightness(0.7)',
          transform: 'scale(1.1)', // 放大一圈消除 blur 边缘透明
          zIndex: 0,
        }}
      />
      {/* 手机外框 */}
      <div
        className={shaking ? 'ui-shake' : ''}
        style={{
          position: 'relative',
          zIndex: 1,
          width: 390,
          height: 'min(844px, 96vh)',
          maxHeight: 844,
          background: palette.bgScreen,
          borderRadius: 44,
          boxShadow:
            '0 0 0 11px #1a1a22, 0 0 0 12px #2c2c38, 0 30px 80px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          animation: isRedAlert ? 'ui-heartbeat-screen 1s ease-in-out infinite' : undefined,
        }}
      >
        {/* 刘海 */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 120,
            height: 28,
            background: '#000',
            borderRadius: 16,
            zIndex: 40,
          }}
        >
          <div style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', width: 8, height: 8, borderRadius: '50%', background: '#0a1a2a', boxShadow: 'inset 0 0 3px #1a3a5a' }} />
        </div>

        {/* 屏幕内容区：StatusBar 改为 in-flow（修复状态栏遮挡 App 顶部 BUG）。
            此前 StatusBar/NorificationBar 都是 absolute overlay 盖在 App 之上，App 从 y=0
            起填满整屏，导致状态栏遮住各 App 顶部 ~44px 头部。改为：StatusBar 占据列首，
            下方内容区 flex:1 放路由。通知横幅 overlay、IncomingCall/FullscreenAlert/Ending
            仍用 absolute inset:0 全屏遮罩（它们本就要盖满整屏，含状态栏）。 */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <StatusBar />
          <NotificationBar />
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {children}
            {/* 全局结局覆盖层（H1/H2/M1）：finished=true 时 zIndex 100 强制遮罩，
                覆盖任何当前 App（PhoneApp 拨号途中倒计时归零也能看到坏结局）。
                good/normal 渲染 epilogueBlocks，bad 全屏黑屏。 */}
            <EndingOverlay />
          </div>
        </div>

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
              borderRadius: 44,
            }}
          />
        ) : null}

        {/* Home indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 120,
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.4)',
            zIndex: 41,
          }}
        />
      </div>
    </div>
  )
}

/** 外部容器（PC 居中）+ 媒体查询：窄屏时铺满。 */
export function PhoneShellStage({ children }: { children?: ReactNode }) {
  const stageStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: '#050507',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif',
  }
  return <div style={stageStyle}>{children ?? <PhoneShell />}</div>
}
