/**
 * src/types/index.ts
 *
 * 张强宿舍大逃杀 — 全局类型契约（数据即契约的依赖根）。
 *
 * 这是所有 agent 的依赖根（CLAUDE.md §4.2）。文案 agent 产出的
 * public/data 下的 JSON 与前端加载/校验逻辑都必须满足本文件定义。
 * 本文件由 doc-engineer 主维护，重大变更需通告全局。
 *
 * 设计要点（CLAUDE.md §4.2 + §6）：
 *  - answer 与 matchStrategy 分离：谜题答案数据形态由 level-designer 定，
 *    校验逻辑由前端 engine/puzzle 实现，前端不持硬编码答案。
 *  - PuzzleEffect 数组：解谜/失败的副作用清单（加风险、推短信、推门铃、倒计时…）。
 *  - PageAccessibility：四类 discriminated union（public/hidden/loginRequired/linkedOnly）。
 *  - Clue.source：enumerated union 枚举所有信息载体。
 *  - 关卡机制钩子（registersClueId / triggersEvidenceId）：文案 agent 留空，
 *    level-designer phase3 用 JSON patch 回填（避免两类 agent 改同一行）。
 *  - 消息拆文件：ChatThread.messageFile 指向 messages 下各 threadId.json。
 *  - direction 字段解决"登录李桥瑞 QQ 后，闫欣泽发的消息是 received"视角。
 *  - import.meta.env.BASE_URL 必须原样出现于前端代码（构建时静态替换）。
 *
 * AppManifest 的 Component 字段为 unknown 以保持本类型文件与 React 解耦；
 * phone-shell 在 AppRegistry 处做 React.lazy 包裹后 cast 回组件类型。
 */

// ===== ID 别名（CLAUDE.md §4.2 命名约定）=====
export type ContactId = string;
export type PuzzleId = string;
export type EvidenceId = string;
export type ClueId = string;
export type PageId = string;
export type ThreadId = string;
export type ChapterId = string;
export type ISODateString = string;
export type StarRating = 0 | 1 | 2 | 3 | 4 | 5;

// ===== 人物（meta/characters.json，微信 QQ 共用）=====
export interface Character {
  id: ContactId;
  name: string;
  displayName?: string;
  role: "protagonist" | "key-student" | "staff" | "external" | "npc";
  avatarAssetId: string;
  intro?: string;
  age?: number;
  schoolClass?: string;
}

export interface WechatContact {
  characterId: ContactId;
  wechatRemark?: string;
  wechatNickname: string;
  isOfficialAccount?: boolean;
  status?: "online" | "offline" | "lost";
  starValue?: StarRating;
}

export interface QqContact {
  characterId: ContactId;
  qqNumber: string;
  qqNickname: string;
  qqRemark?: string;
  isGroup?: boolean;
  memberCount?: number;
  status?: "online" | "offline" | "lost";
}

// ===== 聊天 =====
export type MessageDirection = "sent" | "received";
export type MessageKind =
  | "text"
  | "image"
  | "voice"
  | "link"
  | "system"
  | "redpacket"
  | "file";

export interface ChatMessage {
  id: string;
  threadId: ThreadId;
  /** "sent"=玩家视角发出；"received"=玩家视角收到。登录李桥瑞 QQ 后，闫欣泽发的消息是 received。 */
  direction: MessageDirection;
  authorCharacterId?: ContactId;
  timestamp: ISODateString;
  kind: MessageKind;
  text?: string;
  assetIds?: string[];
  voiceDurationSec?: number;
  voiceTranscript?: string;
  link?: {
    title?: string;
    url?: string;
    pageId?: PageId;
    assetId?: string;
  };
  recalled?: boolean;
  /** 关卡钩子（phase3 回填）：查看此消息即注册该线索。 */
  registersClueId?: ClueId;
  /** 关卡钩子（phase3 回填）：查看此消息即收集该证据。 */
  triggersEvidenceId?: EvidenceId;
}

export interface ChatThread {
  id: ThreadId;
  platform: "wechat" | "qq";
  type: "single" | "group";
  title: string;
  participantCharacterIds: ContactId[];
  lastMessageAt: ISODateString;
  unreadCount?: number;
  /** 解谜后才解锁本会话。 */
  requiredPuzzleId?: PuzzleId;
  /** 消息拆文件：指向 `messages/<threadId>.json`（相对 data 根）。 */
  messageFile: string;
}

// ===== 朋友圈 / QQ 空间 =====
export interface MomentsComment {
  authorCharacterId: ContactId;
  text: string;
  createdAt?: ISODateString;
  deleted?: boolean;
}

