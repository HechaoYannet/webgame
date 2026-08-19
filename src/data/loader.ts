/**
 * src/data/loader.ts
 *
 * 数据加载层 — 唯一对接 public/data 的入口（CLAUDE.md §4 "数据即契约"）。
 *
 * 职责：
 *  1. 按 `import.meta.env.BASE_URL + 'data/...'` fetch JSON（CLAUDE.md §2，BASE_URL 必须原样出现）。
 *  2. 用 Zod schema 校验所有 JSON（开发期严格，生产期同样校验以保证契约）。
 *  3. 建内存索引：contactById / wechatContactByCharacterId / qqContactByCharacterId /
 *     puzzleById / evidenceById / clueById / clueBySource / threadById / pageById /
 *     siteById / chapterById / endingById / hintById / smsEventById / doorbellEventById /
 *     callScriptById / callRecordById / articleById / noteById / searchIndex。
 *  4. 消息按 thread 拆分按需加载（getMessages(threadId)）。
 *  5. 不生成 JSON，不缓存到 localStorage（localStorage 由 persist 层负责）。
 *
 * 前端 engine 与各 App 只通过本模块读数据，不直接 fetch。
 */

import { z } from 'zod'
import type {
  ArticleBlock,
  CallRecord,
  CallScript,
  Chapter,
  ChatMessage,
  ChatThread,
  Character,
  Clue,
  ClueSource,
  DoorbellEvent,
  Ending,
  Evidence,
  Hint,
  Monologue,
  MomentsPost,
  OfficialAccountArticle,
  PageId,
  QqContact,
  QqGroupFile,
  QqGroupFilesEntry,
  QqGroupFilesFile,
  RiskEventsFile,
  SearchIndexEntry,
  Site,
  SmsEvent,
  Note,
  ThreadId,
  WebPage,
  WechatContact,
} from '@/types'

// ===== Zod schema（镜像 src/types/index.ts，代码即契约）=====
// 为保持本文件自洽，schema 与 types 同步由 doc/engineer + frontend-engine 协作维护。

const idStr = z.string().min(1)
const isoStr = z.string()

// ArticleBlock（文章/结局旁白共用块联合）
const articleBlockSchema: z.ZodType<ArticleBlock> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), text: z.string() }),
  z.object({ type: z.literal('heading'), level: z.union([z.literal(1), z.literal(2), z.literal(3)]), text: z.string() }),
  z.object({ type: z.literal('image'), assetId: z.string(), caption: z.string().optional() }),
  z.object({ type: z.literal('quote'), text: z.string() }),
  z.object({ type: z.literal('list'), items: z.array(z.string()), ordered: z.boolean().optional() }),
  z.object({ type: z.literal('callout'), variant: z.enum(['info', 'warning', 'danger']), text: z.string() }),
])

// PuzzleEffect 联合（镜像 types/index.ts）
const puzzleEffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('addRisk'), amount: z.number() }),
  z.object({ type: z.literal('removeRisk'), amount: z.number() }),
  z.object({ type: z.literal('startCountdown'), durationSec: z.number(), id: z.string() }),
  z.object({ type: z.literal('advanceChapter'), toChapterId: idStr }),
  z.object({ type: z.literal('pushSms'), smsEventId: z.string() }),
  z.object({ type: z.literal('pushDoorbell'), doorbellEventId: z.string() }),
  z.object({ type: z.literal('registerClue'), clueId: idStr }),
  z.object({ type: z.literal('collectEvidence'), evidenceId: idStr }),
  z.object({ type: z.literal('playAudio'), assetId: z.string(), loop: z.boolean().optional() }),
  z.object({ type: z.literal('stopAudio'), assetId: z.string().optional() }),
  z.object({ type: z.literal('vibrate') }),
  z.object({ type: z.literal('fullscreenAlert'), text: z.string() }),
  z.object({ type: z.literal('pushEnding'), endingId: z.enum(['good', 'normal', 'bad']) }),
  z.object({ type: z.literal('openNewsApp'), endingId: z.enum(['good', 'normal', 'bad']) }),
  z.object({ type: z.literal('openApp'), appId: z.string() }),
])
// 重新导出供 engine 复用
export const PuzzleEffectSchema = puzzleEffectSchema

// PageAccessibility 四类
const pageAccessibilitySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('public') }),
  z.object({ kind: z.literal('hidden'), discoverFrom: idStr, hint: z.string() }),
  z.object({ kind: z.literal('loginRequired'), puzzleId: idStr }),
  z.object({ kind: z.literal('linkedOnly'), fromPageId: idStr }),
])

// PageBlock 联合（宽松：额外字段透传，前端只消费已声明 block.type）
const pageBlockSchema = z.object({ type: z.string() }).passthrough()

// DiscoverableBy
const discoverableBySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('urlSuffix'), basePageId: idStr, suffix: z.string() }),
  z.object({ type: z.literal('sourceCodeComment'), onPageId: idStr, commentText: z.string() }),
  z.object({ type: z.literal('search'), queryKeyword: z.string() }),
])

const webPageSchema: z.ZodType<WebPage> = z.object({
  id: idStr,
  siteId: z.string(),
  url: z.string(),
  title: z.string(),
  accessibility: pageAccessibilitySchema,
  blocks: z.array(pageBlockSchema),
  discoverableBy: z.array(discoverableBySchema).optional(),
  registersClueId: idStr.optional(),
  triggersEvidenceId: idStr.optional(),
  containsAssetId: z.string().optional(),
  assetRequiresPuzzleId: idStr.optional(),
  onViewEffects: z.array(puzzleEffectSchema).optional(),
}) as unknown as z.ZodType<WebPage>

