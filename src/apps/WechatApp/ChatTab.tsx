/**
 * WechatApp/ChatTab.tsx — 聊天 Tab（列表 + 会话页）
 *
 * - 列表：读 wechat/threads.json，按 lastMessageAt 倒序，未读角标。
 * - 会话：读 messages/<threadId>.json 渲染 ChatMessage，全 kind 支持
 *   （text / image / voice[波形+可展开字幕] / link[pageId→站内跳转,否则显示 url 不外跳 §6.4]
 *    / system / file / redpacket）。群聊显示发言人头像/昵称。
 * - 查看关键消息 → useClue().view({kind:"wechat-thread",threadId,messageId}) 自动注册线索
 *   （ClueRegistry 查表决定，本组件不知道哪些有线索）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Character,
  ChatMessage,
  ChatThread,
  ThreadId,
} from "@/types";
import { Avatar } from "./Avatar";
import {
  buildCharacterDictionary,
  displayName,
  type CharacterDictionary,
} from "./data";
import { getMessages, getWechatThreads } from "@/data/loader";
import { useClue, useNavigateToPage } from "./wechatEngine";

/* ------------------------------------------------------------------ *
 * Tab 容器
 * ------------------------------------------------------------------ */

export interface ChatTabProps {
  characters: Character[];
}

