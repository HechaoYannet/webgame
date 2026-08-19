/**
 * WechatApp/data.ts — 微信 App 数据加载层
 *
 * 读 public/data 下文案 agent 产出的 5 类 wechat JSON（+ meta/characters.json 人物反查），
 * 用 Zod 做运行时校验（CLAUDE.md §2 数据加载：fetch(import.meta.env.BASE_URL + 'data/...')，
 * 开发期 Zod schema 校验）。import.meta.env.BASE_URL 必须原样出现。
 *
 * 注意：不修改 src/types；本文件的 Zod schema 是 src/types 的**宽容超集**——
 * 数据中 kind:"system" 的消息其 direction 字段写作 "system"（不在 MessageDirection 联合
 * 内，为文案遗留），故本地在校验时允许 direction 取 "system"，组件渲染按 kind 分流即可，
 * 不污染全局类型契约。
 */
import { z } from "zod";
import type {
  Character,
  ChatMessage,
  ChatThread,
  MomentsPost,
  OfficialAccountArticle,
  WechatContact,
} from "@/types";

/* ------------------------------------------------------------------ *
 * Zod schema（与 src/types 镜像，direction 放宽以兼容数据现状）
 * ------------------------------------------------------------------ */

const isoString = z.string();

const characterSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().optional(),
  role: z.enum([
    "protagonist",
    "key-student",
    "staff",
    "external",
    "npc",
  ]),
  avatarAssetId: z.string(),
  intro: z.string().optional(),
  age: z.number().nullable().optional(),
  schoolClass: z.string().optional(),
}) as unknown as z.ZodType<Character>;

const wechatContactSchema = z.object({
  characterId: z.string(),
  wechatRemark: z.string().optional(),
  wechatNickname: z.string(),
  isOfficialAccount: z.boolean().optional(),
  status: z.enum(["online", "offline", "lost"]).optional(),
  starValue: z.number().optional(),
}) as unknown as z.ZodType<WechatContact>;

const messageDirectionSchema = z.enum([
  "sent",
  "received",
  "system", // 数据中 kind:"system" 消息的 direction 写作 "system"，本地宽容
]);
const messageKindSchema = z.enum([
  "text",
  "image",
  "voice",
  "link",
  "system",
  "redpacket",
  "file",
]);

const chatMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  direction: messageDirectionSchema,
  authorCharacterId: z.string().optional(),
  timestamp: isoString,
  kind: messageKindSchema,
  text: z.string().optional(),
  assetIds: z.array(z.string()).optional(),
  voiceDurationSec: z.number().optional(),
  voiceTranscript: z.string().optional(),
  link: z
    .object({
      title: z.string().optional(),
      url: z.string().optional(),
      pageId: z.string().optional(),
      assetId: z.string().optional(),
    })
    .optional(),
  recalled: z.boolean().optional(),
  registersClueId: z.string().optional(),
  triggersEvidenceId: z.string().optional(),
}) as z.ZodType<ChatMessage>;

const chatThreadSchema: z.ZodType<ChatThread> = z.object({
  id: z.string(),
  platform: z.literal("wechat"),
  type: z.enum(["single", "group"]),
  title: z.string(),
  participantCharacterIds: z.array(z.string()),
  lastMessageAt: isoString,
  unreadCount: z.number().optional(),
  requiredPuzzleId: z.string().optional(),
  messageFile: z.string(),
});

const momentCommentSchema = z.object({
  authorCharacterId: z.string(),
  text: z.string(),
  createdAt: isoString.optional(),
  deleted: z.boolean().optional(),
});

const momentsPostSchema = z.object({
  id: z.string(),
  authorCharacterId: z.string(),
  createdAt: isoString,
  text: z.string().optional(),
  assetIds: z.array(z.string()).optional(),
  link: z
    .object({
      title: z.string().optional(),
      url: z.string().optional(),
      pageId: z.string().optional(),
    })
    .optional(),
  likes: z.array(z.string()).optional(),
  comments: z.array(momentCommentSchema).optional(),
  starValue: z.number().optional(),
  registersClueId: z.string().optional(),
  triggersEvidenceId: z.string().optional(),
}) as unknown as z.ZodType<MomentsPost>;