// clue source 联合
const clueSourceSchema: z.ZodType<ClueSource> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('wechat-thread'), threadId: idStr, messageId: z.string().optional() }),
  z.object({ kind: z.literal('wechat-moment'), momentId: z.string() }),
  z.object({ kind: z.literal('wechat-article'), articleId: z.string() }),
  z.object({ kind: z.literal('qq-thread'), threadId: idStr, messageId: z.string().optional() }),
  z.object({ kind: z.literal('qzone-post'), postId: z.string() }),
  z.object({ kind: z.literal('web-page'), pageId: idStr }),
  z.object({ kind: z.literal('sms'), smsId: z.string() }),
  z.object({ kind: z.literal('call'), callId: z.string() }),
  z.object({ kind: z.literal('doorbell'), eventId: z.string() }),
]) as unknown as z.ZodType<ClueSource>

// ===== 各文件 schema =====

const charactersSchema = z.array(z.object({
  id: idStr,
  name: z.string(),
  displayName: z.string().optional(),
  role: z.enum(['protagonist', 'key-student', 'staff', 'external', 'npc']),
  avatarAssetId: z.string(),
  intro: z.string().optional(),
  age: z.number().nullable().optional(),
  schoolClass: z.string().optional(),
})) as unknown as z.ZodType<Character[]>

const wechatContactSchema = z.object({
  characterId: idStr,
  wechatRemark: z.string().optional(),
  wechatNickname: z.string(),
  isOfficialAccount: z.boolean().optional(),
  status: z.enum(['online', 'offline', 'lost']).optional(),
  starValue: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
}) as unknown as z.ZodType<WechatContact>

const qqContactSchema = z.object({
  characterId: idStr,
  qqNumber: z.string(),
  qqNickname: z.string(),
  qqRemark: z.string().optional(),
  isGroup: z.boolean().optional(),
  memberCount: z.number().optional(),
  status: z.enum(['online', 'offline', 'lost']).optional(),
}) as unknown as z.ZodType<QqContact>

const chatMessageSchema: z.ZodType<ChatMessage> = z.object({
  id: idStr,
  threadId: idStr,
  direction: z.enum(['sent', 'received', 'system']),
  authorCharacterId: idStr.optional(),
  timestamp: isoStr,
  kind: z.enum(['text', 'image', 'voice', 'link', 'system', 'redpacket', 'file']),
  text: z.string().optional(),
  assetIds: z.array(z.string()).optional(),
  voiceDurationSec: z.number().optional(),
  voiceTranscript: z.string().optional(),
  link: z.object({ title: z.string().optional(), url: z.string().optional(), pageId: idStr.optional(), assetId: z.string().optional() }).optional(),
  recalled: z.boolean().optional(),
  registersClueId: idStr.optional(),
  triggersEvidenceId: idStr.optional(),
}) as unknown as z.ZodType<ChatMessage>

const chatThreadSchema: z.ZodType<ChatThread> = z.object({
  id: idStr,
  platform: z.enum(['wechat', 'qq']),
  type: z.enum(['single', 'group']),
  title: z.string(),
  participantCharacterIds: z.array(idStr),
  lastMessageAt: isoStr,
  unreadCount: z.number().optional(),
  requiredPuzzleId: idStr.optional(),
  messageFile: z.string(),
}) as unknown as z.ZodType<ChatThread>

const momentsPostSchema: z.ZodType<MomentsPost> = z.object({
  id: idStr,
  authorCharacterId: idStr,
  createdAt: isoStr,
  text: z.string().optional(),
  assetIds: z.array(z.string()).optional(),
  link: z.object({ title: z.string().optional(), url: z.string().optional(), pageId: idStr.optional() }).optional(),
  likes: z.array(idStr).optional(),
  comments: z.array(z.object({
    authorCharacterId: idStr,
    text: z.string(),
    createdAt: isoStr.optional(),
    deleted: z.boolean().optional(),
  })).optional(),
  starValue: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  registersClueId: idStr.optional(),
  triggersEvidenceId: idStr.optional(),
}) as unknown as z.ZodType<MomentsPost>

const articleSchema: z.ZodType<OfficialAccountArticle> = z.object({
  id: idStr,
  accountName: z.string(),
  accountCategory: z.enum(['tool', 'news', 'school', 'org', 'game', 'health']).optional(),
  title: z.string(),
  publishedAt: isoStr,
  coverAssetId: z.string().optional(),
  bodyBlocks: z.array(articleBlockSchema),
  url: z.string().optional(),
  registersClueId: idStr.optional(),
  triggersEvidenceId: idStr.optional(),
  isGeneratedContent: z.boolean().optional(),
  triggerUploadPuzzleId: idStr.optional(),
}) as unknown as z.ZodType<OfficialAccountArticle>

const matchStrategySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('exact'), caseSensitive: z.boolean().optional(), trim: z.boolean().optional() }),
  z.object({ kind: z.literal('oneOf'), accepted: z.array(z.string()) }),
  z.object({ kind: z.literal('regex'), pattern: z.string() }),
  z.object({ kind: z.literal('phoneNumber'), normalizedDigits: z.number() }),
  z.object({ kind: z.literal('evidenceSet'), requiredEvidenceIds: z.array(idStr), minLength: z.number() }),
])

const puzzleSchema = z.object({
  id: idStr,
  type: z.enum(['password', 'pdfPassword', 'phoneNumber', 'evidenceSelection', 'uploadAndInterpret']),
  title: z.string(),
  chapterId: idStr,
  answer: z.union([z.string(), z.array(z.string())]),
  matchStrategy: matchStrategySchema,
  maxAttempts: z.number().optional(),
  attemptsToHint: z.number().optional(),
  riskPerWrongAttempt: z.number().optional(),
  lockoutAfterAttempts: z.number().optional(),
  hintIds: z.array(idStr),
  onSuccess: z.array(puzzleEffectSchema),
  onFailure: z.array(puzzleEffectSchema).optional(),
  unlocksThreadIds: z.array(idStr).optional(),
  unlocksPageIds: z.array(idStr).optional(),
  unlocksAssetIds: z.array(z.string()).optional(),
  registersEvidenceIds: z.array(idStr).optional(),
})

