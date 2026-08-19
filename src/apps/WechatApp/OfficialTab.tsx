/**
 * WechatApp/OfficialTab.tsx — 公众号 Tab
 *
 * - 读 wechat/official-accounts.json 渲染文章列表+详情（按公众号分组）。
 * - 用 ArticleBlockRenderer 渲染正文块（与 src/ui 一致的最小实现，本目录自备）。
 * - "论文AI翻译解读"公众号上传入口：
 *   玩家点上传 → usePuzzle().submit("puzzle-upload-paper", ...) → 引擎判定论文 PDF 已在 FilesApp
 *   → 触发 isGeneratedContent:true 的预设解读文章渲染（CLAUDE.md §6.5，伪造上传解析）。
 *   本组件不持答案，答案在 puzzles.json；不生成解读内容，文章 bodyBlocks 在数据里预设。
 * - 查看 → useClue().view({kind:"wechat-article",articleId})。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Character, OfficialAccountArticle } from "@/types";
import {
  buildCharacterDictionary,
  loadWechatArticles,
  type CharacterDictionary,
} from "./data";
import { Avatar } from "./Avatar";
import { ArticleBlockRenderer } from "./ArticleBlockRenderer";
import { usePuzzle } from "./wechatEngine";
import { openSitePage } from "@/sites/sitePage";

export interface OfficialTabProps {
  characters: Character[];
}

/** 该公众号上传动作触发的谜题 ID（CLAUDE.md §6.5）。 */
const UPLOAD_PUZZLE_ID = "puzzle-upload-paper";
/** 该谜题成功后应渲染的预设解读文章 ID（数据中 isGeneratedContent:true）。 */
const AI_INTERPRET_ARTICLE_ID = "article-ai-interpret";