const articleBlockSchema = z.union([
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({
    type: z.literal("heading"),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    text: z.string(),
  }),
  z.object({
    type: z.literal("image"),
    assetId: z.string(),
    caption: z.string().optional(),
  }),
  z.object({ type: z.literal("quote"), text: z.string() }),
  z.object({
    type: z.literal("list"),
    items: z.array(z.string()),
    ordered: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("callout"),
    variant: z.enum(["info", "warning", "danger"]),
    text: z.string(),
  }),
]);

const officialArticleSchema: z.ZodType<OfficialAccountArticle> = z.object({
  id: z.string(),
  accountName: z.string(),
  accountCategory: z
    .enum(["tool", "news", "school", "org", "game", "health"])
    .optional(),
  title: z.string(),
  publishedAt: isoString,
  coverAssetId: z.string().optional(),
  bodyBlocks: z.array(articleBlockSchema),
  url: z.string().optional(),
  link: z
    .object({
      title: z.string().optional(),
      url: z.string().optional(),
      pageId: z.string().optional(),
    })
    .optional(),
  registersClueId: z.string().optional(),
  triggersEvidenceId: z.string().optional(),
  isGeneratedContent: z.boolean().optional(),
  triggerUploadPuzzleId: z.string().optional(),
});

const contactsArraySchema = z.array(wechatContactSchema);
const threadsArraySchema = z.array(chatThreadSchema);
const momentsArraySchema = z.array(momentsPostSchema);
const articlesArraySchema = z.array(officialArticleSchema);
const charactersArraySchema = z.array(characterSchema);
const messagesArraySchema = z.array(chatMessageSchema);

/* ------------------------------------------------------------------ *
 * fetch + 缓存
 * ------------------------------------------------------------------ */

const cache = new Map<string, Promise<unknown>>();

/**
 * fetch JSON 并 Zod 校验。import.meta.env.BASE_URL 必须原样出现（CLAUDE.md §2）。
 * @param rel 相对 data/ 根的路径（如 "wechat/threads.json"）
 */
async function fetchJson<T>(
  rel: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const cached = cache.get(rel);
  if (cached) return cached as Promise<T>;
  const p = (async () => {
    const url = import.meta.env.BASE_URL + "data/" + rel;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`[WechatApp] 加载失败 ${url}: ${res.status}`);
    }
    const json: unknown = await res.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      // 校验失败仍抛错，但给出可读路径——开发期发现数据偏差最有用
      throw new Error(
        `[WechatApp] 数据校验失败 ${rel}: ${parsed.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(" | ")}`,
      );
    }
    return parsed.data;
  })();
  cache.set(rel, p);
  return p as Promise<T>;
}

/* ------------------------------------------------------------------ *
 * 公开加载 API（5 类 wechat JSON + characters）
 * ------------------------------------------------------------------ */

export function loadWechatContacts(): Promise<WechatContact[]> {
  return fetchJson("wechat/contacts.json", contactsArraySchema);
}

export function loadWechatThreads(): Promise<ChatThread[]> {
  return fetchJson("wechat/threads.json", threadsArraySchema);
}

export function loadWechatMoments(): Promise<MomentsPost[]> {
  return fetchJson("wechat/moments.json", momentsArraySchema);
}

export function loadWechatArticles(): Promise<OfficialAccountArticle[]> {
  return fetchJson("wechat/official-accounts.json", articlesArraySchema);
}

export function loadCharacters(): Promise<Character[]> {
  return fetchJson("meta/characters.json", charactersArraySchema);
}

/**
 * 加载某会话的消息文件。chatThread.messageFile 形如
 * "data/wechat/messages/<threadId>.json"（已含 data/ 前缀），本函数去掉前缀后拼 BASE_URL。
 */
export function loadThreadMessages(
  messageFile: string,
): Promise<ChatMessage[]> {
  const rel = messageFile.startsWith("data/")
    ? messageFile.slice("data/".length)
    : messageFile;
  return fetchJson(rel, messagesArraySchema);
}

/* ------------------------------------------------------------------ *
 * 人物字典辅助
 * ------------------------------------------------------------------ */

export interface CharacterDictionary {
  byId: Map<string, Character>;
  list: Character[];
}

export function buildCharacterDictionary(
  chars: Character[],
): CharacterDictionary {
  return {
    list: chars,
    byId: new Map(chars.map((c) => [c.id, c])),
  };
}

/** 取人物显示名（优先 displayName → name）。 */
export function displayName(c: Character | undefined): string {
  return c?.displayName ?? c?.name ?? "未知";
}