const clueSchema: z.ZodType<Clue> = z.object({
  id: idStr,
  chapterId: idStr,
  title: z.string(),
  summary: z.string(),
  source: clueSourceSchema,
  relatedEvidenceIds: z.array(idStr),
  isRedHerring: z.boolean(),
  redHerringNote: z.string().optional(),
  autoRegisterOnView: z.boolean(),
}) as unknown as z.ZodType<Clue>

const evidenceSchema: z.ZodType<Evidence> = z.object({
  id: idStr,
  title: z.string(),
  description: z.string(),
  chapterId: idStr,
  source: clueSourceSchema,
  isKey: z.boolean(),
  collectingCondition: z.enum(['onView', 'onPuzzleSolve', 'onScreenshot']),
  screenshotAssetId: z.string().optional(),
  triggerClueId: idStr.optional(),
  triggerPuzzleId: idStr.optional(),
  triggerPageId: idStr.optional(),
}) as unknown as z.ZodType<Evidence>

const endingTriggerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('evidenceSufficient'), puzzleId: idStr }),
  z.object({ kind: z.literal('evidenceInsufficient'), puzzleId: idStr }),
  z.object({ kind: z.literal('countdownExpired'), countdownId: idStr }),
  z.object({ kind: z.literal('riskMaxed') }),
  z.object({ kind: z.literal('manual'), chapterId: idStr }),
])

const endingSchema: z.ZodType<Ending> = z.object({
  id: z.enum(['good', 'normal', 'bad']),
  title: z.string(),
  trigger: endingTriggerSchema,
  epilogueBlocks: z.array(articleBlockSchema),
  postEndingSms: z.array(z.object({ from: idStr, text: z.string() })).optional(),
  postEndingWechatMessage: z.object({
    threadId: idStr,
    messages: z.array(chatMessageSchema),
  }).optional(),
}) as unknown as z.ZodType<Ending>

const chapterConditionSchema: z.ZodType<import('@/types').ChapterCondition> = z.lazy(() => z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('gameStart') }),
  z.object({ kind: z.literal('puzzleSolved'), puzzleId: idStr }),
  z.object({ kind: z.literal('evidenceCollected'), evidenceId: idStr }),
  z.object({ kind: z.literal('clueRegistered'), clueId: idStr }),
  z.object({ kind: z.literal('and'), conditions: z.array(chapterConditionSchema) }),
])) as unknown as z.ZodType<import('@/types').ChapterCondition>

const chapterSchema: z.ZodType<Chapter> = z.object({
  id: idStr,
  index: z.number(),
  title: z.string(),
  enterCondition: chapterConditionSchema,
  introMonologueId: z.string().optional(),
  onEnterEffects: z.array(puzzleEffectSchema).optional(),
  objectives: z.array(z.object({
    id: z.string(),
    description: z.string(),
    completionPuzzleId: idStr.optional(),
    completionEvidenceId: idStr.optional(),
    completionClueId: idStr.optional(),
    hidden: z.boolean().optional(),
  })),
}) as unknown as z.ZodType<Chapter>

const hintTriggerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('idleOnPage'), pageId: idStr, seconds: z.number() }),
  z.object({ kind: z.literal('wrongAttempts'), puzzleId: idStr, attempts: z.number() }),
  z.object({ kind: z.literal('viewedClue'), clueId: idStr }),
  z.object({ kind: z.literal('chapterEntered'), chapterId: idStr }),
  z.object({ kind: z.literal('askedContact'), characterId: idStr, keyword: z.string().optional() }),
])