export interface MomentsPost {
  id: string;
  authorCharacterId: ContactId;
  createdAt: ISODateString;
  text?: string;
  assetIds?: string[];
  link?: { title?: string; url?: string; pageId?: PageId };
  likes?: ContactId[];
  comments?: MomentsComment[];
  starValue?: StarRating;
  /** 关卡钩子（phase3 回填）。 */
  registersClueId?: ClueId;
  triggersEvidenceId?: EvidenceId;
}

// ===== 公众号文章 =====
export type ArticleBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "image"; assetId: string; caption?: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "callout"; variant: "info" | "warning" | "danger"; text: string };

export interface OfficialAccountArticle {
  id: string;
  accountName: string;
  accountCategory?:
    | "tool"
    | "news"
    | "school"
    | "org"
    | "game"
    | "health";
  title: string;
  publishedAt: ISODateString;
  coverAssetId?: string;
  bodyBlocks: ArticleBlock[];
  url?: string;
  registersClueId?: ClueId;
  triggersEvidenceId?: EvidenceId;
  /** 论文 AI 解读：前端检测论文 PDF 已在 FilesApp → 触发本伪解读文章（CLAUDE.md §6.5）。 */
  isGeneratedContent?: boolean;
  /** 触发条件：玩家先解开该 uploadAndIntercept 谜题才生成本文章。 */
  triggerUploadPuzzleId?: PuzzleId;
}

// ===== 网页 =====
/**
 * 页面可达性四类（discriminated union）：
 *  - public：任意时刻可访问
 *  - hidden：需从某页面发现入口（hint），如 `/qiangzhang` URL 后缀
 *  - loginRequired：需解谜（puzzleId）登录后台才能访问
 *  - linkedOnly：仅能从某页面内部链接进入
 */
export type PageAccessibility =
  | { kind: "public" }
  | { kind: "hidden"; discoverFrom: PageId; hint: string }
  | { kind: "loginRequired"; puzzleId: PuzzleId }
  | { kind: "linkedOnly"; fromPageId: PageId };

export type PageBlock =
  | { type: "hero"; heading: string; subheading?: string; imageAssetId?: string }
  | { type: "nav"; links: Array<{ label: string; pageId: PageId }> }
  | {
      type: "articleList";
      items: Array<{ title: string; pageId: PageId; date?: ISODateString }>;
    }
  | { type: "paragraph"; text: string }
  | { type: "callout"; variant: "info" | "warning" | "danger"; text: string }
  | { type: "image"; assetId: string; caption?: string; zoomable?: boolean }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "form"; formId: string; onSubmitMessage: string }
  | { type: "sourceComment"; comment: string }
  | { type: "loginForm"; puzzleId: PuzzleId }
  | { type: "pdfViewer"; assetId: string; requiresPuzzleId?: PuzzleId };

/** 页面被发现的方式（用于 hint/源码注释/搜索）。 */
export type DiscoverableBy =
  | { type: "urlSuffix"; basePageId: PageId; suffix: string }
  | { type: "sourceCodeComment"; onPageId: PageId; commentText: string }
  | { type: "search"; queryKeyword: string };

export interface WebPage {
  id: PageId;
  siteId: string;
  url: string;
  title: string;
  accessibility: PageAccessibility;
  blocks: PageBlock[];
  discoverableBy?: DiscoverableBy[];
  registersClueId?: ClueId;
  triggersEvidenceId?: EvidenceId;
  /** 页面内含某资源（如 PDF），收集需先解谜。 */
  containsAssetId?: string;
  assetRequiresPuzzleId?: PuzzleId;
  /**
   * 玩家首次查看本页时触发的关卡副作用清单（level-designer 关卡机制扩展）。
   * 由前端引擎在页面首次访问（visitedPages 首次记录）时执行一次。
   * 典型用途：page-lab-funding-report 首次打开触发 3 分钟倒计时 + 威胁短信 +
   * 刀哥门铃 + 心跳音频（CLAUDE.md §6 + 交互设计 §四.2，倒计时由查看经费报告页触发，
   * 而非登录实验室后台瞬间）。
   */
  onViewEffects?: PuzzleEffect[];
}

export interface Site {
  id: string;
  name: string;
  baseUrl: string;
  pages: PageId[];
}

export interface SearchIndexEntry {
  keyword: string;
  pageIds: PageId[];
}

// ===== 谜题（最关键）=====
export type PuzzleType =
  | "password"
  | "pdfPassword"
  | "phoneNumber"
  | "evidenceSelection"
  | "uploadAndInterpret";