export function ChatTab({ characters }: ChatTabProps): JSX.Element {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<ThreadId | null>(null);

  // loader 已在 main.tsx await 过，getWechatThreads 同步安全。
  useEffect(() => {
    try {
      setThreads(sortThreads(getWechatThreads()));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const dict = useMemo(
    () => buildCharacterDictionary(characters),
    [characters],
  );

  // 修卡死 bug：当 activeThreadId 指向已不存在的会话时，移到 useEffect 重置——
  // 避免在 render 内 setActiveThreadId 触发 unstable render（与 OfficialTab 同型修复）。
  useEffect(() => {
    if (activeThreadId && !threads.find((t) => t.id === activeThreadId)) {
      setActiveThreadId(null);
    }
  }, [activeThreadId, threads]);

  if (activeThreadId) {
    const thread = threads.find((t) => t.id === activeThreadId);
    if (!thread) {
      // 会话被卸载（理论上不发生），退回列表骨架——useEffect 会清空 activeThreadId
      return <ChatListSkeleton />;
    }
    return (
      <ThreadView
        thread={thread}
        dict={dict}
        onBack={() => setActiveThreadId(null)}
      />
    );
  }

  return (
    <div className="wc-chat-tab">
      <ChatNavBar title="微信" />
      {loading && <ChatListSkeleton />}
      {!loading && !error && (
        <ThreadList
          threads={threads}
          dict={dict}
          onOpen={(id) => setActiveThreadId(id)}
        />
      )}
    </div>
  );
}

function sortThreads(threads: ChatThread[]): ChatThread[] {
  return [...threads].sort((a, b) =>
    b.lastMessageAt.localeCompare(a.lastMessageAt),
  );
}

/* ------------------------------------------------------------------ *
 * 列表
 * ------------------------------------------------------------------ */

interface ThreadListProps {
  threads: ChatThread[];
  dict: CharacterDictionary;
  onOpen: (id: ThreadId) => void;
}

function ThreadList({
  threads,
  dict,
  onOpen,
}: ThreadListProps): JSX.Element {
  if (threads.length === 0) {
    return <div className="wc-empty">暂无会话</div>;
  }
  return (
    <ul className="wc-thread-list">
      {threads.map((t) => (
        <ThreadRow
          key={t.id}
          thread={t}
          dict={dict}
          onOpen={() => onOpen(t.id)}
        />
      ))}
    </ul>
  );
}

interface ThreadRowProps {
  thread: ChatThread;
  dict: CharacterDictionary;
  onOpen: () => void;
}

function ThreadRow({ thread, dict, onOpen }: ThreadRowProps): JSX.Element {
  // 取会话对方（非主角）作为头像；群聊用标题首字符
  const other = thread.participantCharacterIds
    .filter((id) => id !== "char-linzhe")
    .map((id) => dict.byId.get(id))
    .find((c): c is Character => Boolean(c));
  // 失联灰显：Character 无 status 字段，从 contacts 层补充；此处取本地缓存里的 wechat
  // contact 失联状态（若有），避免污染全局类型契约。
  const grey = (other as (Character & { status?: string }) | undefined)?.status === "lost";
  const title = thread.title;
  const subtitle = formatTimestamp(thread.lastMessageAt);
  const unread = thread.unreadCount ?? 0;

  return (
    <li
      className="wc-thread-row"
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
      <Avatar
        character={other}
        characterId={other?.id}
        size={44}
        grey={grey}
      />
      <div className="wc-thread-info">
        <div className="wc-thread-title-row">
          <span className="wc-thread-title">{title}</span>
          <span className="wc-thread-time">{subtitle}</span>
        </div>
        <div className="wc-thread-snippet">
          {thread.type === "group" ? `群聊 · ${thread.participantCharacterIds.length}人` : "点击进入对话"}
        </div>
      </div>
      {unread > 0 && (
        <span className="wc-unread-badge" aria-label={`${unread} 条未读`}>
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * 会话页
 * ------------------------------------------------------------------ */

interface ThreadViewProps {
  thread: ChatThread;
  dict: CharacterDictionary;
  onBack: () => void;
}

function ThreadView({
  thread,
  dict,
  onBack,
}: ThreadViewProps): JSX.Element {
  const clue = useClue();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // 进入会话：getMessages(threadId) 按需加载（loader 内存缓存）。
  // useGameState 已废（访问计数不持久化、无副作用）——迁移后删除。
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMessages(thread.id)
      .then((m) => {
        if (cancelled) return;
        // 按时间正序渲染
        const sorted = [...m].sort((a, b) =>
          a.timestamp.localeCompare(b.timestamp),
        );
        setMessages(sorted);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id]);

  const handleViewMessage = useCallback(
    (m: ChatMessage) => {
      // 任何消息都可上报：ClueRegistry 查表决定是否注册；本组件不知道哪些有线索
      clue.view({
        kind: "wechat-thread",
        threadId: thread.id,
        messageId: m.id,
      });
    },
    [clue, thread.id],
  );

  // 发送（伪造）：仅追加一条 sent text + 视对方预设回复（信息架构 §五.5.3，无人接听）
  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    const now = new Date().toISOString();
    const sent: ChatMessage = {
      id: `local-sent-${Date.now()}`,
      threadId: thread.id,
      direction: "sent",
      authorCharacterId: "char-linzhe",
      timestamp: now,
      kind: "text",
      text,
    };
    const pending: ChatMessage = {
      id: `local-pending-${Date.now()}`,
      threadId: thread.id,
      direction: "received",
      timestamp: now,
      kind: "system",
      text: "对方暂时无法接收消息。",
    };
    setMessages((prev) => [...prev, sent, pending]);
    setDraft("");
  }, [draft, thread.id]);

  const hasText = draft.trim().length > 0;

  return (
    <div className="wc-thread-view">
      {/* 会话头部：白色背景，居中标题 */}
      <header className="wc-chat-header">
        <button
          type="button"
          className="wc-chat-header-back"
          onClick={onBack}
          aria-label="返回"
        >
          ‹
        </button>
        <div className="wc-chat-header-center">
          <div className="wc-chat-header-title">{thread.title}</div>
          <div className="wc-chat-header-sub">
            {thread.type === "group"
              ? `${thread.participantCharacterIds.length} 名成员`
              : "在线"}
          </div>
        </div>
        <button
          type="button"
          className="wc-chat-header-menu"
          aria-label="更多"
          onClick={() => {
            /* 占位，无实际功能 */
          }}
        >
          ···
        </button>
      </header>

      <div className="wc-thread-messages">
        {loading && <div className="wc-empty">加载中…</div>}
        {!loading && error && (
          <div className="wc-empty wc-error">加载失败：{error}</div>
        )}
        {!loading && !error && messages.length === 0 && (
          <div className="wc-empty">暂无消息</div>
        )}
        {!loading &&
          !error &&
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              thread={thread}
              dict={dict}
              onView={() => handleViewMessage(m)}
            />
          ))}
      </div>

      {/* 输入栏：mic / 输入框 / 表情 / + */}
      <div className="wc-chat-input">
        <button
          type="button"
          className={`wc-chat-input-btn ${hasText ? "wc-chat-send-btn" : "wc-chat-mic-btn"}`}
          onClick={() => {
            if (hasText) handleSend();
            /* mic 按钮无实际录音功能 */
          }}
          aria-label={hasText ? "发送" : "语音"}
          disabled={!hasText && false}
        >
          {hasText ? "发送" : "🎤"}
        </button>
        <input
          type="text"
          className="wc-chat-input-field"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder=""
          aria-label="输入消息"
        />
        <button
          type="button"
          className="wc-chat-input-btn wc-chat-emoji-btn"
          aria-label="表情"
          onClick={() => {
            /* 占位，无实际功能 */
          }}
        >
          😊
        </button>
        <button
          type="button"
          className="wc-chat-input-btn wc-chat-plus-btn"
          aria-label="更多"
          onClick={() => {
            /* 占位，无实际功能 */
          }}
        >
          ＋
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 单条消息气泡（全 kind 支持）
 * ------------------------------------------------------------------ */

interface MessageBubbleProps {
  message: ChatMessage;
  thread: ChatThread;
  dict: CharacterDictionary;
  onView: () => void;
}

function MessageBubble({
  message,
  thread,
  dict,
  onView,
}: MessageBubbleProps): JSX.Element {
  const navigateToPage = useNavigateToPage();
  // system 消息居中横幅，无气泡
  if (message.kind === "system") {
    return (
      <div className="wc-msg-system" onClick={onView}>
        {message.text}
      </div>
    );
  }

  const isSent = message.direction === "sent";
  const author = message.authorCharacterId
    ? dict.byId.get(message.authorCharacterId)
    : undefined;
  // 群聊&非系统&非自己发的消息需显示发言人头像/昵称
  const showAuthor =
    thread.type === "group" && !isSent && message.authorCharacterId;

  return (
    <div
      className={`wc-msg-row ${isSent ? "wc-msg-sent" : "wc-msg-received"}`}
      onClick={onView}
    >
      {!isSent && (
        <div className="wc-msg-avatar">
          <Avatar
            character={author}
            characterId={message.authorCharacterId}
            size={34}
            grey={(author as (Character & { status?: string }) | undefined)?.status === "lost"}
          />
        </div>
      )}
      <div className="wc-msg-body">
        {showAuthor && (
          <div className="wc-msg-author">
            {author ? displayName(author) : "匿名"}
          </div>
        )}
        <div
          className={`wc-msg-bubble wc-msg-kind-${message.kind}${
            isSent ? " wc-msg-bubble-sent" : ""
          }`}
        >
          <MessageContent
            message={message}
            onNavigatePage={(pageId) => navigateToPage(pageId, thread.id)}
          />
        </div>
        <div className="wc-msg-time">{formatTimestamp(message.timestamp)}</div>
      </div>
    </div>
  );
}

function MessageContent({
  message,
  onNavigatePage,
}: {
  message: ChatMessage;
  onNavigatePage: (pageId: string) => void;
}): JSX.Element {
  switch (message.kind) {
    case "text":
      return <span className="wc-msg-text">{message.text}</span>;

    case "voice":
      return (
        <VoiceMessage
          durationSec={message.voiceDurationSec ?? 0}
          transcript={message.voiceTranscript}
          direction={message.direction}
          messageId={message.id}
        />
      );

    case "image":
      return (
        <div className="wc-msg-image" data-asset-ids={(message.assetIds ?? []).join(",")}>
          [(图片)]
          {(message.assetIds ?? []).length === 0 && " 无图"}
        </div>
      );

    case "file":
      return (
        <div className="wc-msg-file">
          <span className="wc-msg-file-icon">📄</span>
          <span className="wc-msg-file-name">
            {message.text ?? (message.assetIds?.[0] ?? "文件")}
          </span>
        </div>
      );

    case "redpacket":
      return (
        <div className="wc-msg-redpacket">
          <span className="wc-msg-rp-icon">🧧</span>
          <span>{message.text ?? "微信红包"}</span>
        </div>
      );

    case "link":
      return (
        <LinkCard
          link={message.link}
          onNavigatePage={onNavigatePage}
        />
      );

    case "system":
      return <span>{message.text}</span>;
  }
}

function VoiceMessage({
  durationSec,
  transcript,
  direction,
  messageId,
}: {
  durationSec: number;
  transcript?: string;
  direction: string;
  /** 用于生成稳定的波形高度（同一消息每次渲染一致）。 */
  messageId?: string;
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggle = () => {
    if (playing) {
      setPlaying(false);
      if (timer.current) clearTimeout(timer.current);
      return;
    }
    setPlaying(true);
    // 伪造播放：到时长自动停
    timer.current = setTimeout(
      () => setPlaying(false),
      Math.max(500, durationSec * 1000),
    );
  };

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const barHeights = useMemo(() => voiceBarHeights(messageId ?? `${durationSec}`, 6), [messageId, durationSec]);

  return (
    <div className="wc-msg-voice">
      <button
        type="button"
        className={`wc-voice-play${playing ? " is-playing" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-label={playing ? "暂停" : "播放语音"}
      >
        {playing ? "⏸" : "▶"}
      </button>
      <div
        className={`wc-voice-wave${playing ? " is-playing" : ""}${
          direction === "sent" ? " wc-voice-wave-sent" : ""
        }`}
        aria-hidden="true"
      >
        {barHeights.map((h, i) => (
          <span
            key={i}
            className="wc-voice-bar"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <span className="wc-voice-duration">{durationSec}″</span>
      {transcript && (
        <button
          type="button"
          className="wc-voice-transcript-toggle"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? "收起" : "转文字"}
        </button>
      )}
      {expanded && transcript && (
        <div className="wc-voice-transcript">{transcript}</div>
      )}
    </div>
  );
}

/** 根据 seed 生成 6 根音波的伪随机高度（25%–95%），模拟真实微信语音波形。 */
function voiceBarHeights(seed: string, barCount: number): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const heights: number[] = [];
  let s = Math.abs(hash) || 1;
  for (let i = 0; i < barCount; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    heights.push(25 + (s % 71));
  }
  return heights;
}

function LinkCard({
  link,
  onNavigatePage,
}: {
  link: ChatMessage["link"];
  onNavigatePage: (pageId: string) => void;
}): JSX.Element | null {
  if (!link) return null;
  // §6.4：link.pageId 存在 → 站内跳转；否则只显示 url 不外跳
  if (link.pageId) {
    return (
      <button
        type="button"
        className="wc-link-card"
        onClick={(e) => {
          e.stopPropagation();
          onNavigatePage(link.pageId!);
        }}
      >
        <div className="wc-link-title">{link.title ?? "站内页面"}</div>
        <div className="wc-link-hint">点击查看详情 ›</div>
      </button>
    );
  }
  // 仅显示 url，不外跳（CLAUDE.md §6.4）
  return (
    <div className="wc-link-card wc-link-card-external">
      <div className="wc-link-title">{link.title ?? link.url ?? "链接"}</div>
      {link.url && <div className="wc-link-url">{link.url}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 通用头部 + 骨架
 * ------------------------------------------------------------------ */

/* 聊天列表顶部导航栏：搜索图标 + "微信" + "+" 按钮 */
function ChatNavBar({ title }: { title: string }): JSX.Element {
  return (
    <header className="wc-chat-navbar">
      <button
        type="button"
        className="wc-navbar-btn"
        aria-label="搜索"
        onClick={() => {
          /* 占位，搜索功能未实现 */
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>
      <span className="wc-navbar-title">{title}</span>
      <button
        type="button"
        className="wc-navbar-btn"
        aria-label="添加"
        onClick={() => {
          /* 占位，添加功能未实现 */
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </header>
  );
}

function ChatListSkeleton(): JSX.Element {
  return (
    <div className="wc-skeleton-list">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="wc-skeleton-row">
          <div className="wc-skeleton-avatar" />
          <div className="wc-skeleton-lines">
            <div className="wc-skeleton-line" />
            <div className="wc-skeleton-line short" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatTimestamp(iso: string): string {
  // 智能格式化：今天只显 HH:mm，今年显 MM-DD，跨年显 YYYY-MM-DD
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const hm = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  if (msgDate.getTime() === today.getTime()) return hm;
  const md = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  if (date.getFullYear() === now.getFullYear()) return md;
  return `${date.getFullYear()}-${md}`;
}
