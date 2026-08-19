/**
 * src/apps/PhoneShell/EndingOverlay.tsx
 *
 * 全局结局覆盖层 — 修复 REVIEW_REPORT.md H1/H2/M1（三结局玩家可见闭环）。
 *
 * 订阅 useGameStore(s => ({ endingId, finished }))。finished=true 时强制遮罩，
 * 渲染 endings.json 的 epilogueBlocks（用 src/ui/RichBlocks 的 ArticleBlockRenderer），
 * 覆盖任何当前 App（包括 PhoneApp 拨号途中倒计时归零、risk 满触发 bad 的场景）。
 *
 * 三结局可视化：
 *  - good：渲染 good.epilogueBlocks（"湖南警方破获非法人体实验案…"），
 *          并在其后 inline 追加 postEndingWechatMessage（李桥瑞"兄弟，谢谢你。
 *          我欠你一条命。"）与 postEndingSms 的提示——务实方案，不依赖
 *          WechatApp/SmsApp 改造（这两个 App 不在本 agent 目录）。
 *  - normal：渲染 normal.epilogueBlocks（"证据不足，调查中断"旁白）。
 *  - bad：全屏黑屏遮罩 + bad.epilogueBlocks（含"林哲也消失了"），
 *         zIndex 最高，覆盖任何 App（修复 M1：倒计时归零时玩家在 PhoneApp
 *         拨号途中也能看到坏结局表现，而非只在 DoorbellApp 私有组件里）。
 *
 * 方案 A（强制遮罩）：finished=true 即遮罩，忽略当前路由。call-scripts.json good
 * 分支 endEffects 的 openNewsApp('good') 即便把路由跳到 /app/news（无 NewsApp
 * 注册会兜底回桌面），EndingOverlay 仍会把结局正文盖在最上层，玩家可见闭环成立。
 * 不需要新建 NewsApp，也不依赖 AppRegistry/AppRouter 改造。
 *
 * 数据来源单一真源：public/data/meta/endings.json（loader.getEndingById 读取）。
 * 零硬编码剧情：所有文字来自 endings 数据。
 */
import type { ReactNode } from 'react'
import { useGameStore } from '@/engine/store/gameStore'
import { getEndingById } from '@/data/loader'
import type { Ending, EndingId } from '@/types'
import { ArticleBlockRenderer } from '@/ui/RichBlocks'
import { palette, radius, spacing } from '@/ui/theme'

/**
 * 结局覆盖层。挂在 PhoneShell 顶层 children 外层，z-index 最高。
 * finished=false 时返回 null（不影响正常 App 渲染）。
 */
export function EndingOverlay(): ReactNode {
  const endingId = useGameStore((s) => s.endingId)
  const finished = useGameStore((s) => s.finished)

  if (!finished || !endingId) return null
  const ending = getEndingById(endingId)
  if (!ending) return null

  return <EndingView ending={ending} />
}

function EndingView({ ending }: { ending: Ending }): ReactNode {
  if (ending.id === 'bad') return <BadEndingView ending={ending} />
  return <GoodOrNormalEndingView ending={ending} />
}

// ===== good / normal：结局正文卡片（覆盖在当前 App 之上，可滚动阅读）=====
function GoodOrNormalEndingView({ ending }: { ending: Ending }): ReactNode {
  const themeColor = ending.id === 'good' ? palette.success : palette.warning
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        overflow: 'auto',
        background: `linear-gradient(180deg, ${palette.bgDarkest} 0%, ${palette.bgScreen} 40%, ${palette.bgScreen} 100%)`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: `${spacing.xl}px ${spacing.lg}px ${spacing.sm}px`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: 2,
            color: themeColor,
            textTransform: 'uppercase',
            marginBottom: spacing.xs,
          }}
        >
          {ending.id === 'good' ? '结局播报' : '调查结束'}
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: palette.textPrimary,
          }}
        >
          {ending.title}
        </div>
      </div>

      <div
        style={{
          padding: `${spacing.sm}px ${spacing.lg}px ${spacing.xl}px`,
        }}
      >
        <ArticleBlockRenderer
          blocks={ending.epilogueBlocks}
          ctx={{ themeColor }}
        />

        {/* good/normal 通用收尾分隔 */}
        <EndingExtraMessages ending={ending} />
      </div>
    </div>
  )
}