const hintSchema: z.ZodType<Hint> = z.object({
  id: idStr,
  puzzleId: idStr.optional(),
  trigger: hintTriggerSchema,
  text: z.string(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  cooldownSec: z.number().optional(),
  onlyOnce: z.boolean().optional(),
}) as unknown as z.ZodType<Hint>

const monologueSchema: z.ZodType<Monologue> = z.object({
  id: idStr,
  chapterId: idStr,
  title: z.string(),
  trigger: z.object({ kind: z.literal('chapterEntered'), chapterId: idStr }),
  lines: z.array(z.string()),
  onlyOnce: z.boolean().optional(),
}) as unknown as z.ZodType<Monologue>

const smsFromSchema = z.union([
  idStr,
  z.object({ kind: z.literal('unknownNumber'), display: z.string(), digits: z.string() }),
])

const smsEventSchema: z.ZodType<SmsEvent> = z.object({
  id: idStr,
  pushTriggerPuzzleId: idStr.optional(),
  pushTriggerRiskEventId: z.string().optional(),
  pushTrigger: z.object({ kind: z.string() }).passthrough().optional(),
  from: smsFromSchema,
  direction: z.enum(['sent', 'received']).optional(),
  receivedAt: isoStr,
  body: z.string(),
  footnote: z.string().nullable().optional(),
  alertStyle: z.enum(['info', 'warning', 'danger', 'success']).optional(),
  registersClueId: idStr.nullable().optional(),
  triggersEvidenceId: idStr.nullable().optional(),
}) as unknown as z.ZodType<SmsEvent>

const doorbellEventSchema: z.ZodType<DoorbellEvent> = z.object({
  id: idStr,
  sourcePuzzleId: idStr.optional(),
  pushTriggerPuzzleId: idStr.optional(),
  triggeredAt: isoStr,
  doorbellCharacterId: idStr.nullable().optional(),
  title: z.string(),
  pushNotification: z.object({ appName: z.string(), title: z.string(), body: z.string() }),
  liveFeed: z.object({
    sceneDescription: z.string(),
    characterAssetId: z.string(),
    clipAssetId: z.string().optional(),
    loop: z.boolean().optional(),
  }),
  audio: z.object({ assetId: z.string(), loop: z.boolean().optional(), volume: z.number().optional() }).optional(),
  deviceFeedback: z.array(z.object({ type: z.string() }).passthrough()).optional(),
  countdownBar: z.object({
    countdownId: z.string(),
    durationSec: z.number(),
    style: z.string(),
    alertText: z.string(),
    alertStyle: z.string(),
  }).optional(),
  onTimeoutText: z.string().optional(),
  onTimeoutEndingId: z.enum(['good', 'normal', 'bad']).optional(),
  registersClueId: idStr.nullable().optional(),
  triggersEvidenceId: idStr.nullable().optional(),
}) as unknown as z.ZodType<DoorbellEvent>

const callScriptBlockSchema = z.object({ type: z.string() }).passthrough()
const callScriptSchema: z.ZodType<CallScript> = z.object({
  id: idStr,
  title: z.string(),
  callee: idStr.nullable(),
  calleeDisplay: z.string(),
  blocks: z.array(callScriptBlockSchema),
  endEffect: z.object({ type: z.string() }).passthrough().nullable().optional(),
  branches: z.record(z.string(), z.object({
    blocks: z.array(callScriptBlockSchema),
    endEffects: z.array(z.object({ type: z.string() }).passthrough()),
  })).optional(),
}) as unknown as z.ZodType<CallScript>

const callRecordSchema: z.ZodType<CallRecord> = z.object({
  id: idStr,
  contactCharacterId: idStr.nullable(),
  displayNumber: z.string(),
  rawNumber: z.string().optional(),
  direction: z.enum(['incoming', 'outgoing']),
  status: z.string(),
  statusText: z.string().optional(),
  calledAt: isoStr,
  durationSec: z.number(),
  relatedChapterId: idStr.optional(),
  scriptId: idStr.nullable().optional(),
}) as unknown as z.ZodType<CallRecord>

const noteSchema: z.ZodType<Note> = z.object({
  id: idStr,
  title: z.string(),
  createdAt: isoStr,
  pinned: z.boolean().optional(),
  body: z.string(),
  isTemplate: z.boolean().optional(),
}) as unknown as z.ZodType<Note>

const siteSchema: z.ZodType<Site> = z.object({
  id: idStr,
  name: z.string(),
  baseUrl: z.string(),
  pages: z.array(idStr),
}) as unknown as z.ZodType<Site>

const searchIndexSchema: z.ZodType<SearchIndexEntry[]> = z.array(z.object({
  keyword: z.string(),
  pageIds: z.array(idStr),
})) as unknown as z.ZodType<SearchIndexEntry[]>

const riskEventsSchema: z.ZodType<RiskEventsFile> = z.object({
  thresholds: z.object({
    max: z.number(),
    badEndingAt: z.number(),
    redAlertAt: z.number(),
  }),
  events: z.array(z.object({
    id: idStr,
    source: z.string(),
    amount: z.number(),
    trigger: z.object({ kind: z.string() }).passthrough(),
    triggerDescription: z.string().optional(),
  })),
}) as unknown as z.ZodType<RiskEventsFile>

const qqGroupFileSchema: z.ZodType<QqGroupFile> = z.object({
  id: idStr,
  name: z.string(),
  uploaderCharacterId: idStr.optional(),
  uploadedAt: isoStr.optional(),
  type: z.string().optional(),
  sizeKB: z.number().optional(),
  assetId: z.string().optional(),
  relatePageId: idStr.optional(),
  pageId: idStr.optional(),
  note: z.string().optional(),
  registersClueId: idStr.nullable().optional(),
  triggersEvidenceId: idStr.nullable().optional(),
}) as unknown as z.ZodType<QqGroupFile>

const qqGroupFilesSchema: z.ZodType<QqGroupFilesFile> = z.object({
  groups: z.array(z.object({
    threadId: idStr,
    title: z.string(),
    files: z.array(qqGroupFileSchema),
  })),
}) as unknown as z.ZodType<QqGroupFilesFile>

// ===== fetch + 校验 helper =====

let _baseUrl: string | null = null
function baseUrl(): string {
  // import.meta.env.BASE_URL 必须原样出现（CLAUDE.md §2）
  if (_baseUrl === null) _baseUrl = import.meta.env.BASE_URL
  return _baseUrl
}

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(baseUrl() + path)
  if (!res.ok) throw new Error(`[loader] fetch failed: ${path} → ${res.status} ${res.statusText}`)
  return res.json()
}

/** 校验后在控制台输出文件名/错误，开发期严格。 */
function validate<T>(label: string, data: unknown, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    // 输出可读错误，方便文案/关卡 agent 定位
    console.error(`[loader] schema 校验失败: ${label}`, parsed.error.issues)
    throw new Error(`[loader] schema 校验失败: ${label}\n${JSON.stringify(parsed.error.issues, null, 2)}`)
  }
  return parsed.data
}

// ===== 单文件加载器 =====

