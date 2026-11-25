# SCHEMA.md — 类型契约人类可读版

> 镜像 `src/types/index.ts`（doc-engineer 主维护）。本文档是 `public/data/**/*.json` 的契约说明：文案 agent 据此写 JSON，前端 engine 据此做 Zod 校验与运行时消费。两个文件必须同步，冲突以 `src/types/index.ts` 为准（代码是真源），文档偏差请提 issue 通告 doc-engineer。

## 0. 设计原则（CLAUDE.md §4 + §4.2）

1. **数据即契约**：`public/data/**/*.json` 是文案 agent 与前端 agent 的唯一耦合面。前端只读 JSON、不生成 JSON；文案只写 JSON、不触碰 `src/`。
2. **"是什么"在数据，"怎么验"在代码**：谜题答案的数据形态由 level-designer 定（`data/puzzle/puzzles.json` 单一真源），但密码校验/比较逻辑由前端 `engine/puzzle/` 实现——**前端不持硬编码答案**。
3. **一人一目录，目录即锁**：见 `AGENT_OWNERSHIP.md`。
4. **纯前端、零后端**：所有"上传 PDF 解读""搜索""登录后台"均为前端伪造，数据全部 JSON 化。

### 0.1 关键 schema 设计点

- **`answer` 与 `matchStrategy` 分离**：答案字符串放在 `answer`，怎么比较（exact/oneOf/regex/phoneNumber/evidenceSet）放在 `matchStrategy`。前端 `engine/puzzle` 按 `matchStrategy.kind` 派发校验逻辑。
- **`onSuccess: PuzzleEffect[]` 副作用清单**：解谜后产生的所有副作用（加风险、推 SMS、推门铃、开倒计时、注册线索、收集证据、播音频、震屏、全屏告警、推进章节）都列在 `PuzzleEffect` 联合里，由前端的 PuzzleEffect 执行器逐条消费。失败副作用走 `onFailure`。
- **`PageAccessibility` 四类 discriminated union**：`public` / `hidden`（如 `/qiangzhang` URL 后缀入口）/ `loginRequired`（解谜登录后台）/ `linkedOnly`（仅从某页内部链接进入）。前端据此判断"玩家能否进入此页"。
- **`Clue.source` discriminated union**：枚举所有信息载体（wechat-thread / wechat-moment / wechat-article / qq-thread / qzone-post / web-page / sms / call / doorbell）。前端从 source 反向定位渲染入口。
- **关卡机制钩子（`registersClueId` / `triggersEvidenceId`）留空**：文案 agent 写消息/页面/朋友圈时这两个字段留空；level-designer phase3 用 JSON patch 只补这两个字段。**避免两类 agent 改同一行 JSON**（Workflow 校验"只改白名单字段"）。
- **消息拆文件 `ChatThread.messageFile`**：单会话消息量大，拆到 `messages/<threadId>.json`。`ChatThread` 只存元数据 + `messageFile` 指针。
- **`direction` 字段解决视角**：玩家以林哲视角操作；登录李桥瑞 QQ 后，闫欣泽发的消息是林哲视角的 `received`，李桥瑞视角的发出。`direction` 字段固定为玩家视角（林哲），避免渲染歧义。

---

## 1. ID 别名

所有 ID 为稳定的 string 别名。命名遵循 CLAUDE.md §4.2：

| 类型 | 别名 | 命名约定 |
|---|---|---|
| 人物 | `ContactId` | `char-liqiaorui` / `char-linzhe` / `char-zhangqiang` |
| 谜题 | `PuzzleId` | `puzzle-qq-login` / `puzzle-lvzhong-internal` / `puzzle-lab-backend` / `puzzle-xinxwang-backend` / `puzzle-pdf-screening` / `puzzle-evidence-finale` / `puzzle-upload-paper` |
| 证据 | `EvidenceId` | `ev-qq-chat-plan` / `ev-lvzhong-agreement` / `ev-xinxwang-lab-news` / `ev-paper-pdf` / `ev-lab-funding-report` / `ev-lab-upload-log` |
| 线索 | `ClueId` | `clue-<source-slug>` |
| 页面 | `PageId` | `page-<site>-<page>` |
| 章节 | `ChapterId` | `ch-prologue` / `ch-1` … `ch-5` / `ch-finale` |
| 会话 | `ThreadId` | — |
| 时间 | `ISODateString` | ISO 8601 字符串 |
| 评分 | `StarRating` | `0|1|2|3|4|5` |

