/**
 * site-arxiv/BlockView —— 把 PageBlock 按 arXiv 学术预印本库本真视觉渲染。
 *
 * 站点只消费 blocks 数组的展示字段。nav/articleList/sourceComment/loginForm
 * 的跳转语义由调用方（列表页/摘要页）在需要时单独处理；本组件做纯内容块渲染，
 * 但对 nav/articleList 也提供本站式样的渲染（因 arXiv 数据里有 nav 块）。
 *
 * 遵守边界：仅 import 与 react / react-router / @/sites/shared / @/types 相关。
 */
import type { ReactElement } from 'react'
import { Link } from 'react-router'
import { PlaceholderImage, PlaceholderPdf } from '@/sites/shared/placeholder'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import type { PageBlock } from '@/types'
import { pathByPageId } from './manifest'

interface BlockViewProps {
  block: PageBlock
}

export function BlockView({ block }: BlockViewProps): ReactElement | null {
  const base = useSiteBase()
  switch (block.type) {
    case 'hero':
      return (
        <header>
          {block.imageAssetId && (
            <div className="site-arxiv-image">
              <PlaceholderImage
                assetId={block.imageAssetId}
                alt={block.heading}
                className="site-arxiv-image-img"
              />
            </div>
          )}
          <h1 className="site-arxiv-abs-title">{block.heading}</h1>
          {block.subheading && (
            <p className="site-arxiv-abs-authors">{block.subheading}</p>
          )}
        </header>
      )

    case 'paragraph': {
      // 关键词行（含 "Keywords"/"关键词"）用更小无衬线
      const isKeywords = /keywords|关键词/i.test(block.text)
      return (
        <p className={`site-arxiv-paragraph${isKeywords ? ' is-keywords' : ''}`}>
          {block.text}
        </p>
      )
    }

    case 'callout': {
      const variantCls =
        block.variant === 'warning'
          ? 'is-warning'
          : block.variant === 'danger'
            ? 'is-danger'
            : block.variant === 'info'
              ? 'is-info'
              : ''
      return (
        <div className={`site-arxiv-callout ${variantCls}`.trim()}>{block.text}</div>
      )
    }

    case 'image':
      return (
        <figure className="site-arxiv-image">
          <PlaceholderImage
            assetId={block.assetId}
            alt={block.caption ?? block.assetId}
            className="site-arxiv-image-img"
          />
          {block.caption && (
            <figcaption className="site-arxiv-image-caption">{block.caption}</figcaption>
          )}
        </figure>
      )

    case 'table':
      return (
        <table className="site-arxiv-meta" style={{ display: 'block' }}>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr className="site-arxiv-meta-row" key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={
                      ci === 0 ? 'site-arxiv-meta-label' : 'site-arxiv-meta-value'
                    }
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )

    case 'nav':
      return (
        <div className="site-arxiv-navblock">
          {block.links.map((l, i) => (
            <Link key={i} to={sitePath(base, pathForPage(l.pageId))}>
              {l.label}
            </Link>
          ))}
        </div>
      )

    case 'articleList':
      return null // 列表页与摘要页各自单独渲染 articleList，此处不重复

    case 'form':
      return null // 本站数据无 form；预留降级

    case 'loginForm':
      return null // 本站无后台

    case 'pdfViewer':
      return <PdfBlock assetId={block.assetId} />

    case 'sourceComment':
      return (
        <div className="site-arxiv-back">
          <span style={{ color: '#888' }}>来源备注：{block.comment}</span>
          {block.linkPageId && (
            <>
              {' '}
              <Link to={sitePath(base, pathForPage(block.linkPageId))}>查看来源页</Link>
            </>
          )}
        </div>
      )

    default:
      return null
  }
}

/** PDF 块：arXiv 式下载框——标题栏 + 下载/查看按钮 + PlaceholderPdf 正文占位。 */
function PdfBlock({ assetId }: { assetId: string }): ReactElement {
  return (
    <div className="site-arxiv-pdf-box">
      <div className="site-arxiv-pdf-head">
        <span className="site-arxiv-pdf-head-title">全文 PDF · {assetId}</span>
        <div className="site-arxiv-pdf-actions">
          <a
            className="site-arxiv-pdf-btn"
            // 真实下载：指向 assets 路径，真 PDF 放到 public/assets/ 即生效；占位文件不影响点击
            href={assetUrl(assetId)}
            download={assetId}
          >
            下载 PDF
          </a>
        </div>
      </div>
      <div className="site-arxiv-pdf-body">
        <PlaceholderPdf assetId={assetId} style={{ minHeight: 320 }} />
      </div>
    </div>
  )
}

/** 站内 pageId → 站内相对路径（未知 pageId 退回 list，避免死链）。 */
function pathForPage(pageId: string): string {
  return pathByPageId.get(pageId) ?? 'list'
}

/** 构造 assets 路径（构建时 import.meta.env.BASE_URL 静态替换）。 */
function assetUrl(assetId: string): string {
  return `${import.meta.env.BASE_URL}assets/${assetId}`
}