async function loadCharacters(): Promise<Character[]> {
  return validate('meta/characters.json', await fetchJson('data/meta/characters.json'), charactersSchema)
}
async function loadWechatContacts(): Promise<WechatContact[]> {
  const data = await fetchJson('data/wechat/contacts.json')
  return validate('wechat/contacts.json', data, z.array(wechatContactSchema)) as unknown as WechatContact[]
}
async function loadQqContacts(): Promise<QqContact[]> {
  const data = await fetchJson('data/qq/contacts.json')
  return validate('qq/contacts.json', data, z.array(qqContactSchema)) as unknown as QqContact[]
}
async function loadWechatThreads(): Promise<ChatThread[]> {
  const data = await fetchJson('data/wechat/threads.json')
  return validate('wechat/threads.json', data, z.array(chatThreadSchema)) as unknown as ChatThread[]
}
async function loadQqThreads(): Promise<ChatThread[]> {
  const data = await fetchJson('data/qq/threads.json')
  return validate('qq/threads.json', data, z.array(chatThreadSchema)) as unknown as ChatThread[]
}
async function loadMoments(): Promise<MomentsPost[]> {
  return validate('wechat/moments.json', await fetchJson('data/wechat/moments.json'), z.array(momentsPostSchema)) as unknown as MomentsPost[]
}
async function loadArticles(): Promise<OfficialAccountArticle[]> {
  return validate('wechat/official-accounts.json', await fetchJson('data/wechat/official-accounts.json'), z.array(articleSchema)) as unknown as OfficialAccountArticle[]
}
async function loadPuzzles(): Promise<import('@/types').Puzzle[]> {
  return validate('puzzle/puzzles.json', await fetchJson('data/puzzle/puzzles.json'), z.array(puzzleSchema)) as unknown as import('@/types').Puzzle[]
}
async function loadClues(): Promise<Clue[]> {
  const data = await fetchJson('data/clustering/clue-map.json')
  const raw = (data as { clues: Clue[] }).clues
  return validate('clustering/clue-map.json clues', raw, z.array(clueSchema)) as unknown as Clue[]
}
async function loadEvidence(): Promise<Evidence[]> {
  return validate('meta/evidence-registry.json', await fetchJson('data/meta/evidence-registry.json'), z.array(evidenceSchema)) as unknown as Evidence[]
}
async function loadEndings(): Promise<Ending[]> {
  return validate('meta/endings.json', await fetchJson('data/meta/endings.json'), z.array(endingSchema)) as unknown as Ending[]
}
async function loadChapters(): Promise<Chapter[]> {
  return validate('meta/chapters.json', await fetchJson('data/meta/chapters.json'), z.array(chapterSchema)) as unknown as Chapter[]
}
async function loadHints(): Promise<Hint[]> {
  return validate('story/hints.json', await fetchJson('data/story/hints.json'), z.array(hintSchema)) as unknown as Hint[]
}
async function loadMonologues(): Promise<Monologue[]> {
  return validate('story/monologues.json', await fetchJson('data/story/monologues.json'), z.array(monologueSchema)) as unknown as Monologue[]
}
async function loadSmsEvents(): Promise<SmsEvent[]> {
  const data = await fetchJson('data/phone/sms.json')
  const raw = (data as { events: SmsEvent[] }).events
  return validate('phone/sms.json events', raw, z.array(smsEventSchema)) as unknown as SmsEvent[]
}
async function loadDoorbellEvents(): Promise<DoorbellEvent[]> {
  const data = await fetchJson('data/phone/doorbell-events.json')
  const raw = (data as { events: DoorbellEvent[] }).events
  return validate('phone/doorbell-events.json events', raw, z.array(doorbellEventSchema)) as unknown as DoorbellEvent[]
}
async function loadCallScripts(): Promise<CallScript[]> {
  const data = await fetchJson('data/phone/call-scripts.json')
  const raw = (data as { scripts: CallScript[] }).scripts
  return validate('phone/call-scripts.json scripts', raw, z.array(callScriptSchema)) as unknown as CallScript[]
}
async function loadCallRecords(): Promise<CallRecord[]> {
  const data = await fetchJson('data/phone/call-log.json')
  const raw = (data as { records: CallRecord[] }).records
  return validate('phone/call-log.json records', raw, z.array(callRecordSchema)) as unknown as CallRecord[]
}
async function loadNotes(): Promise<Note[]> {
  const data = await fetchJson('data/phone/notes.json')
  const raw = (data as { notes: Note[] }).notes
  return validate('phone/notes.json notes', raw, z.array(noteSchema)) as unknown as Note[]
}
async function loadSites(): Promise<Site[]> {
  return validate('browser/sites.json', await fetchJson('data/browser/sites.json'), z.array(siteSchema)) as unknown as Site[]
}
async function loadSearchIndex(): Promise<SearchIndexEntry[]> {
  return validate('browser/search-index.json', await fetchJson('data/browser/search-index.json'), searchIndexSchema) as unknown as SearchIndexEntry[]
}
async function loadRiskEvents(): Promise<RiskEventsFile> {
  return validate('meta/risk-events.json', await fetchJson('data/meta/risk-events.json'), riskEventsSchema) as unknown as RiskEventsFile
}
async function loadQqGroupFiles(): Promise<QqGroupFilesFile> {
  return validate('qq/group-files.json', await fetchJson('data/qq/group-files.json'), qqGroupFilesSchema) as unknown as QqGroupFilesFile
}
async function loadQzone(): Promise<MomentsPost[]> {
  return validate('qq/qzone.json', await fetchJson('data/qq/qzone.json'), z.array(momentsPostSchema)) as unknown as MomentsPost[]
}

// 页面按需加载（每 page 一个文件）
async function loadPage(pageId: PageId): Promise<WebPage> {
  return validate(`browser/pages/${pageId}.json`, await fetchJson(`data/browser/pages/${pageId}.json`), webPageSchema) as unknown as WebPage
}

// 消息按线程按需加载
async function loadMessages(threadId: ThreadId): Promise<ChatMessage[]> {
  // 先从 threadById 拿 messageFile
  const thread = getThreadById(threadId)
  if (!thread) throw new Error(`[loader] thread not found: ${threadId}`)
  // messageFile 形如 "data/wechat/messages/thread-xxx.json"，已是相对 baseUrl 的完整路径
  const data = await fetchJson(thread.messageFile)
  return validate(`${thread.messageFile}`, data, z.array(chatMessageSchema)) as unknown as ChatMessage[]
}

// ===== 加载后的数据快照（缓存）=====