> 稳定 ID 是跨 agent 引用的唯一手段（CLAUDE.md §3）。ID 一旦发布不得改名，只能弃用。

---

## 2. 人物 — `meta/characters.json`（微信 QQ 共用）

### `Character`
| 字段 | 类型 | 必填 | 说明 |
|---|---|:-:|---|
| `id` | `ContactId` | ✓ | 稳定 ID |
| `name` | `string` | ✓ | 真名 |
| `displayName?` | `string` | | 昵称/外号 |
| `role` | `"protagonist"\|"key-student"\|"staff"\|"external"\|"npc"` | ✓ | 角色定位 |
| `avatarAssetId` | `string` | ✓ | 头像资源 ID |
| `intro?` | `string` | | 简介 |
| `age?` | `number` | | 年龄 |
| `schoolClass?` | `string` | | 班级 |

**设计理由**：微信联系人与 QQ 联系人通过 `characterId` 反查同一人物——同一个人在两个平台的资料分别由 writer-wechat / writer-qq 维护，但本体人物由 level-designer 在 `meta/characters.json` 统一定义，避免人物设定分裂。

### `WechatContact`（`data/wechat/contacts.json`）
| 字段 | 类型 | 说明 |
|---|---|---|
| `characterId` | `ContactId` | 反查 Character |
| `wechatRemark?` | `string` | 林哲备注 |
| `wechatNickname` | `string` | 微信昵称 |
| `isOfficialAccount?` | `boolean` | 公众号标记 |
| `status?` | `"online"\|"offline"\|"lost"` | 失联标记 |
| `starValue?` | `StarRating` | 星标 |

### `QqContact`（`data/qq/contacts.json`）
| 字段 | 类型 | 说明 |
|---|---|---|
| `characterId` | `ContactId` | 反查 Character |
| `qqNumber` | `string` | QQ 号 |
| `qqNickname` | `string` | QQ 昵称 |
| `qqRemark?` | `string` | 备注 |
| `isGroup?` | `boolean` | 群聊标记 |
| `memberCount?` | `number` | 群人数 |
| `status?` | `"online"\|"offline"\|"lost"` | 失联标记 |

---

## 3. 聊天 — `data/wechat/threads.json` / `data/qq/threads.json` + `messages/<threadId>.json`

### `MessageDirection`
`"sent" | "received"`。玩家视角（林哲）。登录李桥瑞 QQ 后，闫欣泽发的消息 = 林哲收到 = `received`。

### `MessageKind`
`"text" | "image" | "voice" | "link" | "system" | "redpacket" | "file"`

### `ChatMessage`
| 字段 | 类型 | 必填 | 说明 |
|---|---|:-:|---|
| `id` | `string` | ✓ | 消息 ID（会话内唯一） |
| `threadId` | `ThreadId` | ✓ | 所属会话 |
| `direction` | `MessageDirection` | ✓ | 玩家视角方向 |
| `authorCharacterId?` | `ContactId` | | 发送者（system 消息可省） |
| `timestamp` | `ISODateString` | ✓ | 发送时间 |
| `kind` | `MessageKind` | ✓ | 消息类型 |
| `text?` | `string` | | 文本内容 |
| `assetIds?` | `string[]` | | 图片/文件资源 ID |
| `voiceDurationSec?` | `number` | | 语音时长 |
| `voiceTranscript?` | `string` | | 语音转文字（无障碍/解析） |
| `link?` | `{title?;url?;pageId?;assetId?}` | | 链接卡片（pageId 走站内伪造页，CLAUDE.md §6.4） |
| `recalled?` | `boolean` | | 撤回标记 |
| `registersClueId?` | `ClueId` | | **关卡钩子，phase3 回填** |
| `triggersEvidenceId?` | `EvidenceId` | | **关卡钩子，phase3 回填** |

### `ChatThread`
| 字段 | 类型 | 必填 | 说明 |
|---|---|:-:|---|
| `id` | `ThreadId` | ✓ | |
| `platform` | `"wechat"\|"qq"` | ✓ | |
| `type` | `"single"\|"group"` | ✓ | |
| `title` | `string` | ✓ | 会话标题 |
| `participantCharacterIds` | `ContactId[]` | ✓ | 参与者 |
| `lastMessageAt` | `ISODateString` | ✓ | 最后消息时间（列表排序） |
| `unreadCount?` | `number` | | 未读数 |
| `requiredPuzzleId?` | `PuzzleId` | | 解谜后解锁（如 QQ 登录解锁闫欣泽会话） |
| `messageFile` | `string` | ✓ | 指向 `messages/<threadId>.json` |

