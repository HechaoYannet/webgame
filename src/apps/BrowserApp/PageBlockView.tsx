/**
 * PageBlock 渲染器 — 把 WebPage.blocks: PageBlock[] 渲染为站内伪造网页 DOM。
 *
 * 支持全部 11 种 block（src/types PageBlock 联合）：
 *   hero / nav / articleList / paragraph / callout / image(zoomable) / table /
 *   form / sourceComment / loginForm(puzzleId) / pdfViewer(assetId + requiresPuzzleId)。
 *
 * 关键机制（CLAUDE.md §4.2 + agent 定义）：
 *  - image.zoomable：点击放大（新希望文件袋、后墙钥匙等隐藏细节）。
 *  - table：天眼查工商信息 / 受试者名单。
 *  - form：校长信箱假表单，提交显示 onSubmitMessage（无作用）。
 *  - sourceComment：默认不渲染（页面源码视图才展示）；此处渲染为隐藏 HTML 注释+查看源码入口。
 *  - loginForm：绑 puzzleId → usePuzzle().submit(answer) → 引擎 PuzzleService 读 puzzles.json
 *    校验 + 执行 onSuccess effects（解锁页面/取证/推进章节），前端不持码。
 *  - pdfViewer：用 pdf.js 内嵌（PdfViewer 组件），加密的挂 requiresPuzzleId。
 *  - nav / articleList：站内 pageId 链接 → onNavigatePage(pageId) 回调。
 *
 * 纯展示组件，线索注册/取证/关卡副作用由 BrowserApp 页面层通过 engine hooks 统一触发。
 */
import { useState } from "react";
import type { PageBlock, PageId, PuzzleId } from "@/types";
import { usePuzzle } from "@/engine/hooks/usePuzzle";
import { PdfViewer } from "./PdfViewer";

interface PageBlockViewProps {
  block: PageBlock;
  /** 站内 pageId 链接回调（nav/articleList/loginForm 成功后跳转）。 */
  onNavigatePage: (pageId: PageId) => void;
  /** 切换查看源码视图（由页面层控制，sourceComment block 默认隐藏）。 */
  onViewSource?: () => void;
}

export function PageBlockView({ block, onNavigatePage, onViewSource }: PageBlockViewProps) {
  switch (block.type) {
    case "hero":
      return <HeroBlock block={block} />;
    case "nav":
      return <NavBlock block={block} onNavigatePage={onNavigatePage} />;
    case "articleList":
      return <ArticleListBlock block={block} onNavigatePage={onNavigatePage} />;
    case "paragraph":
      return <p className="web-page__paragraph">{block.text}</p>;
    case "callout":
      return <CalloutBlock block={block} />;
    case "image":
      return <ImageBlock block={block} />;
    case "table":
      return <TableBlock block={block} />;
    case "form":
      return <FormBlock block={block} />;
    case "sourceComment":
      // 页面正文默认不渲染源码注释；给一个"查看源代码"提示入口（藏后台地址线索）
      return onViewSource ? (
        <button type="button" className="web-page__view-source-link" onClick={onViewSource}>
          查看页面源代码
        </button>
      ) : null;
    case "loginForm":
      return <LoginFormBlock block={block} onNavigatePage={onNavigatePage} />;
    case "pdfViewer":
      return <PdfViewer block={block} />;
    default: {
      // 穷尽性检查：新增 block type 时 TS 报错
      const _exhaustive: never = block;
      void _exhaustive;
      return null;
    }
  }
}

/* -------------------- hero -------------------- */
function HeroBlock({ block }: { block: Extract<PageBlock, { type: "hero" }> }) {
  return (
    <header className="web-page__hero">
      {block.imageAssetId && (
        <img
          className="web-page__hero-img"
          src={import.meta.env.BASE_URL + "assets/" + block.imageAssetId}
          alt={block.heading}
          loading="lazy"
        />
      )}
      <h1 className="web-page__hero-heading">{block.heading}</h1>
      {block.subheading && <p className="web-page__hero-sub">{block.subheading}</p>}
    </header>
  );
}

/* -------------------- nav -------------------- */
function NavBlock({
  block,
  onNavigatePage,
}: {
  block: Extract<PageBlock, { type: "nav" }>;
  onNavigatePage: (pageId: PageId) => void;
}) {
  return (
    <nav className="web-page__nav">
      {block.links.map((link, i) => (
        <button
          key={`${link.pageId}-${i}`}
          type="button"
          className="web-page__nav-link"
          onClick={() => onNavigatePage(link.pageId)}
        >
          {link.label}
        </button>
      ))}
    </nav>
  );
}