/**
 * 校验策略（与 answer 分离）：
 *  - exact：精确匹配（可大小写/trim）
 *  - oneOf：多个可接受答案（如 0328 容错 20260328）
 *  - regex：正则
 *  - phoneNumber：归一化后取 normalizedDigits 位比较
 *  - evidenceSet：终章证据勾选，requiredEvidenceIds 5项 minLength 5
 */
export type AnswerMatchStrategy =
  | { kind: "exact"; caseSensitive?: boolean; trim?: boolean }
  | { kind: "oneOf"; accepted: string[] }
  | { kind: "regex"; pattern: string }
  | { kind: "phoneNumber"; normalizedDigits: number }
  | {
      kind: "evidenceSet";
      requiredEvidenceIds: EvidenceId[];
      minLength: number;
    };

/** 谜题副作用（解谜成功/失败触发）：清单化，前端 PuzzleEffect 执行器消费。 */
export type PuzzleEffect =
  | { type: "addRisk"; amount: number }
  | { type: "removeRisk"; amount: number }
  | { type: "startCountdown"; durationSec: number; id: string }
  | { type: "advanceChapter"; toChapterId: ChapterId }
  | { type: "pushSms"; smsEventId: string }
  | { type: "pushDoorbell"; doorbellEventId: string }
  | { type: "registerClue"; clueId: ClueId }
  | { type: "collectEvidence"; evidenceId: EvidenceId }
  | { type: "playAudio"; assetId: string; loop?: boolean }
  | { type: "stopAudio"; assetId?: string }
  | { type: "vibrate" }
  | { type: "fullscreenAlert"; text: string }
  | { type: "pushEnding"; endingId: EndingId }
  | { type: "openNewsApp"; endingId: EndingId }
  | { type: "openApp"; appId: string };

export interface Puzzle {
  id: PuzzleId;
  type: PuzzleType;
  title: string;
  chapterId: ChapterId;
  /** 答案（数据形态）；校验逻辑在 matchStrategy + 前端 engine/puzzle。 */
  answer: string | string[];
  matchStrategy: AnswerMatchStrategy;
  maxAttempts?: number;
  attemptsToHint?: number;
  riskPerWrongAttempt?: number;
  lockoutAfterAttempts?: number;
  hintIds: ClueId[];
  onSuccess: PuzzleEffect[];
  onFailure?: PuzzleEffect[];
  unlocksThreadIds?: ThreadId[];
  unlocksPageIds?: PageId[];
  unlocksAssetIds?: string[];
  registersEvidenceIds?: EvidenceId[];
}

// ===== 线索 =====
/** 线索来源：枚举所有信息载体的 discriminated union。 */
export type ClueSource =
  | { kind: "wechat-thread"; threadId: ThreadId; messageId?: string }
  | { kind: "wechat-moment"; momentId: string }
  | { kind: "wechat-article"; articleId: string }
  | { kind: "qq-thread"; threadId: ThreadId; messageId?: string }
  | { kind: "qzone-post"; postId: string }
  | { kind: "web-page"; pageId: PageId }
  | { kind: "sms"; smsId: string }
  | { kind: "call"; callId: string }
  | { kind: "doorbell"; eventId: string };

export interface Clue {
  id: ClueId;
  chapterId: ChapterId;
  title: string;
  summary: string;
  source: ClueSource;
  relatedEvidenceIds: EvidenceId[];
  isRedHerring: boolean;
  redHerringNote?: string;
  /** 查看即自动注册到线索本（无需解谜）。 */
  autoRegisterOnView: boolean;
}

// ===== 证据 =====
export interface Evidence {
  id: EvidenceId;
  title: string;
  description: string;
  chapterId: ChapterId;
  source: ClueSource;
  /** 关键证据（5 项进 requiredEvidenceIds）。 */
  isKey: boolean;
  collectingCondition: "onView" | "onPuzzleSolve" | "onScreenshot";
  screenshotAssetId?: string;
  triggerClueId?: ClueId;
  triggerPuzzleId?: PuzzleId;
  triggerPageId?: PageId;
}

// ===== 结局 =====
export type EndingId = "good" | "normal" | "bad";

export type EndingTrigger =
  | { kind: "evidenceSufficient"; puzzleId: PuzzleId }
  | { kind: "evidenceInsufficient"; puzzleId: PuzzleId }
  | { kind: "countdownExpired"; countdownId: string }
  | { kind: "riskMaxed" }
  | { kind: "manual"; chapterId: ChapterId };

export interface Ending {
  id: EndingId;
  title: string;
  trigger: EndingTrigger;
  epilogueBlocks: ArticleBlock[];
  postEndingSms?: { from: ContactId; text: string }[];
  postEndingWechatMessage?: {
    threadId: ThreadId;
    messages: ChatMessage[];
  };
}