interface GameDataSnapshot {
  characters: Character[]
  wechatContacts: WechatContact[]
  qqContacts: QqContact[]
  wechatThreads: ChatThread[]
  qqThreads: ChatThread[]
  moments: MomentsPost[]
  qzone: MomentsPost[]
  articles: OfficialAccountArticle[]
  puzzles: import('@/types').Puzzle[]
  clues: Clue[]
  evidence: Evidence[]
  endings: Ending[]
  chapters: Chapter[]
  hints: Hint[]
  monologues: Monologue[]
  smsEvents: SmsEvent[]
  doorbellEvents: DoorbellEvent[]
  callScripts: CallScript[]
  callRecords: CallRecord[]
  notes: Note[]
  sites: Site[]
  searchIndex: SearchIndexEntry[]
  riskEvents: RiskEventsFile
  qqGroupFiles: QqGroupFilesFile
}

export interface GameDataIndex {
  contactById: Map<string, Character>
  wechatContactByCharacterId: Map<string, WechatContact>
  qqContactByCharacterId: Map<string, QqContact>
  threadById: Map<string, ChatThread>
  wechatThreadByTitle: Map<string, ChatThread>
  puzzleById: Map<string, import('@/types').Puzzle>
  evidenceById: Map<string, Evidence>
  clueById: Map<string, Clue>
  /** 按来源（kind+具体 id）反查线索。key 形如 `${kind}:${subId}`，subId 为 threadId/messageId/momentId/articleId/pageId/smsId/callId/eventId/postId */
  clueBySource: Map<string, Clue>
  chapterById: Map<string, Chapter>
  endingById: Map<string, Ending>
  hintById: Map<string, Hint>
  monologueById: Map<string, Monologue>
  monologueByChapterId: Map<string, Monologue>
  smsEventById: Map<string, SmsEvent>
  doorbellEventById: Map<string, DoorbellEvent>
  callScriptById: Map<string, CallScript>
  callRecordById: Map<string, CallRecord>
  articleById: Map<string, OfficialAccountArticle>
  siteById: Map<string, Site>
  noteById: Map<string, Note>
  /** 搜索关键词（小写）→ pageIds */
  searchByKeyword: Map<string, PageId[]>
  /** QQ 群文件按 threadId 索引 */
  qqGroupFilesByThreadId: Map<string, QqGroupFilesEntry>
  /** 全部群文件扁平索引 by file id */
  qqGroupFileById: Map<string, QqGroupFile>
}

let _snapshot: GameDataSnapshot | null = null
let _index: GameDataIndex | null = null
const _messageCache = new Map<string, ChatMessage[]>()
const _pageCache = new Map<string, WebPage>()

/** clueBySource 的 key 计算规则（与 above 注释一致） */
export function clueSourceKey(source: ClueSource): string {
  switch (source.kind) {
    case 'wechat-thread': return `wechat-thread:${source.threadId}${source.messageId ? ':' + source.messageId : ''}`
    case 'wechat-moment': return `wechat-moment:${source.momentId}`
    case 'wechat-article': return `wechat-article:${source.articleId}`
    case 'qq-thread': return `qq-thread:${source.threadId}${source.messageId ? ':' + source.messageId : ''}`
    case 'qzone-post': return `qzone-post:${source.postId}`
    case 'web-page': return `web-page:${source.pageId}`
    case 'sms': return `sms:${source.smsId}`
    case 'call': return `call:${source.callId}`
    case 'doorbell': return `doorbell:${source.eventId}`
  }
}

export interface ViewPayload {
  kind: 'message' | 'page' | 'moment' | 'article' | 'qzone' | 'sms' | 'call' | 'doorbell'
  threadId?: string
  messageId?: string
  pageId?: string
  momentId?: string
  articleId?: string
  postId?: string
  smsId?: string
  callId?: string
  eventId?: string
}

/** 把 ViewPayload 转成 clueBySource 的查找 key（不含 messageId 时按 threadId 维度命中 thread 级线索）。 */
export function viewPayloadToClueKeys(p: ViewPayload): string[] {
  const keys: string[] = []
  if (p.kind === 'message' && p.threadId) {
    // thread 级（无 messageId）
    const platformPrefix = p.threadId.startsWith('thread') ? guessPlatformFromThreadId(p.threadId) : 'qq'
    const k = `${platformPrefix}-thread:${p.threadId}`
    keys.push(k)
    // 消息级（有 messageId）
    if (p.messageId) keys.push(`${platformPrefix}-thread:${p.threadId}:${p.messageId}`)
  } else if (p.kind === 'page' && p.pageId) {
    keys.push(`web-page:${p.pageId}`)
  } else if (p.kind === 'moment' && p.momentId) {
    keys.push(`wechat-moment:${p.momentId}`)
  } else if (p.kind === 'qzone' && p.postId) {
    keys.push(`qzone-post:${p.postId}`)
  } else if (p.kind === 'article' && p.articleId) {
    keys.push(`wechat-article:${p.articleId}`)
  } else if (p.kind === 'sms' && p.smsId) {
    keys.push(`sms:${p.smsId}`)
  } else if (p.kind === 'call' && p.callId) {
    keys.push(`call:${p.callId}`)
  } else if (p.kind === 'doorbell' && p.eventId) {
    keys.push(`doorbell:${p.eventId}`)
  }
  return keys
}

function guessPlatformFromThreadId(tid: string): 'wechat' | 'qq' {
  // 从 threadById 反查
  const t = _index?.threadById.get(tid)
  return t?.platform ?? 'qq'
}

// ===== 公共 API =====

/**
 * 加载全部元数据 + 索引（不含按需的消息、页面文件）。
 * 幂等，重复调用返回缓存。
 */
