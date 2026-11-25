/**
 * src/ui/RichBlocks.tsx
 *
 * 富文本块渲染器：统一渲染 ArticleBlock（公众号文章/结局旁白）与
 * PageBlock（网页页块）所有 type（CLAUDE.md §4 + types/index.ts）。
 *
 * ArticleBlock type: paragraph / heading(1-3) / image / quote / list / callout
 * PageBlock type: hero / nav / articleList / paragraph / callout / image[zoomable] /
 *                 table / form / sourceComment / loginForm / pdfViewer
 *
 * 渲染器对外暴露：
 *   <ArticleBlockRenderer blocks={...} ctx={...} />
 *   <PageBlockRenderer blocks={...} ctx={...} />
 *   <BlockRenderer block={...} ctx={...} />  // 自动判别 ArticleBlock|PageBlock
 *
 * ctx 提供：onNavigatePage(pageId) / onLogin(puzzleId) / onPdfView(assetId,requiresPuzzleId)
 *          / onSubmitForm(formId) / resolveAsset(assetId)。
 *
 * 零硬编码剧情：所有文字/链接/答案来自 blocks 数据。
 */
import type { CSSProperties } from 'react'
import type { ArticleBlock, PageBlock, PageId, PuzzleId } from '@/types'
import { palette, radius, spacing, calloutVariantColor } from '@/ui/theme'
import { ImageViewer, useImageViewer } from '@/ui/ImageViewer'
import { Button, Input, Tag } from '@/ui/Primitives'
import { Glyph } from '@/ui/icons'

export interface BlockRenderContext {
  /** 点击站内链接跳转 pageId（浏览器伪造跳转 / 微信 link 卡片）。 */
  onNavigatePage?: (pageId: PageId) => void
  /** 点击登录表单触发（puzzleId 由 engine 校验答案；shell 仅触发回调）。 */
  onLogin?: (puzzleId: PuzzleId) => void
  /** 点击 PDF 查看器触发（可能要求先解 requiresPuzzleId 谜题）。 */
  onPdfView?: (assetId: string, requiresPuzzleId?: PuzzleId) => void
  /** 提交普通表单（formId）。 */
  onSubmitForm?: (formId: string) => void
  /** 解析 assetId 为可显示 src。 */
  resolveAsset?: (assetId: string) => string | undefined
  /** 主题色（按钮等强调色），默认 accent。 */
  themeColor?: string
}

const blockBaseStyle: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.7,
  color: palette.textPrimary,
  wordBreak: 'break-word',
}

// ===== ArticleBlock 渲染 =====
export function ArticleBlockRenderer({ blocks, ctx }: { blocks: ArticleBlock[]; ctx?: BlockRenderContext }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      {blocks.map((b, i) => (
        <ArticleBlockItem key={i} block={b} ctx={ctx} />
      ))}
    </div>
  )
}

function ArticleBlockItem({ block, ctx }: { block: ArticleBlock; ctx?: BlockRenderContext }) {
  switch (block.type) {
    case 'paragraph':
      return <p style={{ ...blockBaseStyle, margin: 0 }}>{block.text}</p>
    case 'heading': {
      const size = block.level === 1 ? 22 : block.level === 2 ? 18 : 16
      return (
        <h3
          style={{
            margin: `${spacing.sm}px 0 ${spacing.xs}px`,
            fontSize: size,
            fontWeight: 700,
            color: palette.textPrimary,
            lineHeight: 1.4,
          }}
        >
          {block.text}
        </h3>
      )
    }
    case 'image':
      return <BlockImage assetId={block.assetId} caption={block.caption} ctx={ctx} zoomable />
    case 'quote':
      return (
        <blockquote
          style={{
            margin: 0,
            padding: `${spacing.xs}px ${spacing.md}px`,
            borderLeft: `3px solid ${ctx?.themeColor ?? palette.accent}`,
            color: palette.textSecondary,
            fontStyle: 'italic',
            background: palette.bgCard,
            borderRadius: radius.sm,
          }}
        >
          {block.text}
        </blockquote>
      )
    case 'list':
      return block.ordered ? (
        <ol style={{ ...blockBaseStyle, margin: 0, paddingLeft: spacing.lg }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ marginBottom: spacing.xs }}>{item}</li>
          ))}
        </ol>
      ) : (
        <ul style={{ ...blockBaseStyle, margin: 0, paddingLeft: spacing.lg, listStyle: 'disc' }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ marginBottom: spacing.xs, marginLeft: spacing.sm }}>{item}</li>
          ))}
        </ul>
      )
    case 'callout':
      return <Callout variant={block.variant} text={block.text} />
  }
}

