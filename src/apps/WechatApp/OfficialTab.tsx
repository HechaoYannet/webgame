/**
 * WechatApp/OfficialTab.tsx — 公众号 Tab
 *
 * - 读 wechat/official-accounts.json 渲染文章列表+详情（按公众号分组）。
 * - 用 ArticleBlockRenderer 渲染正文块（与 src/ui 一致的最小实现，本目录自备）。
 * - 论文 AI 解读改为独立站 site-ai-pdf：玩家先在 arxiv 下载论文 PDF，再点公众号
 *   文章链接进入 AI 解读站上传校验（FilesApp 已删除，公众号内不再伪造上传）。
 *   本组件不持答案，答案在 puzzles.json；不生成解读内容。
 * - 详情：文章 link.pageId 点击调 openSitePage(article.link.pageId)（新标签开站点）。
 */
import { useEffect, useMemo, useState } from "react";
import type { Character, OfficialAccountArticle } from "@/types";
import {
  buildCharacterDictionary,
  type CharacterDictionary,
} from "./data";
import { getAllArticles } from "@/data/loader";
import { Avatar } from "./Avatar";
import { ArticleBlockRenderer } from "./ArticleBlockRenderer";
import { openSitePage } from "@/sites/sitePage";

export interface OfficialTabProps {
  characters: Character[];
}

export function OfficialTab({ characters }: OfficialTabProps): JSX.Element {
  const [articles, setArticles] = useState<OfficialAccountArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);

  const dict = useMemo(
    () => buildCharacterDictionary(characters),
    [characters],
  );

  // loader 已在 main.tsx await 过，getAllArticles 同步安全。
  useEffect(() => {
    try {
      setArticles(getAllArticles());
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
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