// ===== 提示 =====
export type HintTrigger =
  | { kind: "idleOnPage"; pageId: PageId; seconds: number }
  | { kind: "wrongAttempts"; puzzleId: PuzzleId; attempts: number }
  | { kind: "viewedClue"; clueId: ClueId }
  | { kind: "chapterEntered"; chapterId: ChapterId }
  | { kind: "askedContact"; characterId: ContactId; keyword?: string };

export interface Hint {
  id: string;
  puzzleId?: PuzzleId;
  trigger: HintTrigger;
  text: string;
  tier: 1 | 2 | 3;
  cooldownSec?: number;
  onlyOnce?: boolean;
}

// ===== 章节 =====
export type ChapterCondition =
  | { kind: "gameStart" }
  | { kind: "puzzleSolved"; puzzleId: PuzzleId }
  | { kind: "evidenceCollected"; evidenceId: EvidenceId }
  | { kind: "clueRegistered"; clueId: ClueId }
  | { kind: "and"; conditions: ChapterCondition[] };

export interface ChapterObjective {
  id: string;
  description: string;
  completionPuzzleId?: PuzzleId;
  completionEvidenceId?: EvidenceId;
  completionClueId?: ClueId;
  hidden?: boolean;
}

export interface Chapter {
  id: ChapterId;
  index: number;
  title: string;
  enterCondition: ChapterCondition;
  introMonologueId?: string;
  onEnterEffects?: PuzzleEffect[];
  objectives: ChapterObjective[];
}

// ===== 游戏状态（运行态，非数据文件）=====
export interface GameState {
  saveId: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  version: string;
  currentChapterId: ChapterId;
  completedObjectives: string[];
  solvedPuzzleIds: PuzzleId[];
  puzzleAttempts: Record<PuzzleId, number>;
  unlockedPageIds: PageId[];
  unlockedThreadIds: ThreadId[];
  unlockedAssetIds: string[];
  registeredClueIds: ClueId[];
  collectedEvidenceIds: EvidenceId[];
  risk: number;
  countdowns: Record<
    string,
    { startedAt: ISODateString; durationSec: number; expired: boolean }
  >;
  shownHintIds: string[];
  lastHintAt?: ISODateString;
  visitedPages: PageId[];
  visitedThreads: ThreadId[];
  viewedMessages: string[];
  viewedMoments: string[];
  endingId?: EndingId;
  finished: boolean;
}

// ===== 手机/故事数据文件类型（writer-phone-story 产出，mirror SCHEMA.md）=====
// 这些类型对应 public/data/phone/** 与 public/data/story/** 的 JSON 结构，
// 不属于关卡核心契约，但 loader 需要 Zod 校验，故纳入本文件。

/** 短信发送方：characterId 或未知号码对象。 */
export type SmsFrom = ContactId | { kind: 'unknownNumber'; display: string; digits: string };

/** 短信推送触发条件（宽松结构，loader 用 passthrough，前端只消费已声明字段）。 */
export type SmsPushTrigger =
  | { kind: 'askedContact'; characterId: ContactId; keyword?: string }
  | { kind: 'idleOnPage'; pageId: PageId; seconds: number }
  | { kind: 'chapterEntered'; chapterId: ChapterId };

/** 短信事件（data/phone/sms.json events[]）。 */
export interface SmsEvent {
  id: string;
  pushTriggerPuzzleId?: PuzzleId;
  pushTriggerRiskEventId?: string;
  pushTrigger?: SmsPushTrigger;
  from: SmsFrom;
  direction?: MessageDirection;
  receivedAt: ISODateString;
  body: string;
  footnote?: string | null;
  alertStyle?: 'info' | 'warning' | 'danger' | 'success';
  registersClueId?: ClueId | null;
  triggersEvidenceId?: EvidenceId | null;
}

/** 智能门铃/摄像头事件（data/phone/doorbell-events.json events[]）。 */
export interface DoorbellEvent {
  id: string;
  sourcePuzzleId?: PuzzleId;
  pushTriggerPuzzleId?: PuzzleId;
  triggeredAt: ISODateString;
  doorbellCharacterId?: ContactId | null;
  title: string;
  pushNotification: { appName: string; title: string; body: string };
  liveFeed: {
    sceneDescription: string;
    characterAssetId: string;
    clipAssetId?: string;
    loop?: boolean;
  };
  audio?: { assetId: string; loop?: boolean; volume?: number };
  deviceFeedback?: Array<{ type: string; [k: string]: unknown }>;
  countdownBar?: {
    countdownId: string;
    durationSec: number;
    style: string;
    alertText: string;
    alertStyle: string;
  };
  onTimeoutText?: string;
  onTimeoutEndingId?: EndingId;
  registersClueId?: ClueId | null;
  triggersEvidenceId?: EvidenceId | null;
}