**设计理由**：消息拆文件。单会话可能上百条消息，放主 threads.json 会巨大且加载低效。`messageFile` 让前端按需 fetch 当前打开的会话。

---

## 4. 朋友圈 / QQ 空间 — `data/wechat/moments.json` / `data/qq/qzone.json`

### `MomentsComment`
| 字段 | 类型 | 说明 |
|---|---|---|
| `authorCharacterId` | `ContactId` | 评论者 |
| `text` | `string` | 评论内容 |
| `createdAt?` | `ISODateString` | 时间 |
| `deleted?` | `boolean` | 已删评论（保留痕迹供调查） |

### `MomentsPost`
| 字段 | 类型 | 必填 | 说明 |
|---|---|:-:|---|
| `id` | `string` | ✓ | |
| `authorCharacterId` | `ContactId` | ✓ | |
| `createdAt` | `ISODateString` | ✓ | |
| `text?` | `string` | | 配文（CLAUDE.md §6.3 统一"兄弟们，终末地见！"） |
| `assetIds?` | `string[]` | | 配图 |
| `link?` | `{title?;url?;pageId?}` | | 分享链接 |
| `likes?` | `ContactId[]` | | 点赞人 |
| `comments?` | `MomentsComment[]` | | 评论 |
| `starValue?` | `StarRating` | | |
| `registersClueId?` | `ClueId` | | **关卡钩子，phase3 回填** |
| `triggersEvidenceId?` | `EvidenceId` | | **关卡钩子，phase3 回填** |

---

## 5. 公众号文章 — `data/wechat/articles.json`

### `ArticleBlock`（内容块联合）
`paragraph` / `heading`(level 1-3) / `image`(assetId+caption) / `quote` / `list`(items+ordered) / `callout`(info|warning|danger)。

公众号文章与结局 epilogue 共用同一套块结构。

### `OfficialAccountArticle`
| 字段 | 类型 | 必填 | 说明 |
|---|---|:-:|---|
| `id` | `string` | ✓ | |
| `accountName` | `string` | ✓ | 公众号名 |
| `accountCategory?` | `"tool"\|"news"\|"school"\|"org"\|"game"\|"health"` | | |
| `title` | `string` | ✓ | |
| `publishedAt` | `ISODateString` | ✓ | |
| `coverAssetId?` | `string` | | 封面 |
| `bodyBlocks` | `ArticleBlock[]` | ✓ | 正文 |
| `url?` | `string` | | 外链（仅显示，伪造不跳转） |
| `registersClueId?` | `ClueId` | | 关卡钩子 |
| `triggersEvidenceId?` | `EvidenceId` | | 关卡钩子 |
| `isGeneratedContent?` | `boolean` | | **已废弃**：历史字段，当前数据无任何文章使用。不要再用它把 AI 解读塞进微信（CLAUDE.md §6.5） |
| `triggerUploadPuzzleId?` | `PuzzleId` | | **已废弃**（同上）；上传谜题由站点自行校验并 `reportPuzzleSolved` |

**设计理由（2026-08 修订）**：论文 AI 解读不再是"预设文章"。真实链路 = 公众号《上传PDF，秒懂论文》→ `site-ai-pdf` 首页**真实上传**论文 PDF → 站点用 `crypto.subtle.digest('SHA-256')` 与 `manifest.EXPECTED_PAPER_SHA256`（= `public/assets/paper-source-crystal.pdf` 的实算哈希）严格比对 → 通过后 `navigate('result')` + `reportPuzzleSolved('puzzle-upload-paper')` + `reportEvidenceCollected('ev-paper-pdf')`。解读**只存在于站点页 `page-ai-interpret`**。旧的"检测论文 PDF 已在 FilesApp 即触发预设解读文章"方案已废弃（FilesApp 已删除，页面 `onViewEffects` 字段亦已移除）。

---

## 6. 网页 — `data/browser/sites.json` + `pages/<pageId>.json`