/* -------------------- articleList -------------------- */
function ArticleListBlock({
  block,
  onNavigatePage,
}: {
  block: Extract<PageBlock, { type: "articleList" }>;
  onNavigatePage: (pageId: PageId) => void;
}) {
  return (
    <ul className="web-page__article-list">
      {block.items.map((item, i) => (
        <li key={`${item.pageId}-${i}`} className="web-page__article-item">
          <button
            type="button"
            className="web-page__article-link"
            onClick={() => onNavigatePage(item.pageId)}
          >
            <span className="web-page__article-title">{item.title}</span>
            {item.date && <span className="web-page__article-date">{item.date}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

/* -------------------- callout -------------------- */
function CalloutBlock({ block }: { block: Extract<PageBlock, { type: "callout" }> }) {
  return (
    <div className={`web-page__callout web-page__callout--${block.variant}`}>
      {block.text}
    </div>
  );
}

/* -------------------- image（zoomable） -------------------- */
function ImageBlock({ block }: { block: Extract<PageBlock, { type: "image" }> }) {
  const [zoomed, setZoomed] = useState(false);
  const src = import.meta.env.BASE_URL + "assets/" + block.assetId;
  return (
    <figure className="web-page__image">
      <img
        className="web-page__image-img"
        src={src}
        alt={block.caption ?? ""}
        loading="lazy"
        onClick={() => block.zoomable && setZoomed(true)}
        role={block.zoomable ? "button" : undefined}
        aria-label={block.zoomable ? "点击放大查看" : undefined}
      />
      {block.caption && <figcaption className="web-page__image-caption">{block.caption}</figcaption>}
      {block.zoomable && zoomed && (
        <div
          className="web-page__image-zoom-overlay"
          role="dialog"
          aria-label="放大查看"
          onClick={() => setZoomed(false)}
        >
          <img className="web-page__image-zoom-img" src={src} alt={block.caption ?? ""} />
          <p className="web-page__image-zoom-hint">点击任意处关闭</p>
        </div>
      )}
    </figure>
  );
}

/* -------------------- table -------------------- */
function TableBlock({ block }: { block: Extract<PageBlock, { type: "table" }> }) {
  return (
    <div className="web-page__table-wrap">
      <table className="web-page__table">
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
    </div>
  );
}

/* -------------------- form（假表单，如校长信箱） -------------------- */
function FormBlock({ block }: { block: Extract<PageBlock, { type: "form" }> }) {
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  return (
    <form
      className="web-page__form"
      onSubmit={(e) => {
        e.preventDefault();
        // 纯前端伪造：提交即显示成功消息，无任何后端作用（CLAUDE.md §4 纯前端零后端）
        setSubmitted(true);
        setName("");
        setContent("");
      }}
    >
      {submitted ? (
        <p className="web-page__form-done">{block.onSubmitMessage}</p>
      ) : (
        <>
          <label className="web-page__form-label">
            姓名
            <input
              className="web-page__form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="web-page__form-label">
            留言
            <textarea
              className="web-page__form-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />
          </label>
          <button className="web-page__form-submit" type="submit">
            提交
          </button>
        </>
      )}
    </form>
  );
}

/* -------------------- loginForm（后台登录，走 engine usePuzzle） -------------------- */
function LoginFormBlock({
  block,
  onNavigatePage,
}: {
  block: Extract<PageBlock, { type: "loginForm" }>;
  onNavigatePage: (pageId: PageId) => void;
}) {
  const puzzleId = block.puzzleId as PuzzleId;
  // 引擎 usePuzzle：submit(password)→引擎校验 puzzles.json + 执行 onSuccess effects
  const puzzle = usePuzzle(puzzleId);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 引擎已校验成功 → 本页"已登录"
  if (puzzle.solved) {
    return (
      <div className="web-page__login-done">
        <p>登录成功。已为您解锁相关页面。</p>
        <p className="web-page__login-hint">请通过站内导航或地址栏访问已解锁页面。</p>
        {/* 提供"返回首页"占位，实际跳转由导航触发 */}
        <button type="button" className="web-page__form-submit" onClick={() => onNavigatePage(puzzleId)}>
          继续
        </button>
      </div>
    );
  }

  const lastError = puzzle.lastResult?.error ?? null;
  const locked = puzzle.locked;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || locked) return;
    setError(null);
    // submit 同步调引擎 PuzzleService（read puzzles.json + matchStrategy 校验 +
    // executeEffects(onSuccess) → 解锁页面/取证/推进章节）。前端不持码。
    const result = puzzle.submit(password);
    if (!result.success) {
      setError(result.error ?? "密码错误。");
    }
    // 成功：puzzle.solved 会在下一次渲染变 true，切到"已登录"视图
  };

  return (
    <form className="web-page__login-form" onSubmit={handleSubmit}>
      <label className="web-page__form-label">
        密码
        <input
          className="web-page__form-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="请输入登录密码"
          autoFocus
        />
      </label>
      <button className="web-page__form-submit" type="submit" disabled={locked}>
        {locked ? "已锁定" : "登录"}
      </button>
      {(error || lastError) && (
        <p className="web-page__form-error">{error ?? lastError}</p>
      )}
    </form>
  );
}