/**
 * good 结局后将 postEndingWechatMessage / postEndingSms inline 呈现为
 * 仿微信/仿短信卡片。务实方案（不注入 WechatApp 内存态，因 WechatApp 不在本
 * agent 目录），确保 E2E 玩家可见闭环：李桥瑞"兄弟，谢谢你。我欠你一条命。"
 * 等结局后消息必被交付。
 */
function EndingExtraMessages({ ending }: { ending: Ending }): ReactNode {
  const wechat = ending.postEndingWechatMessage
  const smsList = ending.postEndingSms ?? []
  if (!wechat && smsList.length === 0) return null

  return (
    <div style={{ marginTop: spacing.xl, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      {wechat ? <WechatThanksCard endingId={ending.id} text={joinMessageTexts(wechat.messages)} /> : null}
      {smsList.length > 0 ? <SmsExtraCard endingId={ending.id} items={smsList} /> : null}
    </div>
  )
}

function joinMessageTexts(messages: { text?: string }[]): string {
  return messages.map((m) => m.text ?? '').filter(Boolean).join('\n')
}

function WechatThanksCard({ endingId, text }: { endingId: EndingId; text: string }): ReactNode {
  return (
    <div
      style={{
        background: palette.bgCard,
        borderRadius: radius.md,
        padding: spacing.md,
        borderLeft: `3px solid ${palette.wechatGreen}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.xs,
          marginBottom: spacing.xs,
          fontSize: 12,
          color: palette.wechatGreen,
          fontWeight: 600,
        }}
      >
        <span>微信 · 李桥瑞</span>
        <span style={{ color: palette.textTertiary, fontWeight: 400 }}>· 新消息</span>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.7, color: palette.textPrimary, whiteSpace: 'pre-wrap' }}>
        {text}
      </div>
      <div style={{ marginTop: spacing.xs, fontSize: 11, color: palette.textTertiary }}>
        {endingId === 'good' ? '结局后送达' : '调查结束后送达'}
      </div>
    </div>
  )
}

function SmsExtraCard({
  endingId,
  items,
}: {
  endingId: EndingId
  items: { from: string; text: string }[]
}): ReactNode {
  return (
    <div
      style={{
        background: palette.bgCard,
        borderRadius: radius.md,
        padding: spacing.md,
        borderLeft: `3px solid ${palette.smsOrange}`,
      }}
    >
      <div
        style={{
          marginBottom: spacing.xs,
          fontSize: 12,
          color: palette.smsOrange,
          fontWeight: 600,
        }}
      >
        短信 · 新消息
      </div>
      {items.map((it, i) => (
        <div key={i} style={{ marginBottom: spacing.xs }}>
          <div style={{ fontSize: 11, color: palette.textTertiary }}>来自：{it.from}</div>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: palette.textPrimary }}>{it.text}</div>
        </div>
      ))}
      <div style={{ marginTop: spacing.xs, fontSize: 11, color: palette.textTertiary }}>
        {endingId === 'good' ? '结局后送达' : '调查结束后送达'}
      </div>
    </div>
  )
}

// ===== bad：全屏黑屏遮罩（zIndex 最高，覆盖任何 App，修复 M1）=====
function BadEndingView({ ending }: { ending: Ending }): ReactNode {
  // 全屏黑屏遮罩（zIndex 100 覆盖任何 App，含 PhoneApp 拨号途中归零场景）。
  // 注意：依赖 fadein keyframes 会越权 src/index.css（不在本 agent 目录），
  // 故此处用纯黑屏而不引用未定义动画，保持本组件自洽。
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        background: '#000',
        color: '#911',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ flex: 1, overflow: 'auto', padding: `${spacing.xl}px ${spacing.lg}px` }}>
        <ArticleBlockRenderer blocks={ending.epilogueBlocks} ctx={{ themeColor: palette.danger }} />
      </div>
    </div>
  )
}