export async function loadGameData(): Promise<{ data: GameDataSnapshot; index: GameDataIndex }> {
  if (_snapshot && _index) return { data: _snapshot, index: _index }

  const [
    characters, wechatContacts, qqContacts, wechatThreads, qqThreads,
    moments, qzone, articles, puzzles, clues, evidence, endings, chapters,
    hints, monologues, smsEvents, doorbellEvents, callScripts, callRecords,
    notes, sites, searchIndex, riskEvents, qqGroupFiles,
  ] = await Promise.all([
    loadCharacters(), loadWechatContacts(), loadQqContacts(), loadWechatThreads(), loadQqThreads(),
    loadMoments(), loadQzone(), loadArticles(), loadPuzzles(), loadClues(), loadEvidence(), loadEndings(), loadChapters(),
    loadHints(), loadMonologues(), loadSmsEvents(), loadDoorbellEvents(), loadCallScripts(), loadCallRecords(),
    loadNotes(), loadSites(), loadSearchIndex(), loadRiskEvents(), loadQqGroupFiles(),
  ])

  _snapshot = {
    characters, wechatContacts, qqContacts, wechatThreads, qqThreads,
    moments, qzone, articles, puzzles, clues, evidence, endings, chapters,
    hints, monologues, smsEvents, doorbellEvents, callScripts, callRecords,
    notes, sites, searchIndex, riskEvents, qqGroupFiles,
  }

  // 建索引
  const contactById = new Map<string, Character>()
  for (const c of characters) contactById.set(c.id, c)

  const wechatContactByCharacterId = new Map<string, WechatContact>()
  for (const c of wechatContacts) wechatContactByCharacterId.set(c.characterId, c)

  const qqContactByCharacterId = new Map<string, QqContact>()
  for (const c of qqContacts) qqContactByCharacterId.set(c.characterId, c)

  const threadById = new Map<string, ChatThread>()
  const wechatThreadByTitle = new Map<string, ChatThread>()
  for (const t of [...wechatThreads, ...qqThreads]) {
    threadById.set(t.id, t)
    if (t.platform === 'wechat') wechatThreadByTitle.set(t.id, t)
  }

  const puzzleById = new Map<string, import('@/types').Puzzle>()
  for (const p of puzzles) puzzleById.set(p.id, p)

  const evidenceById = new Map<string, Evidence>()
  for (const e of evidence) evidenceById.set(e.id, e)

  const clueById = new Map<string, Clue>()
  const clueBySource = new Map<string, Clue>()
  for (const cl of clues) {
    clueById.set(cl.id, cl)
    clueBySource.set(clueSourceKey(cl.source), cl)
  }

  const chapterById = new Map<string, Chapter>()
  for (const ch of chapters) chapterById.set(ch.id, ch)

  const endingById = new Map<string, Ending>()
  for (const e of endings) endingById.set(e.id, e)

  const hintById = new Map<string, Hint>()
  for (const h of hints) hintById.set(h.id, h)

  const monologueById = new Map<string, Monologue>()
  const monologueByChapterId = new Map<string, Monologue>()
  for (const m of monologues) {
    monologueById.set(m.id, m)
    monologueByChapterId.set(m.chapterId, m)
  }

  const smsEventById = new Map<string, SmsEvent>()
  for (const s of smsEvents) smsEventById.set(s.id, s)

  const doorbellEventById = new Map<string, DoorbellEvent>()
  for (const d of doorbellEvents) doorbellEventById.set(d.id, d)

  const callScriptById = new Map<string, CallScript>()
  for (const c of callScripts) callScriptById.set(c.id, c)

  const callRecordById = new Map<string, CallRecord>()
  for (const c of callRecords) callRecordById.set(c.id, c)

  const articleById = new Map<string, OfficialAccountArticle>()
  for (const a of articles) articleById.set(a.id, a)

  const siteById = new Map<string, Site>()
  for (const s of sites) siteById.set(s.id, s)

  const noteById = new Map<string, Note>()
  for (const n of notes) noteById.set(n.id, n)

  const searchByKeyword = new Map<string, PageId[]>()
  for (const e of searchIndex) {
    searchByKeyword.set(e.keyword.toLowerCase(), e.pageIds)
  }

  const qqGroupFilesByThreadId = new Map<string, QqGroupFilesEntry>()
  const qqGroupFileById = new Map<string, QqGroupFile>()
  for (const g of qqGroupFiles.groups) {
    qqGroupFilesByThreadId.set(g.threadId, g)
    for (const f of g.files) qqGroupFileById.set(f.id, f)
  }

  _index = {
    contactById, wechatContactByCharacterId, qqContactByCharacterId,
    threadById, wechatThreadByTitle,
    puzzleById, evidenceById, clueById, clueBySource,
    chapterById, endingById, hintById, monologueById, monologueByChapterId,
    smsEventById, doorbellEventById, callScriptById, callRecordById,
    articleById, siteById, noteById, searchByKeyword,
    qqGroupFilesByThreadId, qqGroupFileById,
  }

  return { data: _snapshot, index: _index }
}

// ===== 查询 API（同步，需先 await loadGameData）=====

function requireIndex(): GameDataIndex {
  if (!_index) throw new Error('[loader] GameData 未加载，请先 await loadGameData()')
  return _index
}
function requireSnapshot(): GameDataSnapshot {
  if (!_snapshot) throw new Error('[loader] GameData 未加载，请先 await loadGameData()')
  return _snapshot
}