// ===== PageBlock 渲染 =====
export function PageBlockRenderer({ blocks, ctx }: { blocks: PageBlock[]; ctx?: BlockRenderContext }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      {blocks.map((b, i) => (
        <PageBlockItem key={i} block={b} ctx={ctx} />
      ))}
    </div>
  )
}

function PageBlockItem({ block, ctx }: { block: PageBlock; ctx?: BlockRenderContext }) {
  switch (block.type) {
    case 'hero':
      return (
        <section
          style={{
            position: 'relative',
            borderRadius: radius.lg,
            overflow: 'hidden',
            background: block.imageAssetId
              ? `#000`
              : `linear-gradient(135deg, ${ctx?.themeColor ?? palette.accent}33, ${palette.bgCard})`,
            minHeight: 140,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: spacing.lg,
          }}
        >
          {block.imageAssetId ? (
            <img
              src={ctx?.resolveAsset?.(block.imageAssetId)}
              alt={block.heading}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }}
            />
          ) : null}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: palette.textPrimary }}>{block.heading}</h1>
            {block.subheading ? <p style={{ margin: `${spacing.xs}px 0 0`, color: palette.textSecondary, fontSize: 14 }}>{block.subheading}</p> : null}
          </div>
        </section>
      )
    case 'nav':
      return (
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs, padding: `${spacing.xs}px 0` }}>
          {block.links.map((l, i) => (
            <NavChip key={i} label={l.label} themeColor={ctx?.themeColor} onClick={() => ctx?.onNavigatePage?.(l.pageId)} />
          ))}
        </nav>
      )
    case 'articleList':
      return (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {block.items.map((it, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => ctx?.onNavigatePage?.(it.pageId)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  borderBottom: `1px solid ${palette.divider}`,
                  padding: `${spacing.md}px 0`,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  color: palette.textPrimary,
                }}
              >
                <span style={{ fontSize: 15 }}>{it.title}</span>
                {it.date ? <span style={{ fontSize: 12, color: palette.textTertiary }}>{it.date}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )
    case 'paragraph':
      return <p style={{ ...blockBaseStyle, margin: 0 }}>{block.text}</p>
    case 'callout':
      return <Callout variant={block.variant} text={block.text} />
    case 'image':
      return <BlockImage assetId={block.assetId} caption={block.caption} ctx={ctx} zoomable={block.zoomable ?? true} />
    case 'table':
      return <BlockTable headers={block.headers} rows={block.rows} />
    case 'form':
      return <BlockForm formId={block.formId} onSubmitMessage={block.onSubmitMessage} ctx={ctx} />
    case 'sourceComment':
      // 只把线索写进隐藏 HTML 注释（玩家查看源码可见）。
      // 原实现还额外渲染一个折叠的「开发者注释 / 线索已写入页面源码注释」提示框——
      // 那是工序旁白，一旦接线就会把设计意图直接摊给玩家（审核报告 §3），已移除。
      return (
        <div
          // eslint-disable-next-line react/no-danger -- 数据驱动源码注释线索（CLAUDE.md §4 + PageBlock.sourceComment），内容来自 data/browser pages JSON
          dangerouslySetInnerHTML={{ __html: `<!-- ${block.comment} -->` }}
          aria-hidden="true"
        />
      )
    case 'loginForm':
      return <BlockLoginForm puzzleId={block.puzzleId} ctx={ctx} />
    case 'pdfViewer':
      return <BlockPdfViewer assetId={block.assetId} ctx={ctx} />
  }
}

/** 自动判别 ArticleBlock | PageBlock 的统一渲染入口。 */
export function BlockRenderer({ block, ctx }: { block: ArticleBlock | PageBlock; ctx?: BlockRenderContext }) {
  // 共享 type（paragraph/callout/image）两边都存在；通过是否有 PageBlock 独有字段判别不可靠，
  // 因此由调用方直接选用 ArticleBlockRenderer / PageBlockRenderer 更清晰。
  // 这里仅做兜底：若 block 含 PageBlock 独有字段则按 Page 渲染。
  if ('formId' in block || 'puzzleId' in block || 'headers' in block || 'links' in block || 'items' in block || 'heading' in block || 'requiresPuzzleId' in block || 'comment' in block) {
    return <PageBlockItem block={block as PageBlock} ctx={ctx} />
  }
  return <ArticleBlockItem block={block as ArticleBlock} ctx={ctx} />
}

// ===== 子组件 =====
function Callout({ variant, text }: { variant: 'info' | 'warning' | 'danger'; text: string }) {
  const color = calloutVariantColor[variant] ?? palette.info
  return (
    <aside
      style={{
        background: color + '1f',
        border: `1px solid ${color}55`,
        borderLeft: `4px solid ${color}`,
        borderRadius: radius.md,
        padding: spacing.md,
        color: palette.textPrimary,
        fontSize: 14,
      }}
      role="note"
    >
      <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'flex-start' }}>
        <span style={{ color, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
          {variant === 'danger' ? '危险' : variant === 'warning' ? '警告' : '提示'}
        </span>
        <span style={{ flex: 1 }}>{text}</span>
      </div>
    </aside>
  )
}

