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
  /** 可点跳转链接（pageId → 站内全屏站点路由新标签打开，如公众号引导访问官网）。 */
  link?: { title?: string; url?: string; pageId?: PageId };
  registersClueId?: ClueId;
  triggersEvidenceId?: EvidenceId;
  /** 论文 AI 解读：site-ai-pdf 本地哈希校验通过后展示的预设解读文章（CLAUDE.md §6.5；FilesApp 已删，改为站点真实上传校验）。 */
  isGeneratedContent?: boolean;
  /** 触发条件：玩家先解开该 uploadAndInterpret 谜题才生成本文章。 */
  triggerUploadPuzzleId?: PuzzleId;
}

// ===== 网页 =====
//
// 重写后（玩家决策 2026-08-19）：访问门控整体废除——所有页面任意访客可自由浏览。
// PageAccessibility 退化为宽松 { kind: 'public' } 形态（站点页 JSON 仍带该字段，passthrough 容错）。
export type PageAccessibility = { kind: "public" };

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
  | { type: "sourceComment"; comment: string; linkPageId?: PageId }
  | { type: "loginForm"; puzzleId: PuzzleId }
  | { type: "pdfViewer"; assetId: string };

export interface WebPage {
  id: PageId;
  siteId: string;
  url: string;
  title: string;
  /** 重写后全部 public（门控已废）。保留字段以兼容 page JSON。 */
  accessibility: PageAccessibility;
  blocks: PageBlock[];
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
 *  - oneOf：多个可接受答案（如 20251128 容错 1128）
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

export interface Puzzle {
  id: PuzzleId;
  type: PuzzleType;
  title: string;
  chapterId: ChapterId;
  /** 答案（数据形态）；校验逻辑在 matchStrategy + src/game/answerCheck。
   *  重写后（玩家决策 2026-08-19）：引擎副作用链已删，puzzles.json 不再带
   *  onSuccess/onFailure/unlocks 系列字段与 effect 数组——解谜只做"怎么验"，后续动作由调用方
   *  （网站登录揭示后台页 / 手机 App markPuzzleSolved 推进剧情 / 终章勾选判定结局）自行处理。 */
  answer: string | string[];
  matchStrategy: AnswerMatchStrategy;
}

// ===== 证据 =====
//
// 重写后（玩家决策 2026-08-19）：线索注册/收集触发机制（ClueRegistry、collectingCondition、
// trigger*）整体废除。证据收集 = 相册勾选·荣誉制；本接口只保留展示字段（证据库 UI 用）。
export interface Evidence {
  id: EvidenceId;
  title: string;
  description: string;
  chapterId: ChapterId;
  /** 关键证据（5 项进 requiredEvidenceIds）。 */
  isKey: boolean;
}

// ===== 结局 =====
export type EndingId = "good" | "normal" | "bad";

//
// 重写后（玩家决策 2026-08-19）：结局判定不再由 EndingTrigger 联合驱动。good/normal 由终章
// 证据勾选 + 拨号（checkAnswer('puzzle-evidence-finale')）判定，bad 由倒计时归零（watchCountdownExpiry
// → pushEnding('bad')）。EndingOverlay 只按 endingId 取 epilogueBlocks 渲染，故 endings.json 已去掉
// trigger 字段；本接口亦不再持 trigger。
export interface Ending {
  id: EndingId;
  title: string;
  epilogueBlocks: ArticleBlock[];
  postEndingSms?: { from: ContactId; text: string }[];
  postEndingWechatMessage?: {
    threadId: ThreadId;
    messages: ChatMessage[];
  };
}

// 提示系统（Hints）整体废除：线索/风险机制已废，hintValue 不再被读取。story/hints.json 已删。


// ===== 章节 =====
//
// 重写后（玩家决策 2026-08-19）：章节门控/推进器（ChapterDirector、enterCondition、
// onEnterEffects、objectives）整体废除。currentChapterId 仅作"消息出现时间表"——由收集
// 关键证据推进（AlbumApp），只门控哪些微信/短信消息出现，不门控 App/页面访问。本接口
// 只保留展示字段（shellState.monologue 读 introMonologueId 取章节开场独白；NotesApp 已删）。
export interface Chapter {
  id: ChapterId;
  index: number;
  title: string;
  introMonologueId?: string;
}

// ===== 游戏状态 =====
//
// 重写后的进度模型（玩家决策 2026-08-19）：
//  - 持久化只存"检查点"（见 PersistedCheckpoint）：章节 + 已解谜题 + 已收集证据 +
//    解锁记录 + 结局。断点续玩只恢复这些。
//  - 易变态字段（倒计时 / 查看记录 / 已显提示）只在内存，刷新即清——
//    彻底修掉"刷新即坏结局"（旧设计把 countdowns.startedAt 落盘，刷新会续算到 0 触发 bad）。
//  - registerClue / risk 两个机制已被玩家决定整体移除，故 GameState 不再持有
//    registeredClueIds / risk。
//
// GameState 现仅作为"运行态"类型（含易变态字段，供同会话内逻辑使用）；
// 落盘由 store 的 partialize 映射到 PersistedCheckpoint。

/** 落盘的检查点子集（localStorage webgame-save 实际持久化的形态）。 */
export interface PersistedCheckpoint {
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
  collectedEvidenceIds: EvidenceId[];
  endingId?: EndingId;
  finished: boolean;
}

/** 运行态：检查点字段 + 易变态（内存）字段。易变态字段一律标注 ?。 */
export interface GameState extends PersistedCheckpoint {
  /** 易变态（内存）：倒计时。刷新后清空，由页面首访 onViewEffects 重新触发。 */
  countdowns?: Record<
    string,
    { startedAt: ISODateString; durationSec: number; expired: boolean }
  >;
  /** 易变态（内存）：本次会话已展示的提示 id。 */
  shownHintIds?: string[];
  lastHintAt?: ISODateString;
  /** 易变态（内存）：已访问页面/会话/已查看消息/朋友圈，纯本地 UI 态，不落盘。 */
  visitedPages?: PageId[];
  visitedThreads?: ThreadId[];
  viewedMessages?: string[];
  viewedMoments?: string[];
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
  /** 仅当结局为该值时才随 pushTriggerPuzzleId 投递（如真结局受理回执）。 */
  pushTriggerEndingId?: EndingId;
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
