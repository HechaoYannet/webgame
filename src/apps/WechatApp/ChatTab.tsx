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
  loadWechatThreads,
  loadThreadMessages,
  type CharacterDictionary,
} from "./data";
import { useClue, useGameState, useNavigateToPage } from "./wechatEngine";

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadWechatThreads()
      .then((t) => {
        if (cancelled) return;
        setThreads(sortThreads(t));
        setError(null);
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

  const dict = useMemo(
    () => buildCharacterDictionary(characters),
    [characters],
  );

  if (activeThreadId) {
    const thread = threads.find((t) => t.id === activeThreadId);
    if (!thread) {
      // 会话被卸载（理论上不发生），退回列表
      setActiveThreadId(null);
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
      <Header
        title="微信"
        subtitle={
          loading
            ? "加载中…"
            : error
              ? `加载失败：${error}`
              : `${threads.length} 个会话`
        }
      />
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
  const gameState = useGameState();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // 进入会话：标记 visitedThread，并请求引擎视为已读（不解锁谜题，纯统计）
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    gameState.openThread(thread.id);
    loadThreadMessages(thread.messageFile)
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

    // 退场时把"首屏可见消息"批量上报为查看（lazy：仅在渲染后，避免大量事件）
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id, thread.messageFile]);

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

  return (
    <div className="wc-thread-view">
      <Header
        title={thread.title}
        subtitle={
          thread.type === "group"
            ? `${thread.participantCharacterIds.length} 名成员`
            : "聊天"
        }
        onBack={onBack}
      />
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
      <div className="wc-thread-input">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="发送消息（无人接听）"
          aria-label="输入消息"
        />
        <button type="button" onClick={handleSend} disabled={!draft.trim()}>
          发送
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
            {author ? displayName(author) : "未知"}
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
}: {
  durationSec: number;
  transcript?: string;
  direction: string;
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

  return (
    <div className="wc-msg-voice">
      <button
        type="button"
        className={`wc-voice-play${playing ? " is-playing" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-label="播放语音"
      >
        ▶
      </button>
      <div
        className={`wc-voice-wave${playing ? " is-playing" : ""}${
          direction === "sent" ? " wc-voice-wave-sent" : ""
        }`}
        aria-hidden="true"
      >
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="wc-voice-bar"
            style={{ animationDelay: `${i * 0.05}s` }}
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
          {expanded ? "收起字幕" : "查看字幕"}
        </button>
      )}
      {expanded && transcript && (
        <div className="wc-voice-transcript">{transcript}</div>
      )}
    </div>
  );
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

function Header({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}): JSX.Element {
  return (
    <header className="wc-header">
      {onBack && (
        <button
          type="button"
          className="wc-header-back"
          onClick={onBack}
          aria-label="返回"
        >
          ‹
        </button>
      )}
      <div className="wc-header-titles">
        <div className="wc-header-title">{title}</div>
        {subtitle && <div className="wc-header-sub">{subtitle}</div>}
      </div>
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
  // 简易格式化：MM-DD HH:mm（保留原始 ISO，不引入 Intl 依赖）
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
}
