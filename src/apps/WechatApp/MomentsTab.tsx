/**
 * WechatApp/MomentsTab.tsx — 朋友圈 Tab（重设计：真实微信朋友圈视觉）
 *
 * - 顶部 Cover 区域：渐变背景 + 半透明标题栏 + 玩家头像/昵称。
 * - Feed：左侧圆形头像 + 右侧蓝色昵称/时间/正文/3 列图片网格/链接卡片/点赞评论。
 * - 配图可放大查看 → 放大见隐藏细节（信息架构 §2.3）。
 * - 点赞/评论展示；被删评论显示"缓存还在"。
 * - link.pageId → 站内跳转（§6.4）。
 */
import { useEffect, useMemo, useState } from "react";
import type { Character, MomentsPost } from "@/types";
import { Avatar } from "./Avatar";
import {
  buildCharacterDictionary,
  displayName,
  type CharacterDictionary,
} from "./data";
import { getMoments } from "@/data/loader";
import { formatShortDateTime } from "@/utils/time";
import { useNavigateToPage } from "./wechatEngine";
import { ImageViewer } from "./ImageViewer";
import { MomentImage } from "./MomentImage";

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

  // loader 已在 main.tsx await 过，getMoments 同步安全。
  useEffect(() => {
    try {
      const p = getMoments();
      // 按 createdAt 倒序（最新在上）
      setPosts([...p].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const playerChar = dict.byId.get("char-linzhe");

  return (
    <div className="wc-moments-tab">
      {/* ===== Cover + Profile Header ===== */}
      <div className="wc-moments-cover">
        {/* 半透明标题栏 */}
        <div className="wc-moments-header-bar">
          <span className="wc-moments-header-title">朋友圈</span>
        </div>
        {/* 玩家头像 + 昵称（右下角，与 cover 底部重叠） */}
        <div className="wc-moments-profile-box">
          <Avatar
            character={playerChar}
            characterId="char-linzhe"
            size={60}
          />
          <span className="wc-moments-profile-name">
            {playerChar ? displayName(playerChar) : "林哲"}
          </span>
        </div>
      </div>

      {/* ===== Feed ===== */}
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

/** 返回 WeChat 风格图片网格列数 class。 */
function imageGridClass(count: number): string {
  if (count === 1) return "wc-moment-images-1col";
  if (count === 2 || count === 4) return "wc-moment-images-2col";
  return "wc-moment-images-3col";
}

function MomentRow({ post, dict, onZoom }: MomentRowProps): JSX.Element {
  const navigateToPage = useNavigateToPage();
  const author = dict.byId.get(post.authorCharacterId);

  const likes = post.likes ?? [];
  const comments = post.comments ?? [];
  const imageCount = post.assetIds?.length ?? 0;

  return (
    <li className="wc-moment">
      {/* 左侧头像 */}
      <div className="wc-moment-left">
        <Avatar
          character={author}
          characterId={post.authorCharacterId}
          size={40}
          grey={
            (author as (Character & { status?: string }) | undefined)?.status ===
            "lost"
          }
        />
      </div>

      {/* 右侧内容 */}
      <div className="wc-moment-right">
        {/* 昵称（蓝色） */}
        <div className="wc-moment-author">
          {author ? displayName(author) : "未知"}
        </div>

        {/* 正文 */}
        {post.text && <div className="wc-moment-text">{post.text}</div>}

        {/* 图片网格 */}
        {imageCount > 0 && (
          <div
            className={`wc-moment-images ${imageGridClass(imageCount)}`}
          >
            {post.assetIds!.map((aid, idx) => (
              <button
                type="button"
                key={aid}
                className="wc-moment-image"
                onClick={() => onZoom(aid, post.text)}
                aria-label={`放大查看图片 ${idx + 1}`}
              >
                <MomentImage assetId={aid} />
              </button>
            ))}
          </div>
        )}

        {/* 链接卡片 */}
        {post.link && (
          <div
            className={`wc-moment-link${post.link.pageId ? " wc-moment-link-clickable" : ""}`}
            onClick={() => {
              if (post.link?.pageId) navigateToPage(post.link.pageId);
            }}
            role={post.link.pageId ? "button" : undefined}
            tabIndex={post.link.pageId ? 0 : undefined}
            onKeyDown={(e) => {
              if (e.key === "Enter" && post.link?.pageId) {
                navigateToPage(post.link.pageId);
              }
            }}
          >
            <div className="wc-moment-link-title">
              {post.link.title ?? "站内页面"}
            </div>
            {post.link.url && (
              <div className="wc-moment-link-url">{post.link.url}</div>
            )}
          </div>
        )}

        {/* 底部：时间 + 点赞/评论 */}
        <div className="wc-moment-footer">
          <div className="wc-moment-time">
            {formatTimestamp(post.createdAt)}
          </div>

          {(likes.length > 0 || comments.length > 0) && (
            <div className="wc-moment-interactions">
              {likes.length > 0 && (
                <div className="wc-moment-likes">
                  <span className="wc-like-icon">♥</span>
                  <span className="wc-likes-names">
                    {likes
                      .map((id) => displayName(dict.byId.get(id)))
                      .join("，")}
                  </span>
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
                        {displayName(dict.byId.get(c.authorCharacterId))}
                        {c.deleted ? "" : "："}
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
        </div>
      </div>
    </li>
  );
}

/** 统一走 @/utils/time（游戏时区 +08:00），不再用正则原样截取本地时间。 */
function formatTimestamp(iso: string): string {
  return formatShortDateTime(iso) || iso;
}