export function OfficialTab({ characters }: OfficialTabProps): JSX.Element {
  const [articles, setArticles] = useState<OfficialAccountArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");

  const dict = useMemo(
    () => buildCharacterDictionary(characters),
    [characters],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadWechatArticles()
      .then((a) => {
        if (cancelled) return;
        setArticles(a);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 单文章详情视图（修卡死 bug：不在 render 内 setState——当 activeArticleId 指向已不存在的
  // 文章时，移到 useEffect 重置，避免 render 期 setActiveArticleId 触发 unstable render / 卡死）。
  useEffect(() => {
    if (activeArticleId && !articles.find((a) => a.id === activeArticleId)) {
      setActiveArticleId(null);
    }
  }, [activeArticleId, articles]);

  if (activeArticleId) {
    const art = articles.find((a) => a.id === activeArticleId);
    if (art) {
      return (
        <ArticleDetail
          article={art}
          dict={dict}
          onBack={() => setActiveArticleId(null)}
        />
      );
    }
  }

  // 列表：按公众号分组
  const grouped = groupByAccount(articles);
  const accountNames = [...grouped.keys()];

  return (
    <div className="wc-official-tab">
      <header className="wc-header">
        <div className="wc-header-titles">
          <div className="wc-header-title">公众号</div>
        </div>
      </header>

      {/* 论文 AI 翻译解读：上传入口（CLAUDE.md §6.5） */}
      <UploadPaperCard
        status={uploadStatus}
        onDone={(articleId) => setActiveArticleId(articleId)}
        articles={articles}
        setStatus={setUploadStatus}
      />

      {loading && <div className="wc-empty">加载中…</div>}
      {!loading && error && (
        <div className="wc-empty wc-error">加载失败：{error}</div>
      )}
      {!loading && !error && (
        <div className="wc-official-groups">
          {accountNames.map((name) => (
            <AccountGroup
              key={name}
              accountName={name}
              articles={grouped.get(name) ?? []}
              dict={dict}
              onOpen={(id) => setActiveArticleId(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 论文 AI 解读上传卡（§6.5 伪造上传解析）
 * ------------------------------------------------------------------ */

interface UploadPaperCardProps {
  status: "idle" | "uploading" | "done" | "error";
  onDone: (articleId: string) => void;
  articles: OfficialAccountArticle[];
  setStatus: (s: "idle" | "uploading" | "done" | "error") => void;
}

function UploadPaperCard({
  status,
  setStatus,
  onDone,
  articles,
}: UploadPaperCardProps): JSX.Element {
  const puzzle = usePuzzle();

  // 引擎路径（CLAUDE.md §6.5）：puzzle-upload-paper 解成功 → 引擎执行 onSuccess
  // （collectEvidence ev-paper-pdf + registerClue clue-lab-backend-address + advanceChapter ch-5）；
  // article-ai-interpret 的 triggerUploadPuzzleId===puzzle-upload-paper，解后即应渲染。
  const alreadySolved = puzzle.isSolved(UPLOAD_PUZZLE_ID);
  useEffect(() => {
    if (alreadySolved && status === "idle") {
      setStatus("done");
    }
  }, [alreadySolved, status, setStatus]);

  const handleUpload = useCallback(() => {
    if (status === "uploading" || status === "done") return;
    setStatus("uploading");
    // CLAUDE.md §6.5：前端检测论文 PDF 已在 FilesApp → 触发 isGeneratedContent 解读文章。
    // 本组件不检测文件系统（数据即契约，FilesApp 由 frontend-phone-apps 维护）；
    // 直接 submit 该 uploadAndInterpret 谜题，引擎据 puzzles.json answer(paper-source-crystal.pdf)
    // 判定 + 执行 onSuccess。成功 → 引擎回写 solvedPuzzleIds + collectEvidence + registerClue。
    puzzle.submit(UPLOAD_PUZZLE_ID, { answer: "paper-source-crystal.pdf" });
    // 给伪造上传一点延迟以模拟"解析中"；引擎 submit 同步执行，900ms 后刷新 done 状态
    window.setTimeout(() => {
      // 引擎已执行 onSuccess；重新读取 isSolved 驱动 done（避免乐观更新脱靶）
      if (puzzle.isSolved(UPLOAD_PUZZLE_ID)) {
        setStatus("done");
      } else {
        setStatus("error");
      }
    }, 900);
  }, [puzzle, status, setStatus]);

  if (status === "done") {
    const art = articles.find(
      (a) =>
        a.id === AI_INTERPRET_ARTICLE_ID && a.isGeneratedContent === true,
    );
    return (
      <div className="wc-upload-card wc-upload-done">
        <div className="wc-upload-title">论文AI翻译解读 · 解读已生成</div>
        <div className="wc-upload-desc">
          AI 解读已完成，点击查看：
        </div>
        {art ? (
          <button
            type="button"
            className="wc-upload-result-link"
            onClick={() => onDone(art.id)}
          >
            {art.title}
          </button>
        ) : (
          <div className="wc-upload-desc">解读文章加载中…</div>
        )}
      </div>
    );
  }

  return (
    <div className="wc-upload-card">
      <div className="wc-upload-title">论文AI翻译解读</div>
      <div className="wc-upload-desc">
        上传英文论文 PDF，AI 自动生成中文结构与关键发现解读。
        {status === "uploading" && "（正在解析…）"}
      </div>
      <button
        type="button"
        className="wc-upload-button"
        onClick={handleUpload}
        disabled={status === "uploading"}
      >
        {status === "uploading" ? "解析中…" : "上传论文 PDF"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 公众号分组 + 列表
 * ------------------------------------------------------------------ */

function groupByAccount(
  articles: OfficialAccountArticle[],
): Map<string, OfficialAccountArticle[]> {
  const map = new Map<string, OfficialAccountArticle[]>();
  for (const a of articles) {
    const arr = map.get(a.accountName) ?? [];
    arr.push(a);
    map.set(a.accountName, arr);
  }
  // 每组内按发布时间倒序
  for (const [k, arr] of [...map.entries()]) {
    map.set(
      k,
      arr.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    );
  }
  return map;
}

interface AccountGroupProps {
  accountName: string;
  articles: OfficialAccountArticle[];
  dict: CharacterDictionary;
  onOpen: (id: string) => void;
}

function AccountGroup({
  accountName,
  articles,
  dict,
  onOpen,
}: AccountGroupProps): JSX.Element {
  // 公众号关联联系人：contacts.json 中 isOfficialAccount 且 wechatNickname 匹配
  // 这里用 name 简单匹配头像首字符
  const placeholder = dict.list.find(
    (c) => c.displayName === accountName || c.name === accountName,
  );
  return (
    <section className="wc-account-group">
      <h3 className="wc-account-name">
        <Avatar character={placeholder} size={20} /> {accountName}
      </h3>
      <ul className="wc-article-list">
        {articles.map((a) => (
          <ArticleRow key={a.id} article={a} onOpen={() => onOpen(a.id)} />
        ))}
      </ul>
    </section>
  );
}

interface ArticleRowProps {
  article: OfficialAccountArticle;
  onOpen: () => void;
}

function ArticleRow({ article, onOpen }: ArticleRowProps): JSX.Element {
  return (
    <li
      className="wc-article-row"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="wc-article-row-title">{article.title}</div>
      <div className="wc-article-row-meta">
        <span>{formatDate(article.publishedAt)}</span>
        {article.isGeneratedContent && (
          <span className="wc-tag-gen">AI 解读</span>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * 文章详情
 * ------------------------------------------------------------------ */

interface ArticleDetailProps {
  article: OfficialAccountArticle;
  dict: CharacterDictionary;
  onBack: () => void;
}

function ArticleDetail({
  article,
  onBack,
}: ArticleDetailProps): JSX.Element {
  // （重写后）线索注册装饰已废：查看文章不再注册线索。原 useEffect(onView,[onView]) 死循环
  // （onView 依赖每渲染新的 clue 对象）随之移除——这是"点公众号文章卡死"的根因。

  return (
    <div className="wc-article-detail">
      <header className="wc-header">
        <button
          type="button"
          className="wc-header-back"
          onClick={onBack}
          aria-label="返回"
        >
          ‹
        </button>
        <div className="wc-header-titles">
          <div className="wc-header-title">{article.accountName}</div>
        </div>
      </header>

      <article className="wc-article">
        <h1 className="wc-article-h1">{article.title}</h1>
        <div className="wc-article-meta">
          <span>{article.accountName}</span>
          <span>·</span>
          <span>{formatDate(article.publishedAt)}</span>
          {article.isGeneratedContent && (
            <span className="wc-tag-gen">AI 生成</span>
          )}
          {article.triggerUploadPuzzleId && (
            <span className="wc-tag-puzzle">需先上传论文</span>
          )}
        </div>
        <ArticleBlockRenderer blocks={article.bodyBlocks} />
        {article.link && article.link.pageId && (
          <div className="wc-article-link">
            <button
              type="button"
              className="wc-article-link-btn"
              onClick={() => openSitePage(article.link!.pageId!)}
            >
              {article.link.title ?? "访问网页"} ›
            </button>
          </div>
        )}
        {article.url && !article.link?.pageId && (
          <div className="wc-article-url">原文链接：{article.url}（仅显示）</div>
        )}
      </article>
    </div>
  );
}

function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : iso;
}