/** 通话脚本 block（宽松联合，前端按 type 分发渲染；evidenceSelection/branch/system/line）。 */
export type CallScriptBlock =
  | { type: 'line'; speaker: ContactId | null; text: string; timestampSec: number; audioAssetId?: string; characterBehavior?: string }
  | { type: 'system'; text: string; timestampSec: number }
  | { type: 'evidenceSelection'; puzzleId: PuzzleId; prompt: string; minLength: number; requiredEvidenceIds: EvidenceId[]; optionalEvidenceIds?: EvidenceId[]; timestampSec: number }
  | { type: 'branch'; condition: { kind: 'puzzleSucceeded' | 'puzzleFailed'; puzzleId: PuzzleId }; branchId: string; timestampSec: number };

/** 通话脚本分支（good/normal 等）。 */
export interface CallScriptBranch {
  blocks: CallScriptBlock[];
  endEffects: Array<{ type: string; [k: string]: unknown }>;
}

/** 复杂通话脚本（data/phone/call-scripts.json scripts[]）。 */
export interface CallScript {
  id: string;
  title: string;
  callee: ContactId | null;
  calleeDisplay: string;
  blocks: CallScriptBlock[];
  endEffect?: { type: string; [k: string]: unknown } | null;
  branches?: Record<string, CallScriptBranch>;
}

/** 通话记录条目（data/phone/call-log.json records[]）。 */
export interface CallRecord {
  id: string;
  contactCharacterId?: ContactId | null;
  displayNumber: string;
  rawNumber?: string;
  direction: 'incoming' | 'outgoing';
  status: string;
  statusText?: string;
  calledAt: ISODateString;
  durationSec: number;
  relatedChapterId?: ChapterId;
  scriptId?: string | null;
}

/** 备忘录笔记（data/phone/notes.json notes[]）。引擎 ClueRegistry 自动追加线索摘要。 */
export interface Note {
  id: string;
  title: string;
  createdAt: ISODateString;
  pinned?: boolean;
  body: string;
  isTemplate?: boolean;
}

/** 章节开场独白（data/story/monologues.json[]）。 */
export interface Monologue {
  id: string;
  chapterId: ChapterId;
  title: string;
  trigger: { kind: 'chapterEntered'; chapterId: ChapterId };
  lines: string[];
  onlyOnce?: boolean;
}

/** 风险值事件文件（data/meta/risk-events.json）。 */
export interface RiskEvent {
  id: string;
  source: string;
  amount: number;
  trigger: { kind: string; [k: string]: unknown };
  triggerDescription?: string;
}

export interface RiskEventsFile {
  thresholds: { max: number; badEndingAt: number; redAlertAt: number };
  events: RiskEvent[];
}

/** QQ 群文件条目（data/qq/group-files.json groups[].files[]）。 */
export interface QqGroupFile {
  id: string;
  name: string;
  uploaderCharacterId?: ContactId;
  uploadedAt?: ISODateString;
  type?: string;
  sizeKB?: number;
  assetId?: string;
  /** 关联页（"relatePageId" 字段名按数据现状保留，对齐 pageId）。 */
  relatePageId?: PageId;
  pageId?: PageId;
  note?: string;
  registersClueId?: ClueId | null;
  triggersEvidenceId?: EvidenceId | null;
}

export interface QqGroupFilesEntry {
  threadId: ThreadId;
  title: string;
  files: QqGroupFile[];
}

/** QQ 群文件清单文件（data/qq/group-files.json）。 */
export interface QqGroupFilesFile {
  groups: QqGroupFilesEntry[];
}

// ===== App manifest（前端 AppRegistry 用）=====
/**
 * 各 App（微信/QQ/浏览器/短信…）声明一个 manifest，由 phone-shell 用
 * import.meta.glob 扫描 apps 下各子目录的 manifest.ts 自动聚合到 AppRegistry。
 *
 * Component 设为 unknown 以让本类型文件不依赖 React；phone-shell 在注册时
 * 把它当作 React.LazyExoticComponent<React.ComponentType<unknown>> 使用。
 */
export interface AppManifest {
  appId: string;
  title: string;
  icon: string;
  route: string;
  /** 懒加载组件；phone-shell 用 React.lazy 包裹。 */
  Component: unknown;
  availableFrom: ChapterId;
  hiddenUntilPuzzleId?: PuzzleId;
}