export function getContact(id: string): Character | undefined {
  return requireIndex().contactById.get(id)
}
export function getWechatContact(characterId: string): WechatContact | undefined {
  return requireIndex().wechatContactByCharacterId.get(characterId)
}
export function getQqContact(characterId: string): QqContact | undefined {
  return requireIndex().qqContactByCharacterId.get(characterId)
}
export function getThreadById(id: string): ChatThread | undefined {
  return requireIndex().threadById.get(id)
}
export function getAllThreads(): ChatThread[] {
  const s = requireSnapshot()
  return [...s.wechatThreads, ...s.qqThreads]
}
export function getWechatThreads(): ChatThread[] {
  return requireSnapshot().wechatThreads
}
export function getQqThreads(): ChatThread[] {
  return requireSnapshot().qqThreads
}
export function getPuzzleById(id: string): import('@/types').Puzzle | undefined {
  return requireIndex().puzzleById.get(id)
}
export function getAllPuzzles(): import('@/types').Puzzle[] {
  return requireSnapshot().puzzles
}
export function getEvidenceById(id: string): Evidence | undefined {
  return requireIndex().evidenceById.get(id)
}
export function getAllEvidence(): Evidence[] {
  return requireSnapshot().evidence
}
export function getClueById(id: string): Clue | undefined {
  return requireIndex().clueById.get(id)
}
export function getClueBySourceKey(key: string): Clue | undefined {
  return requireIndex().clueBySource.get(key)
}
export function findCluesByViewPayload(p: ViewPayload): Clue[] {
  const idx = requireIndex()
  const keys = viewPayloadToClueKeys(p)
  const out: Clue[] = []
  for (const k of keys) {
    const c = idx.clueBySource.get(k)
    if (c) out.push(c)
  }
  // dedupe
  const seen = new Set<string>()
  return out.filter((c) => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  })
}
export function getChapterById(id: string): Chapter | undefined {
  return requireIndex().chapterById.get(id)
}
export function getAllChapters(): Chapter[] {
  return requireSnapshot().chapters
}
export function getEndingById(id: string): Ending | undefined {
  return requireIndex().endingById.get(id)
}
export function getAllEndings(): Ending[] {
  return requireSnapshot().endings
}
export function getHintById(id: string): Hint | undefined {
  return requireIndex().hintById.get(id)
}
export function getAllHints(): Hint[] {
  return requireSnapshot().hints
}
export function getHintsForPuzzle(puzzleId: string): Hint[] {
  return requireSnapshot().hints.filter((h) => h.puzzleId === puzzleId)
}
export function getMonologueById(id: string): Monologue | undefined {
  return requireIndex().monologueById.get(id)
}
export function getMonologueByChapter(chapterId: string): Monologue | undefined {
  return requireIndex().monologueByChapterId.get(chapterId)
}
export function getAllMonologues(): Monologue[] {
  return requireSnapshot().monologues
}
export function getSmsEventById(id: string): SmsEvent | undefined {
  return requireIndex().smsEventById.get(id)
}
export function getAllSmsEvents(): SmsEvent[] {
  return requireSnapshot().smsEvents
}
export function getDoorbellEventById(id: string): DoorbellEvent | undefined {
  return requireIndex().doorbellEventById.get(id)
}
export function getCallScriptById(id: string): CallScript | undefined {
  return requireIndex().callScriptById.get(id)
}
export function getCallRecordById(id: string): CallRecord | undefined {
  return requireIndex().callRecordById.get(id)
}
export function getAllCallRecords(): CallRecord[] {
  return requireSnapshot().callRecords
}
export function getArticleById(id: string): OfficialAccountArticle | undefined {
  return requireIndex().articleById.get(id)
}
export function getAllArticles(): OfficialAccountArticle[] {
  return requireSnapshot().articles
}
export function getSiteById(id: string): Site | undefined {
  return requireIndex().siteById.get(id)
}
export function getAllSites(): Site[] {
  return requireSnapshot().sites
}
export function getSearchIndex(): SearchIndexEntry[] {
  return requireSnapshot().searchIndex
}
export function searchPages(keyword: string): PageId[] {
  const k = keyword.trim().toLowerCase()
  if (!k) return []
  const idx = requireIndex()
  const direct = idx.searchByKeyword.get(k)
  if (direct) return direct
  // 模糊包含
  const out: PageId[] = []
  for (const [kw, ids] of idx.searchByKeyword) {
    if (kw.includes(k) || k.includes(kw)) out.push(...ids)
  }
  return Array.from(new Set(out))
}
export function getNoteById(id: string): Note | undefined {
  return requireIndex().noteById.get(id)
}
export function getAllNotes(): Note[] {
  return requireSnapshot().notes
}
export function getMoments(): MomentsPost[] {
  return requireSnapshot().moments
}
export function getQzone(): MomentsPost[] {
  return requireSnapshot().qzone
}
export function getRiskEvents(): RiskEventsFile {
  return requireSnapshot().riskEvents
}
/** QQ 群文件清单全集。 */
export function getQqGroupFiles(): QqGroupFilesFile {
  return requireSnapshot().qqGroupFiles
}
/** 按 threadId 取该群组下的文件条目。 */
export function getQqGroupFilesByThread(threadId: string): QqGroupFilesEntry | undefined {
  return requireIndex().qqGroupFilesByThreadId.get(threadId)
}
/** 按 file id 取群文件条目。 */
export function getQqGroupFileById(fileId: string): QqGroupFile | undefined {
  return requireIndex().qqGroupFileById.get(fileId)
}

/** 页面按需加载（带内存缓存）。 */
export async function getPage(pageId: string): Promise<WebPage> {
  const cached = _pageCache.get(pageId)
  if (cached) return cached
  const page = await loadPage(pageId)
  _pageCache.set(pageId, page)
  return page
}
/** 同步取已缓存的页面（未加载返回 undefined）。 */
export function getCachedPage(pageId: string): WebPage | undefined {
  return _pageCache.get(pageId)
}

/** 消息按需加载（带内存缓存）。 */
export async function getMessages(threadId: string): Promise<ChatMessage[]> {
  const cached = _messageCache.get(threadId)
  if (cached) return cached
  const msgs = await loadMessages(threadId)
  _messageCache.set(threadId, msgs)
  return msgs
}
/** 同步取已缓存的消息（未加载返回 undefined）。 */
export function getCachedMessages(threadId: string): ChatMessage[] | undefined {
  return _messageCache.get(threadId)
}

/** 仅供测试/重置用：清空全部缓存。 */
export function resetLoaderCache(): void {
  _snapshot = null
  _index = null
  _messageCache.clear()
  _pageCache.clear()
}