### `PageAccessibility`（四类 union）
| kind | 字段 | 含义 |
|---|---|---|
| `public` | — | 任意时刻可访问 |
| `hidden` | `discoverFrom:PageId; hint:string` | 需从某页发现入口（如 `/qiangzhang` URL 后缀） |
| `loginRequired` | `puzzleId:PuzzleId` | 需解谜登录后台 |
| `linkedOnly` | `fromPageId:PageId` | 仅从某页内部链接进入 |

### `PageBlock`（页面块联合）
`hero` / `nav` / `articleList` / `paragraph` / `callout` / `image`(zoomable) / `table` / `form` / `sourceComment` / `loginForm`(puzzleId) / `pdfViewer`(assetId + requiresPuzzleId)。

**`sourceComment`**：在页面 HTML 里埋一段源码注释作为线索（如"为了便于维护，后台地址写在 /qiangzhang"）。前端把它渲染为隐藏的 `<!-- -->`，玩家查看源码才能看到。

**`loginForm` / `pdfViewer`**：loginForm 绑定 puzzleId（解谜=登录成功）；pdfViewer 可要求先解 PDF 密码谜题（requiresPuzzleId）才显示内容。

### `DiscoverableBy`（被发现方式）
- `urlSuffix`：URL 后缀入口（basePageId + suffix）
- `sourceCodeComment`：源码注释线索（onPageId + commentText）
- `search`：搜索关键词命中（queryKeyword）

### `WebPage`
| 字段 | 类型 | 必填 | 说明 |
|---|---|:-:|---|
| `id` | `PageId` | ✓ | |
| `siteId` | `string` | ✓ | 所属站点 |
| `url` | `string` | ✓ | 站内 URL（相对 site baseUrl） |
| `title` | `string` | ✓ | |
| `accessibility` | `PageAccessibility` | ✓ | 可达性 |
| `blocks` | `PageBlock[]` | ✓ | 页面内容 |
| `discoverableBy?` | `DiscoverableBy[]` | | 发现方式 |
| `registersClueId?` | `ClueId` | | 关卡钩子 |
| `triggersEvidenceId?` | `EvidenceId` | | 关卡钩子 |
| `containsAssetId?` | `string` | | 页面含某资源（PDF/截图） |
| `assetRequiresPuzzleId?` | `PuzzleId` | | 收集该资源需先解谜 |

### `Site` / `SearchIndexEntry`
- `Site`：`{id;name;baseUrl;pages:PageId[]}`
- `SearchIndexEntry`：`{keyword;pageIds:PageId[]}` —— 站内搜索伪造用。

---

## 7. 谜题（最关键）— `data/puzzle/puzzles.json`

### `PuzzleType`
`"password" | "pdfPassword" | "phoneNumber" | "evidenceSelection" | "uploadAndInterpret"`

### `AnswerMatchStrategy`（与 answer 分离）
| kind | 字段 | 校验逻辑（前端 engine/puzzle） |
|---|---|---|
| `exact` | `caseSensitive?;trim?` | 精确比较（默认 trim+忽略大小写） |
| `oneOf` | `accepted:string[]` | 玩家输入命中任一（QQ 密码 `20251128` 容错 `1128`，CLAUDE.md §6.1） |
| `regex` | `pattern:string` | 正则匹配 |
| `phoneNumber` | `normalizedDigits:number` | 归一化后取后 N 位比较（举报电话 `0731-88888888`） |
| `evidenceSet` | `requiredEvidenceIds:EvidenceId[];minLength:number` | 终章勾选证据数 ≥ minLength 且含全部 required（5 项关键证据） |

### `PuzzleEffect`（副作用清单联合）
`addRisk` / `removeRisk` / `startCountdown`(durationSec+id) / `advanceChapter`(toChapterId) / `pushSms`(smsEventId) / `pushDoorbell`(doorbellEventId) / `registerClue`(clueId) / `collectEvidence`(evidenceId) / `playAudio`(assetId) / `vibrate` / `fullscreenAlert`(text)。

**设计理由**：副作用清单化使前端 PuzzleEffect 执行器成为唯一副作用发起点，便于回放、撤销、测试。解实验室后台谜题触发 `startCountdown`+`pushSms`(威胁)+`pushDoorbell`(刀哥)+`vibrate` 一组效果。

