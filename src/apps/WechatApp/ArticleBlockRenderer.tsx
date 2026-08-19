/**
 * WechatApp/ArticleBlockRenderer.tsx — 公众号文章正文块渲染器
 *
 * 复用 src/types ArticleBlock 联合（CLAUDE.md §3：依赖 src/ui ArticleBlock 渲染器；
 * src/ui 在 Phase4 同步构建中，为不阻塞且不触碰他人目录，本目录自带一个与契约一致的
 * 最小渲染器，签名稳定，待 src/ui 落地后可切换 import）。
 */
import type { ArticleBlock } from "@/types";

export interface ArticleBlockRendererProps {
  blocks: ArticleBlock[];
}

export function ArticleBlockRenderer({
  blocks,
}: ArticleBlockRendererProps): JSX.Element {
  return (
    <div className="wc-article-body">
      {blocks.map((b, i) => renderBlock(b, i))}
    </div>
  );
}

function renderBlock(b: ArticleBlock, i: number): JSX.Element {
  switch (b.type) {
    case "heading": {
      const Tag = (`h${b.level}` as "h1" | "h2" | "h3");
      return (
        <Tag key={i} className={`wc-article-h wc-article-h-${b.level}`}>
          {b.text}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={i} className="wc-article-p">
          {b.text}
        </p>
      );
    case "quote":
      return (
        <blockquote key={i} className="wc-article-quote">
          {b.text}
        </blockquote>
      );
    case "list":
      return b.ordered ? (
        <ol key={i} className="wc-article-list">
          {b.items.map((it, j) => (
            <li key={j}>{it}</li>
          ))}
        </ol>
      ) : (
        <ul key={i} className="wc-article-list">
          {b.items.map((it, j) => (
            <li key={j}>{it}</li>
          ))}
        </ul>
      );
    case "image":
      // 公众号文章配图暂以占位符展示（assetId 无对应公共资源时可由 phone-shell 替换）
      return (
        <figure key={i} className="wc-article-figure">
          <div className="wc-article-img-placeholder" data-asset-id={b.assetId}>
            [图片 {b.assetId}]
          </div>
          {b.caption && <figcaption>{b.caption}</figcaption>}
        </figure>
      );
    case "callout": {
      const variantCls = `wc-callout wc-callout-${b.variant}`;
      return (
        <div key={i} className={variantCls} role="note">
          {b.text}
        </div>
      );
    }
  }
}
