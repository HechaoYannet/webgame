/**
 * BrowserApp — 模拟手机浏览器（机制最复杂的前端 App）。
 *
 * 三个核心机制（CLAUDE.md §4.2 discoverableBy + agent 定义）：
 *   1. 地址栏 + URL 匹配器：玩家输入 URL → matchUrl() 命中公开页 / urlSuffix 隐藏页；
 *      命中后渲染对应 page JSON 的 blocks。
 *   2. 查看源代码：玩家点\"查看源代码\" → 显示该页 sourceComment block 的 HTML 注释
 *      （藏后台地址，如校长信箱藏 xw.zhangqiang.com.cn/admin、实验室官网藏 lab.shanhe-med.cn/admin）。
 *   3. 百度搜索伪造：地址栏输入 baidu.com 或 baidu.com/s?wd=xxx → baiduSearch() 倒排索引返回结果。
 *
 * 引擎集成（CLAUDE.md §3 + §6.6 + §onViewEffects）：删除原 BrowserApp/engine.ts 桥接层，
 *   import 全部指向 @/engine/hooks：
 *   - 后台登录（loginForm block 挂 puzzleId）：PageBlockView 内 usePuzzle(puzzleId).submit(password)
 *     → 引擎 PuzzleService 读 puzzles.json 校验（前端不持码）→ 成功执行 onSuccess effects
 *     （实验室后台成功解锁经费报告页；倒计时由页面首访 onViewEffects 触发，非此处）。
 *   - 查看关键页面：useClue().view({ kind:\"page\", pageId }) → engine ClueRegistry 查表注册线索/取证。
 *   - page-lab-funding-report 首访：useChapter().visitPage(pageId) → engine ChapterDirector 在
 *     gameStore.visitPage 首次记录时 emit pageFirstVisited → 触发 onViewEffects
 *     （3分钟倒计时 + 威胁短信 + 刀哥门铃 + 心跳）。本组件只渲染页面内容 + 监听
 *     useCountdown(\"countdown-finale\") 在地址栏旁显示剩余时间，副作用完全由 engine 触发。
 *
 * 严格 CLAUDE.md §2：import.meta.env.BASE_URL 原样出现（在 pageData.ts 拼数据路径）。
 * 纯前端零后端：所有\"网站\"都是站内伪造页（CLAUDE.md §4）。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PageId, WebPage } from "@/types";
import {
  baiduSearch,
  extractSourceComments,
  isBaiduSearch,
  extractBaiduQuery,
  loadPage,
  matchUrl,
  normalizeUrl,
  type UrlMatch,
} from "./pageData";
import { PageBlockView } from "./PageBlockView";
import { useClue } from "@/engine/hooks/useClue";
import { useCountdown } from "@/engine/hooks/useCountdown";
import { useChapter } from "@/engine/hooks/useChapter";

type View =
  | { kind: "loading" }
  | { kind: "notFound"; input: string }
  | { kind: "page"; page: WebPage; via: "direct" | "urlSuffix" }
  | { kind: "baiduSearch"; query: string; results: PageId[]; loading: boolean }
  | { kind: "sourceView"; page: WebPage; comments: string[] };

const COUNTDOWN_ID = "countdown-finale";

export default function BrowserApp() {
  // 引擎真源：clue 注册 + 倒计时监听 + 章节导演（visitPage 触发 onViewEffects）
  const clueApi = useClue();
  const chapter = useChapter();
  const countdown = useCountdown(COUNTDOWN_ID);

  const [addressInput, setAddressInput] = useState("");
  const [view, setView] = useState<View>({ kind: "loading" });
  const [history, setHistory] = useState<PageId[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // 初始：打开百度首页作为浏览器起始页
  useEffect(() => {
    void goRaw("https://www.baidu.com/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 站内 pageId 跳转：从 nav/链接/loginForm 触发 */
  const navigateToPageId = useCallback(
    async (pageId: PageId) => {
      try {
        const page = await loadPage(pageId);
        setAddressInput(page.url);
        enterPage(page, "direct");
      } catch {
        setView({ kind: "notFound", input: pageId });
      }
    },
    // enterPage 在下方定义，依赖见下
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * 进入一个已解析的 WebPage：记历史 + 引擎副作用 + 切视图。
   *
   * 引擎驱动（无本地降级）：
   *  - useChapter().visitPage(pageId)：gameStore.visitPage 记录访问；**首次**访问时
   *    ChapterDirector emit pageFirstVisited → 执行 page.onViewEffects（经费报告四件套等）。
   *  - useClue().view({ kind:\"page\", pageId })：engine ClueRegistry 查 clue-map.json，
   *    autoRegisterOnView 的线索注册 + 关联证据收集 + 备忘录 + toast（去重由 engine 负责）。
   */
  const enterPage = useCallback(
    (page: WebPage, via: "direct" | "urlSuffix") => {
      // 历史：截断前进分支
      setHistory((h) => {
        const cut = h.slice(0, historyIdx + 1);
        if (cut[cut.length - 1] !== page.id) cut.push(page.id);
        setHistoryIdx(cut.length - 1);
        return cut;
      });
      setView({ kind: "page", page, via });

      // 引擎：页面首访触发 onViewEffects（倒计时/短信/门铃/心跳）
      // gameStore 内部去重，已访问过的页面不会二次触发副作用。
      chapter.visitPage(page.id);

      // 引擎：查看即取证——ClueRegistry 查表决定是否注册线索/证据
      void clueApi.view({ kind: "page", pageId: page.id }, null);
    },
    [historyIdx, chapter, clueApi],
  );

  /** 处理地址栏原始输入：分流 baidu 搜索 / url 匹配 */
  const goRaw = useCallback(
    async (raw: string) => {
      const input = raw.trim();
      if (!input) return;
      setAddressInput(input);
      setView({ kind: "loading" });

      // 百度搜索分流
      const normalized = normalizeUrl(input);
      if (isBaiduSearch(normalized)) {
        const query = extractBaiduQuery(input) || "";
        setView({ kind: "baiduSearch", query, results: [], loading: true });
        try {
          const results = await baiduSearch(query);
          setView({ kind: "baiduSearch", query, results, loading: false });
        } catch {
          setView({ kind: "baiduSearch", query, results: [], loading: false });
        }
        // 搜索本身也记历史（用 baidu url 占位）
        return;
      }

      // URL 匹配
      try {
        const match: UrlMatch = await matchUrl(normalized);
        if (match.kind === "page") {
          enterPage(match.page, match.via);
        } else {
          setView({ kind: "notFound", input });
        }
      } catch {
        setView({ kind: "notFound", input });
      }
    },
    [enterPage],
  );

  /** 后退/前进 */
  const goBack = useCallback(async () => {
    if (historyIdx <= 0) return;
    const idx = historyIdx - 1;
    const pid = history[idx];
    if (!pid) return;
    setHistoryIdx(idx);
    try {
      const page = await loadPage(pid);
      setAddressInput(page.url);
      setView({ kind: "page", page, via: "direct" });
    } catch {
      setView({ kind: "notFound", input: pid });
    }
  }, [history, historyIdx]);
  const goForward = useCallback(async () => {
    if (historyIdx >= history.length - 1) return;
    const idx = historyIdx + 1;
    const pid = history[idx];
    if (!pid) return;
    setHistoryIdx(idx);
    try {
      const page = await loadPage(pid);
      setAddressInput(page.url);
      setView({ kind: "page", page, via: "direct" });
    } catch {
      setView({ kind: "notFound", input: pid });
    }
  }, [history, historyIdx]);

  /** 查看源代码：抽取当前页 sourceComment 注释 */
  const openSourceView = useCallback(async () => {
    if (view.kind !== "page") return;
    const comments = extractSourceComments(view.page);
    setView({ kind: "sourceView", page: view.page, comments });
  }, [view]);

  const isLoading = view.kind === "loading";

  return (
    <div className={`browser-app${countdown.active || countdown.expired ? " browser-app--alert" : ""}`}>
      {/* 顶部状态栏：地址栏 + 倒计时（终章） */}
      <header className="browser-app__bar">
        <div className="browser-app__nav-btns">
          <button
            type="button"
            className="browser-app__nav-btn"
            onClick={goBack}
            disabled={historyIdx <= 0}
            aria-label="后退"
          >
            ◀
          </button>
          <button
            type="button"
            className="browser-app__nav-btn"
            onClick={goForward}
            disabled={historyIdx >= history.length - 1}
            aria-label="前进"
          >
            ▶
          </button>
        </div>
        <form
          className="browser-app__address-form"
          onSubmit={(e) => {
            e.preventDefault();
            void goRaw(addressInput);
          }}
        >
          <input
            className="browser-app__address-input"
            type="text"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="输入网址或搜索"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="browser-app__go-btn" type="submit" disabled={isLoading}>
            {isLoading ? "…" : "前往"}
          </button>
        </form>
        {/* 终章倒计时（经费报告页首访触发，由 engine 启动） */}
        {(countdown.active || countdown.expired) && (
          <CountdownBadge remainingSec={countdown.remainingSec} expired={countdown.expired} />
        )}
      </header>

      {/* 内容区 */}
      <main className="browser-app__content">
        {view.kind === "loading" && <div className="browser-app__loading">加载中…</div>}
        {view.kind === "notFound" && (
          <NotFoundView input={view.input} />
        )}
        {view.kind === "baiduSearch" && (
          <BaiduSearchView
            query={view.query}
            results={view.results}
            loading={view.loading}
            onOpenPage={navigateToPageId}
          />
        )}
        {view.kind === "page" && (
          <PageView
            page={view.page}
            via={view.via}
            onNavigatePage={navigateToPageId}
            onViewSource={openSourceView}
            onReturnFromSource={async () => {
              // 从源码视图返回当前页
              try {
                const page = await loadPage(view.page.id);
                setView({ kind: "page", page, via: view.via });
              } catch {
                /* ignore */
              }
            }}
          />
        )}
        {view.kind === "sourceView" && (
          <SourceView
            page={view.page}
            comments={view.comments}
            onClose={async () => {
              try {
                const page = await loadPage(view.page.id);
                setView({ kind: "page", page, via: "direct" });
              } catch {
                setView({ kind: "notFound", input: view.page.id });
              }
            }}
          />
        )}
      </main>
    </div>
  );
}

/* -------------------- 倒计时徽章（终章） -------------------- */
function CountdownBadge({ remainingSec, expired }: { remainingSec: number; expired: boolean }) {
  const mm = Math.floor(Math.max(0, remainingSec) / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(Math.max(0, remainingSec) % 60)
    .toString()
    .padStart(2, "0");
  return (
    <div
      className={`browser-app__countdown${expired ? " browser-app__countdown--expired" : ""}`}
      role="timer"
      aria-label={expired ? "倒计时已结束" : `剩余 ${mm} 分 ${ss} 秒`}
    >
      {expired ? "TIME OUT" : `${mm}:${ss}`}
    </div>
  );
}

/* -------------------- 页面视图 -------------------- */
function PageView({
  page,
  via,
  onNavigatePage,
  onViewSource,
  onReturnFromSource,
}: {
  page: WebPage;
  via: "direct" | "urlSuffix";
  onNavigatePage: (pageId: PageId) => void;
  onViewSource: () => void;
  onReturnFromSource: () => void;
}) {
  // 隐藏入口提示：urlSuffix 命中时给玩家一句"你发现了一个隐藏入口"
  return (
    <article className="web-page" data-page-id={page.id}>
      {via === "urlSuffix" && (
        <div className="web-page__hidden-hint" role="status">
          你发现了一个隐藏入口。
        </div>
      )}
      <div className="web-page__title-bar">
        <span className="web-page__title">{page.title}</span>
      </div>
      <div className="web-page__blocks">
        {page.blocks.map((block, i) => (
          <PageBlockView
            key={i}
            block={block}
            onNavigatePage={onNavigatePage}
            onViewSource={onViewSource}
          />
        ))}
      </div>
      <button type="button" className="web-page__view-source-link" onClick={onViewSource}>
        查看页面源代码
      </button>
      {/* 返回钩子占位（供 sourceView 返回时复用当前页对象） */}
      <span hidden>
        <button type="button" onClick={onReturnFromSource} />
      </span>
    </article>
  );
}

/* -------------------- 查看源代码视图 -------------------- */
function SourceView({
  page,
  comments,
  onClose,
}: {
  page: WebPage;
  comments: string[];
  onClose: () => void;
}) {
  const sourceText = useMemo(() => {
    // 伪造成该页 HTML 源码：标题 + 各 block 占位 + sourceComment 注释嵌入
    const lines: string[] = [];
    lines.push(`<html>`);
    lines.push(`<head><title>${page.title}</title></head>`);
    lines.push(`<body>`);
    for (const block of page.blocks) {
      if (block.type === "sourceComment") {
        lines.push(`  ${block.comment}`);
      } else if (block.type === "hero") {
        lines.push(`  <h1>${block.heading}</h1>`);
      } else if (block.type === "paragraph") {
        lines.push(`  <p>${block.text}</p>`);
      } else if (block.type === "callout") {
        lines.push(`  <!-- callout: ${block.variant} -->`);
        lines.push(`  <div class="callout">${block.text}</div>`);
      } else if (block.type === "nav") {
        lines.push(`  <nav>${block.links.map((l) => `<a href="#${l.pageId}">${l.label}</a>`).join("")}</nav>`);
      } else if (block.type === "loginForm") {
        lines.push(`  <form data-puzzle="${block.puzzleId}"><!-- 登录表单 --></form>`);
      } else if (block.type === "pdfViewer") {
        lines.push(`  <iframe src="assets/${block.assetId}"></iframe>`);
      } else {
        lines.push(`  <!-- ${block.type} block -->`);
      }
    }
    lines.push(`</body></html>`);
    return lines.join("\n");
  }, [page]);

  return (
    <div className="web-page__source">
      <div className="web-page__source-head">
        <span>查看源代码 — {page.url}</span>
        <button type="button" className="web-page__source-close" onClick={onClose}>
          返回页面
        </button>
      </div>
      <pre className="web-page__source-pre">
        <code>{sourceText}</code>
      </pre>
      {comments.length === 0 && (
        <p className="web-page__source-empty">本页源码中未发现特殊注释。</p>
      )}
    </div>
  );
}

/* -------------------- 百度搜索视图 -------------------- */
function BaiduSearchView({
  query,
  results,
  loading,
  onOpenPage,
}: {
  query: string;
  results: PageId[];
  loading: boolean;
  onOpenPage: (pageId: PageId) => void;
}) {
  const [pageMetas, setPageMetas] = useState<{ id: PageId; title: string; url: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const metas = await Promise.all(
        results.map(async (pid) => {
          try {
            const p = await loadPage(pid);
            return { id: pid, title: p.title, url: p.url };
          } catch {
            return { id: pid, title: pid, url: "" };
          }
        }),
      );
      if (!cancelled) setPageMetas(metas);
    })();
    return () => {
      cancelled = true;
    };
  }, [results]);

  return (
    <div className="baidu-search">
      <div className="baidu-search__bar">
        <span className="baidu-search__logo">百度</span>
        <span className="baidu-search__query">{query && `搜索"${query}"`}</span>
      </div>
      {loading ? (
        <div className="browser-app__loading">搜索中…</div>
      ) : pageMetas.length === 0 ? (
        <div className="baidu-search__empty">
          {query ? "未找到相关结果。" : "在上方地址栏输入关键词搜索，或直接输入网址访问。"}
        </div>
      ) : (
        <ul className="baidu-search__results">
          {pageMetas.map((m) => (
            <li key={m.id} className="baidu-search__item">
              <button
                type="button"
                className="baidu-search__item-title"
                onClick={() => onOpenPage(m.id)}
              >
                {m.title}
              </button>
              {m.url && <p className="baidu-search__item-url">{m.url}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------- 404 视图 -------------------- */
function NotFoundView({ input }: { input: string }) {
  return (
    <div className="browser-app__not-found">
      <h2>无法访问此网站</h2>
      <p className="browser-app__not-found-url">{input}</p>
      <p className="browser-app__not-found-hint">
        检查网址是否正确，或在百度搜索相关内容。
      </p>
    </div>
  );
}