### `Puzzle`
| 字段 | 类型 | 必填 | 说明 |
|---|---|:-:|---|
| `id` | `PuzzleId` | ✓ | |
| `type` | `PuzzleType` | ✓ | |
| `title` | `string` | ✓ | |
| `chapterId` | `ChapterId` | ✓ | 所属章节 |
| `answer` | `string \| string[]` | ✓ | 答案数据（evidenceSet 时可为空数组） |
| `matchStrategy` | `AnswerMatchStrategy` | ✓ | 校验策略 |
| `maxAttempts?` | `number` | | 最大尝试次数 |
| `attemptsToHint?` | `number` | | N 次错后触发提示 |
| `riskPerWrongAttempt?` | `number` | | 错一次加风险 |
| `lockoutAfterAttempts?` | `number` | | 锁定阈值 |
| `hintIds` | `ClueId[]` | ✓ | 关联提示 |
| `onSuccess` | `PuzzleEffect[]` | ✓ | 成功副作用 |
| `onFailure?` | `PuzzleEffect[]` | | 失败副作用 |
| `unlocksThreadIds?` | `ThreadId[]` | | 解锁会话 |
| `unlocksPageIds?` | `PageId[]` | | 解锁页面 |
| `unlocksAssetIds?` | `string[]` | | 解锁资源 |
| `registersEvidenceIds?` | `EvidenceId[]` | | 注册证据 |

### 关键谜题答案清单（CLAUDE.md §6.1，已定）
| 谜题 | 答案 | 校验策略 | 触发后果 |
|---|---|---|---|
| QQ 登录 `puzzle-qq-login` | `20251128`（容错 `1128`） | oneOf | 解锁闫欣泽 QQ 对话 |
| 绿中内部系统 `puzzle-lvzhong-internal` | `yigeyi` | exact | 解锁合作协议/名单/通讯录 |
| 心理筛查 PDF `puzzle-pdf-screening` | `0312`（合同号 `XH2026-0312` 后4位） | exact | 解锁受试者名单 PDF |
| 新希望后台（红鲱鱼，可选）`puzzle-xinxwang-backend` | `88888888` | exact | 额外佐证，不进 key 证据 |
| 论文 AI 解读 `puzzle-upload-paper` | 上传论文 PDF 触发 | uploadAndInterpret | 产出解读文章 |
| 实验室后台 `puzzle-lab-backend` | `123456`（基金号 `2025YFC0123456` 后6位） | exact | 解锁受试者名单+经费报告 → 触发 3 分钟倒计时+威胁短信+刀哥门铃+心跳 |
| 终章证据勾选 `puzzle-evidence-finale` | ≥5 项关键证据 | evidenceSet（requiredEvidenceIds 5项, minLength 5） | 真/普通结局分支 |

---

## 8. 线索 — `data/clustering/clue-map.json`

### `ClueSource`（来源联合）
`wechat-thread`(messageId?) / `wechat-moment`(momentId) / `wechat-article`(articleId) / `qq-thread`(messageId?) / `qzone-post`(postId) / `web-page`(pageId) / `sms`(smsId) / `call`(callId) / `doorbell`(eventId)。

### `Clue`
| 字段 | 类型 | 必填 | 说明 |
|---|---|:-:|---|
| `id` | `ClueId` | ✓ | |
| `chapterId` | `ChapterId` | ✓ | |
| `title` | `string` | ✓ | |
| `summary` | `string` | ✓ | 线索本显示的摘要 |
| `source` | `ClueSource` | ✓ | 来源（前端反向定位渲染入口） |
| `relatedEvidenceIds` | `EvidenceId[]` | ✓ | 关联证据 |
| `isRedHerring` | `boolean` | ✓ | 红鲱鱼标记 |
| `redHerringNote?` | `string` | | 红鲱鱼说明（评审用） |
| `autoRegisterOnView` | `boolean` | ✓ | 查看即自动注册到线索本 |

**红鲱鱼隔离（CLAUDE.md §6 / phase5 验证）**：`isRedHerring:true` 的 clue 不得出现在任何 `requiredEvidenceIds`。

---

## 9. 证据 — `data/meta/evidence-registry.json`

### `Evidence`
| 字段 | 类型 | 必填 | 说明 |
|---|---|:-:|---|
| `id` | `EvidenceId` | ✓ | |
| `title` | `string` | ✓ | |
| `description` | `string` | ✓ | 证据库描述 |
| `chapterId` | `ChapterId` | ✓ | |
| `source` | `ClueSource` | ✓ | 来源 |
| `isKey` | `boolean` | ✓ | 5 项关键证据标记 |
| `collectingCondition` | `"onView"\|"onPuzzleSolve"\|"onScreenshot"` | ✓ | 收集触发条件 |
| `screenshotAssetId?` | `string` | | 截图资源（onScreenshot） |
| `triggerClueId?` | `ClueId` | | 触发线索 |
| `triggerPuzzleId?` | `PuzzleId` | | 触发谜题 |
| `triggerPageId?` | `PageId` | | 触发页面 |

