/**
 * site-news/BlockView —— 把 PageBlock 按新闻门户本真视觉渲染。
 *
 * 站点只消费 blocks 数组的展示字段。nav/articleList/sourceComment/loginForm
 * 的跳转语义由调用方（首页/文章页）处理，本组件只负责纯内容块。
 */
import type { ReactElement } from 'react'
import { Link } from 'react-router'
import { PlaceholderImage } from '@/sites/shared/placeholder'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import type { PageBlock } from '@/types'
import { slugByPageId } from './manifest'

interface BlockViewProps {
  block: PageBlock
}

export function BlockView({ block }: BlockViewProps): ReactElement | null {
  const base = useSiteBase()
  switch (block.type) {
    case 'hero':
      return (
        <section className="site-news-hero">
          <h1 className="site-news-hero-heading">{block.heading}</h1>
          {block.subheading && <p className="site-news-hero-sub">{block.subheading}</p>}
          {block.imageAssetId && (
            <div className="site-news-image" style={{ marginTop: 18 }}>
              <PlaceholderImage
                assetId={block.imageAssetId}
                alt={block.heading}
                className="site-news-image-img"
              />
            </div>
          )}
        </section>
      )

    case 'paragraph':
      return <p className="site-news-paragraph">{block.text}</p>

    case 'callout': {
      const variantCls =
        block.variant === 'warning'
          ? 'is-warning'
          : block.variant === 'danger'
            ? 'is-danger'
            : block.variant === 'info'
              ? 'is-info'
              : ''
      return <div className={`site-news-callout ${variantCls}`.trim()}>{block.text}</div>
    }

    case 'image':
      return (
        <figure className="site-news-image">
          <PlaceholderImage
            assetId={block.assetId}
            alt={block.caption ?? ''}
            className="site-news-image-img"
          />
          {block.caption && (
            <figcaption className="site-news-image-caption">{block.caption}</figcaption>
          )}
        </figure>
      )

    case 'table':
      return (
        <table className="site-news-table">
          <thead>
            <tr>
              {block.headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )

    case 'sourceComment':
      return (
        <div className="site-news-source">
          <span>{block.comment}</span>
          {block.linkPageId && (
            <>
              {' '}
              <Link to={sitePath(base, slugByPageId.get(block.linkPageId) ?? '')}>相关报道</Link>
            </>
          )}
        </div>
      )

    // form / loginForm / pdfViewer / nav / articleList 在本站数据中未出现；
    // 即便出现也降级为不渲染（避免崩溃），不门控任何访问。
    case 'form':
    case 'loginForm':
    case 'pdfViewer':
    case 'nav':
    case 'articleList':
      return null

    default:
      return null
  }
}
