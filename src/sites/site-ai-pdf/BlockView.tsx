/**
 * site-ai-pdf/BlockView —— 把 PageBlock（及 page JSON 中实际出现的 heading/list 块）
 * 按 AI 论文解读工具站的本真视觉渲染。
 *
 * 说明：page-ai-interpret.json 使用了 heading / list 块类型（属 ArticleBlock 联合，
 * 非 PageBlock 联合；但 loader 对 page block 用 passthrough，SitePage.blocks 字段声明
 * 为 PageBlock[]，运行时仍为真实 JSON）。本组件对 heading/list 单独做类型收窄（以
 * 泛型 block 为判别依据），其余走 PageBlock 严格判别，保证 TS 零错误。
 *
 * 渲染类型：heading / paragraph / callout / list / hero。
 * （本站数据无 image/table/nav/articleList/form/loginForm/sourceComment/pdfViewer，default 降级 null。）
 *
 * 边界：仅 import react / @/types。不碰游戏系统。
 */
import type { CSSProperties, ReactElement } from 'react'
import type { PageBlock } from '@/types'

/** heading 块（ArticleBlock 里的成员，page JSON 实际出现，类型收窄用）。 */
interface HeadingBlock {
  type: 'heading'
  level: 1 | 2 | 3
  text: string
}
/** list 块（同上）。 */
interface ListBlock {
  type: 'list'
  items: string[]
  ordered?: boolean
}

/** 本站实际会渲染的块联合（PageBlock 严格成员 + heading/list）。 */
type AiPdfBlock = PageBlock | HeadingBlock | ListBlock

interface BlockViewProps {
  block: PageBlock
}

export function BlockView({ block }: BlockViewProps): ReactElement | null {
  const b = block as AiPdfBlock
  switch (b.type) {
    case 'hero':
      return (
        <div className="site-ai-pdf-hero">
          <h1 className="site-ai-pdf-hero-title">{b.heading}</h1>
          {b.subheading && <p className="site-ai-pdf-hero-sub">{b.subheading}</p>}
        </div>
      )

    case 'heading': {
      // level 1 / 2 / 3 各用对应语义标签，class 带 level 变体控制视觉
      const cls = `site-ai-pdf-heading site-ai-pdf-heading-level-${b.level}`
      if (b.level === 1) return <h1 className={cls}>{b.text}</h1>
      if (b.level === 2) return <h2 className={cls}>{b.text}</h2>
      return <h3 className={cls}>{b.text}</h3>
    }

    case 'paragraph':
      return <p className="site-ai-pdf-paragraph">{b.text}</p>

    case 'list':
      return (
        <ul
          className={`site-ai-pdf-list ${b.ordered ? 'is-ordered' : 'is-unordered'}`}
          style={b.ordered ? listOrderedStyle : undefined}
        >
          {b.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )

    case 'callout': {
      const variantCls =
        b.variant === 'warning'
          ? 'is-warning'
          : b.variant === 'danger'
            ? 'is-danger'
            : b.variant === 'info'
              ? 'is-info'
              : ''
      return (
        <div className={`site-ai-pdf-callout ${variantCls}`.trim()}>{b.text}</div>
      )
    }

    default:
      // 其余块类型本站数据未出现，降级不渲染
      return null
  }
}

const listOrderedStyle: CSSProperties = {
  listStyle: 'decimal',
}