### 五项关键证据（CLAUDE.md §7，必含）
1. `ev-qq-chat-plan` — 李桥瑞与闫欣泽 QQ 聊天记录
2. `ev-lvzhong-agreement` — 绿中内部系统合作协议
3. `ev-xinxwang-lab-news` — 新希望成长中心与实验室合作新闻
4. `ev-paper-pdf` — 论文 PDF 或公众号解读
5. `ev-lab-funding-report` — 实验室后台经费申请报告
6. （附加）`ev-lab-upload-log` — 系统日志（张强上传名单，第6项补强）

> 至少 5 项勾选才进真结局；不足或漏掉经费报告 → 普通结局。

---

## 10. 结局 — `data/meta/endings.json`

### `EndingId`
`"good" | "normal" | "bad"`

### `EndingTrigger`
`evidenceSufficient`(puzzleId) / `evidenceInsufficient`(puzzleId) / `countdownExpired`(countdownId) / `riskMaxed` / `manual`(chapterId)。

### `Ending`
| 字段 | 类型 | 必填 | 说明 |
|---|---|:-:|---|
| `id` | `EndingId` | ✓ | |
| `title` | `string` | ✓ | |
| `trigger` | `EndingTrigger` | ✓ | 触发条件 |
| `epilogueBlocks` | `ArticleBlock[]` | ✓ | 结局旁白（复用 ArticleBlock） |
| `postEndingSms?` | `{from:ContactId;text:string}[]` | | 结局后短信 |
| `postEndingWechatMessage?` | `{threadId:ThreadId;messages:ChatMessage[]}` | | 结局后微信消息 |

**三结局（CLAUDE.md §6 + §9.4）**：
- 真结局（good）：证据充分（≥5 关键 + 经费报告）
- 普通结局（normal）：证据不足或漏经费报告
- 坏结局（bad）：倒计时超时 / 风险值满（==100）

---

## 11. 提示 — `data/meta/hints.json`

### `HintTrigger`
`idleOnPage`(pageId+seconds) / `wrongAttempts`(puzzleId+attempts) / `viewedClue`(clueId) / `chapterEntered`(chapterId) / `askedContact`(characterId+keyword?)。

### `Hint`
| 字段 | 类型 | 必填 | 说明 |
|---|---|:-:|---|
| `id` | `string` | ✓ | |
| `puzzleId?` | `PuzzleId` | | 关联谜题 |
| `trigger` | `HintTrigger` | ✓ | 触发条件 |
| `text` | `string` | ✓ | 提示文案 |
| `tier` | `1\|2\|3` | ✓ | 提示等级（1 弱→3 强） |
| `cooldownSec?` | `number` | | 冷却 |
| `onlyOnce?` | `boolean` | | 仅显示一次 |

**实验室后台 Hint tier1** 明确指向"基金号后 6 位"（CLAUDE.md §6.7）。

---

## 12. 章节 — `data/meta/chapters.json`

### `ChapterCondition`
`gameStart` / `puzzleSolved`(puzzleId) / `evidenceCollected`(evidenceId) / `clueRegistered`(clueId) / `and`(conditions[])。

### `ChapterObjective`
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 目标 ID |
| `description` | `string` | 目标描述 |
| `completionPuzzleId?` | `PuzzleId` | 完成谜题 |
| `completionEvidenceId?` | `EvidenceId` | 完成证据 |
| `completionClueId?` | `ClueId` | 完成线索 |
| `hidden?` | `boolean` | 隐藏目标 |

### `Chapter`
| 字段 | 类型 | 必填 | 说明 |
|---|---|:-:|---|
| `id` | `ChapterId` | ✓ | `ch-prologue`…`ch-finale` |
| `index` | `number` | ✓ | 顺序 |
| `title` | `string` | ✓ | |
| `enterCondition` | `ChapterCondition` | ✓ | 进入条件 |
| `introMonologueId?` | `string` | | 开场独白 |
| `onEnterEffects?` | `PuzzleEffect[]` | | 进入副作用 |
| `objectives` | `ChapterObjective[]` | ✓ | 目标列表 |

