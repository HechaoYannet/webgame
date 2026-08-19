/**
 * WechatApp/MomentsTab.tsx — 朋友圈 Tab
 *
 * - 读 wechat/moments.json 渲染 MomentsPost。
 * - 配图可放大查看 → 放大见隐藏细节（信息架构 §2.3）。
 * - 点赞/评论展示；被删评论显示"缓存还在"（信息架构 §四.4：家长心声被删）。
 * - 查看 → useClue().view({kind:"wechat-moment",momentId})。
 * - link.pageId → 站内跳转（§6.4）。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Character, MomentsPost } from "@/types";
import { Avatar } from "./Avatar";
import {
  buildCharacterDictionary,
  displayName,
  loadWechatMoments,
  type CharacterDictionary,
} from "./data";
import { useClue, useGameState, useNavigateToPage } from "./wechatEngine";
import { ImageViewer } from "./ImageViewer";

export interface MomentsTabProps {
  characters: Character[];
}

export function MomentsTab({ characters }: MomentsTabProps): JSX.Element {
  const [posts, setPosts] = useState<MomentsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{
    assetId: string;
    caption?: string;
  } | null>(null);

  const dict = useMemo(
    () => buildCharacterDictionary(characters),
    [characters],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadWechatMoments()
      .then((p) => {
        if (cancelled) return;
        // 按 createdAt 倒序（最新在上）
        setPosts([...p].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
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

  return (
    <div className="wc-moments-tab">
      <header className="wc-header">
        <div className="wc-header-titles">
          <div className="wc-header-title">朋友圈</div>
        </div>
      </header>
      {loading && <div className="wc-empty">加载中…</div>}
      {!loading && error && (
        <div className="wc-empty wc-error">加载失败：{error}</div>
      )}
      {!loading && !error && posts.length === 0 && (
        <div className="wc-empty">暂无动态</div>
      )}
      {!loading && !error && (
        <ul className="wc-moments-list">
          {posts.map((p) => (
            <MomentRow
              key={p.id}
              post={p}
              dict={dict}
              onZoom={(assetId, caption) =>
                setViewer({ assetId, caption })
              }
            />
          ))}
        </ul>
      )}
      <ImageViewer
        assetId={viewer?.assetId ?? ""}
        caption={viewer?.caption}
        open={viewer !== null}
        onClose={() => setViewer(null)}
      />
    </div>
  );
}

interface MomentRowProps {
  post: MomentsPost;
  dict: CharacterDictionary;
  onZoom: (assetId: string, caption?: string) => void;
}

function MomentRow({ post, dict, onZoom }: MomentRowProps): JSX.Element {
  const clue = useClue();
  const gameState = useGameState();
  const navigateToPage = useNavigateToPage();
  const author = dict.byId.get(post.authorCharacterId);

  // 进入视图即上报一次查看（ClueRegistry 查表决定是否注册线索/收集证据）
  const onView = useCallback(() => {
    clue.view({ kind: "wechat-moment", momentId: post.id });
    gameState.viewMoment(post.id);
  }, [clue, gameState, post.id]);

  useEffect(() => {
    onView();
  }, [onView]);

  const likes = post.likes ?? [];
  const comments = post.comments ?? [];

  return (
    <li className="wc-moment">
      <div className="wc-moment-head">
        <Avatar
          character={author}
          characterId={post.authorCharacterId}
          size={40}
          grey={(author as (Character & { status?: string }) | undefined)?.status === "lost"}
        />
        <div className="wc-moment-meta">
          <div className="wc-moment-author">
            {author ? displayName(author) : "未知"}
          </div>
          <div className="wc-moment-time">
            {formatTimestamp(post.createdAt)}
          </div>
        </div>
      </div>

      {post.text && <div className="wc-moment-text">{post.text}</div>}

      {post.assetIds && post.assetIds.length > 0 && (
        <div className="wc-moment-images">
          {post.assetIds.map((aid) => (
            <button
              type="button"
              key={aid}
              className="wc-moment-image"
              data-asset-id={aid}
              onClick={() => onZoom(aid)}
              aria-label="放大查看图片"
            >
              <span className="wc-moment-image-ph">[图 {aid}]</span>
            </button>
          ))}
        </div>
      )}

      {post.link && (
        <button
          type="button"
          className="wc-moment-link"
          onClick={() => post.link?.pageId && navigateToPage(post.link.pageId)}
        >
          <div className="wc-link-title">
            {post.link.title ?? "站内页面"}
          </div>
          {post.link.url && (
            <div className="wc-link-url">{post.link.url}</div>
          )}
        </button>
      )}

      {(likes.length > 0 || comments.length > 0) && (
        <div className="wc-moment-interactions">
          {likes.length > 0 && (
            <div className="wc-moment-likes">
              <span className="wc-like-icon">♥</span>
              {likes
                .map((id) => displayName(dict.byId.get(id)))
                .join("，")}
            </div>
          )}
          {comments.length > 0 && (
            <ul className="wc-moment-comments">
              {comments.map((c, i) => (
                <li
                  key={i}
                  className={`wc-moment-comment${
                    c.deleted ? " wc-moment-comment-deleted" : ""
                  }`}
                >
                  <span className="wc-comment-author">
                    {displayName(dict.byId.get(c.authorCharacterId))}：
                  </span>
                  {c.deleted ? (
                    <span className="wc-comment-deleted-text">
                      该评论已被删除（缓存还在）
                    </span>
                  ) : (
                    <span className="wc-comment-text">{c.text}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function formatTimestamp(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
}