function BlockImage({
  assetId,
  caption,
  ctx,
  zoomable,
}: {
  assetId: string
  caption?: string
  ctx?: BlockRenderContext
  zoomable?: boolean
}) {
  const src = ctx?.resolveAsset?.(assetId)
  if (!src) {
    return (
      <figure style={{ margin: 0 }}>
        <div
          style={{
            width: '100%',
            minHeight: 120,
            background: palette.bgElevated,
            borderRadius: radius.md,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: palette.textTertiary,
            fontSize: 12,
          }}
        >
          [图片：{assetId}]
        </div>
        {caption ? <figcaption style={{ fontSize: 12, color: palette.textTertiary, textAlign: 'center', marginTop: spacing.xs }}>{caption}</figcaption> : null}
      </figure>
    )
  }
  if (zoomable) {
    return (
      <figure style={{ margin: 0, position: 'relative' }}>
        <ImageViewer src={src} caption={caption} alt={caption} style={{ width: '100%' }} />
        <ImageViewer.Hint />
        {caption ? <figcaption style={{ fontSize: 12, color: palette.textTertiary, textAlign: 'center', marginTop: spacing.xs }}>{caption}</figcaption> : null}
      </figure>
    )
  }
  return (
    <figure style={{ margin: 0 }}>
      <img src={src} alt={caption ?? ''} style={{ width: '100%', borderRadius: radius.md, display: 'block' }} />
      {caption ? <figcaption style={{ fontSize: 12, color: palette.textTertiary, textAlign: 'center', marginTop: spacing.xs }}>{caption}</figcaption> : null}
    </figure>
  )
}

function BlockTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: radius.md, border: `1px solid ${palette.border}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: palette.textPrimary, minWidth: 320 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{ textAlign: 'left', padding: spacing.sm, background: palette.bgElevated, borderBottom: `1px solid ${palette.border}`, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: spacing.sm, borderBottom: ri === rows.length - 1 ? 'none' : `1px solid ${palette.divider}`, verticalAlign: 'top' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BlockForm({ formId, onSubmitMessage, ctx }: { formId: string; onSubmitMessage: string; ctx?: BlockRenderContext }) {
  const { open } = useImageViewer()
  void open
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        ctx?.onSubmitForm?.(formId)
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, background: palette.bgCard, padding: spacing.md, borderRadius: radius.md }}
    >
      <p style={{ margin: 0, fontSize: 14, color: palette.textSecondary }}>{onSubmitMessage}</p>
      <Input placeholder="输入内容…" aria-label={formId} />
      <Button type="submit" size="sm" block>
        提交
      </Button>
    </form>
  )
}

function BlockLoginForm({ puzzleId, ctx }: { puzzleId: PuzzleId; ctx?: BlockRenderContext }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, background: palette.bgCard, padding: spacing.md, borderRadius: radius.md }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, color: palette.textSecondary }}>
        <Glyph name="settings" size={16} color={palette.textTertiary} />
        <span style={{ fontSize: 14, fontWeight: 500 }}>登录</span>
        <Tag color={palette.warning}>需密码</Tag>
      </div>
      <Input type="text" placeholder="账号" aria-label="账号" />
      <Input type="password" placeholder="密码" aria-label="密码" iconLeft="settings" />
      <Button size="sm" block onClick={() => ctx?.onLogin?.(puzzleId)}>
        登录
      </Button>
    </div>
  )
}

function BlockPdfViewer({
  assetId,
  requiresPuzzleId,
  ctx,
}: {
  assetId: string
  requiresPuzzleId?: PuzzleId
  ctx?: BlockRenderContext
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, background: palette.bgCard, padding: spacing.md, borderRadius: radius.md }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <Glyph name="files" size={28} color={palette.warning} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: palette.textPrimary }}>{assetId}</div>
          {requiresPuzzleId ? <div style={{ fontSize: 12, color: palette.warning }}>需要密码才能查看</div> : null}
        </div>
      </div>
      <Button size="sm" block iconLeft="files" onClick={() => ctx?.onPdfView?.(assetId, requiresPuzzleId)}>
        {requiresPuzzleId ? '输入密码打开' : '打开 PDF'}
      </Button>
    </div>
  )
}

function NavChip({ label, onClick, themeColor }: { label: string; onClick: () => void; themeColor?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: `1px solid ${(themeColor ?? palette.accent) + '55'}`,
        color: themeColor ?? palette.accent,
        borderRadius: radius.pill,
        padding: '4px 12px',
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