---

## 13. 游戏状态（运行态，非数据文件）

`GameState` 是 Zustand store + persist 持久化的运行态，**不在 `public/data/`**。仅由前端 engine 读写，localStorage 落盘。

| 字段 | 类型 | 说明 |
|---|---|---|
| `saveId` | `string` | 存档 ID |
| `createdAt`/`updatedAt` | `ISODateString` | 时间戳 |
| `version` | `string` | 存档版本（迁移用） |
| `currentChapterId` | `ChapterId` | 当前章节 |
| `completedObjectives` | `string[]` | 已完成目标 |
| `solvedPuzzleIds` | `PuzzleId[]` | 已解谜题 |
| `puzzleAttempts` | `Record<PuzzleId, number>` | 各谜题尝试次数 |
| `unlockedPageIds`/`unlockedThreadIds`/`unlockedAssetIds` | `…[]` | 解锁项 |
| `registeredClueIds` | `ClueId[]` | 已注册线索 |
| `collectedEvidenceIds` | `EvidenceId[]` | 已收集证据 |
| `risk` | `number` | 风险值 0-100（==100 坏结局，>70 红边+心跳） |
| `countdowns` | `Record<string,{startedAt;durationSec;expired}>` | 倒计时（startedAt 时间戳，刷新后按 now-startedAt 算真实剩余，CLAUDE.md §6.6） |
| `shownHintIds` | `string[]` | 已显示提示 |
| `lastHintAt?` | `ISODateString` | 上次提示时间 |
| `visitedPages`/`visitedThreads`/`viewedMessages`/`viewedMoments` | `…[]` | 访问记录（用于触发"查看即注册"线索） |
| `endingId?` | `EndingId` | 已达成结局 |
| `finished` | `boolean` | 游戏结束 |

**persist 注意（CLAUDE.md §2）**：必须用柯里化 `create<T>()(persist(fn, { name, storage: createJSONStorage(() => localStorage) }))`，否则类型推断丢失；`name` 必填作 key；用 `partialize` 只存 GameState。

---

## 14. AppManifest — 前端 AppRegistry 用

| 字段 | 类型 | 说明 |
|---|---|---|
| `appId` | `string` | App ID |
| `title` | `string` | 桌面图标下文字 |
| `icon` | `string` | 图标资源 |
| `route` | `string` | HashRouter 路由 |
| `Component` | `unknown` | 懒加载组件（phone-shell cast 回 `React.LazyExoticComponent<React.ComponentType<unknown>>`） |
| `availableFrom` | `ChapterId` | 该 App 从哪章起可用 |
| `hiddenUntilPuzzleId?` | `PuzzleId` | 解谜前隐藏 |

**设计理由**：`Component` 设为 `unknown` 让本类型文件与 React 解耦，`src/types/index.ts` 不依赖 `@types/react`；phone-shell 在 AppRegistry 处用 `import.meta.glob('./apps/*/manifest.ts')` 聚合并 `React.lazy` 包裹后 cast。

---

## 附：数据文件布局（CLAUDE.md §3 + §4.1）

```
public/data/
├── meta/              (level-designer)
│   ├── characters.json
│   ├── evidence-registry.json
│   ├── chapters.json
│   ├── endings.json
│   ├── risk-events.json
│   └── hints.json
├── puzzle/            (level-designer)
│   └── puzzles.json
├── clustering/        (level-designer)
│   └── clue-map.json
├── wechat/            (writer-wechat)
│   ├── contacts.json
│   ├── threads.json
│   ├── moments.json
│   ├── articles.json
│   └── messages/<threadId>.json
├── qq/                (writer-qq)
│   ├── contacts.json
│   ├── threads.json
│   ├── qzone.json
│   └── messages/<threadId>.json
├── browser/           (writer-browser)
│   ├── sites.json
│   ├── pages/<pageId>.json
│   └── search-index.json
├── phone/             (writer-phone-story)
│   ├── sms.json
│   ├── calls.json
│   └── doorbells.json
└── story/             (writer-phone-story)
    ├── monologues.json
    └── ...
```

> 实际路径 = `public/data/**`（Vite 静态服务，前端 `fetch(import.meta.env.BASE_URL + 'data/...')`，`import.meta.env.BASE_URL` 必须原样出现）。
