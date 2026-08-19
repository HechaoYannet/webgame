# 《张强宿舍大逃杀》Phase5 对抗式验证审查报告

> 本报告由 reviewer 主笔，基于 7 个维度的 blind-review 结果与对抗复核（adversarial re-review）综合定稿。
> 审查范围：`public/data/**`、`src/engine/**`、`src/apps/**`，对照 `.claude/CLAUDE.md` §4/§4.2/§5/§6/§7/§9 各条款。
> 审查方式：默认怀疑、默认找缺陷；引用证据必给文件路径+行号/JSON 路径。对抗复核对所有 ≥medium finding 逐条复核并给出 confirmed/dismiss 结论。

---

## 一、整体结论

**整体判定：FAIL — 不可发布。**

7 个维度中：PASS 3 个（clue-closure / red-herring / password-consistency），PARTIAL 2 个（chapter-reachability / build-types-ids），FAIL 2 个（endings / risk-balance）。

虽然「数据即契约」层的核心闭环（线索注册、红鲱鱼隔离、密码一致性、谜题答案）整体成立，但**两处 §6/§9 强制维度的 FAIL**直接破坏玩家可见的真结局交付与正常通关路径：

1. **endings 维度（§9.4 三结局分别触发）**：good 分支 `openNewsApp('good')` 跳转 `/app/news`，但 AppRegistry 中无 news App，玩家拨通举报电话后被弹回桌面，真结局破案播报永不渲染；endings.json 的 `epilogueBlocks`/`postEndingWechatMessage` 在前端零消费，normal 结局完全无可视化。真/普通结局的「玩家可见闭环」断裂。
2. **risk-balance 维度（§6.8 风险值阈值）**：谜题错答风险双计（`riskPerWrongAttempt` + `onFailure.addRisk` 叠加），puzzle-lab-backend 单次错答 +20（预期 +10），正常试错即误触 bad 结局；risk-events.json 中 `askedContact`/`visitSensitivePage` 两类叙事风险事件为死数据，引擎无消费方，「反复追问张强/访问敏感页面」的作死路径完全不生效。

合计 **4 项 high 级缺陷**，必须回 Phase1/Phase4 修复后重测方可发布。

### 缺陷统计

| 严重度 | 数量 |
|---|---|
| high | 4 |
| medium | 4 |
| low | 13 |
| **合计** | **21** |

### 7 维度 verdict 汇总

| 维度 | verdict | high | medium | low |
|---|---|---|---|---|
| clue-closure | PASS | 0 | 0 | 3 |
| red-herring | PASS | 0 | 0 | 1 |
| password-consistency | PASS | 0 | 0 | 1 |
| chapter-reachability | PARTIAL | 0 | 1 | 3 |
| endings | **FAIL** | 2 | 2 | 1 |
| risk-balance | **FAIL** | 2 | 0 | 2 |
| build-types-ids | PARTIAL | 0 | 1 | 1 |

> 注：risk-balance 的「risk-event id 与 sms pushTriggerRiskEventId 不一致」原 medium，对抗复核降为 low（详见该 finding 的对抗复核结果）。

---

## 二、缺陷清单（按严重度排序）

### HIGH 级缺陷（4 项，必须修复方可发布）

---

#### H1. good 分支 `openNewsApp('good')` 跳转 `/app/news`，但无 news App 注册，真结局播报永不渲染

- **维度**：endings
- **severity**：high
- **对抗复核**：CONFIRMED（severityAdjustment: same，维持 high）

**证据**
- `public/data/phone/call-scripts.json:183-187` good 分支 endEffects 三条 `[{advanceChapter ch-finale},{openNewsApp endingId=good},{pushEnding endingId=good}]`，先 openNewsApp 再 pushEnding。
- `src/engine/feedback/AppNavigationService.ts:48-63` openNewsApp 设 `_currentApp='news'`、写 `sessionStorage('webgame-news-ending')`，第 59 行 `_navigate('/app/news')`。
- `src/apps/PhoneShell/AppRegistry.ts:36-95` 用 `import.meta.glob('../*/manifest.ts')` 聚合，实测 manifest 列表 `album/browser/doorbell/files/notes/phone/qq/sms/wechat`，无 `news`（独立复核：`ls src/apps/` 仅 9 目录，grep 'news' 于所有 manifest 零命中）。
- `src/apps/PhoneShell/AppRouter.tsx:90-96` 仅对 `apps.map(a=>a.appId)` 生成路由，`news` 不在表 → 走第 96 行通配 `{path:'*', Component:()=>(<Navigate to='/' replace/>)}`；即便强行经 `makeAppRouteComponent('news')`（AppRouter.tsx:75-77 `appById.get('news')` 为 undefined）也返回 `<Navigate to='/' replace/>`。两路径均弹回桌面。
- `getNewsEndingId`（AppNavigationService.ts:69-75）全工程仅 1 命中（自身定义），无任何调用方。
- `epilogueBlocks` 在 src 下仅 `types/index.ts:366` + `loader.ts:296` + 注释，无任何 .tsx 组件读取。

**失败场景**
玩家凑齐 5 证据并在 180s 内拨 `0731-88888888` → 通话走 good 分支 → `executeEffects` 调 `openNewsApp('good')` → 路由 `/app/news` → appId 未注册 → 渲染 `<Navigate to='//' replace/>` → 弹回桌面；`endings.json good.epilogueBlocks`（「湖南警方破获非法人体实验案」）与 `postEndingWechatMessage`（李桥瑞「兄弟，谢谢你」）永不展示。`pushEnding('good')` 仍翻转状态，但 §9.4「真结局分别触发」的玩家可见闭环断裂。

**修复指向**
- 回 **Phase4 frontend-phone-apps**（或 frontend-phone-shell）：新增 `src/apps/NewsApp/{manifest.ts,NewsApp.tsx}`（`appId='news'`，`availableFrom='ch-finale'` 或 `hiddenUntilPuzzleId='puzzle-evidence-finale'`），NewsApp 内读 `getNewsEndingId()` → `getEndingById(endingId).epilogueBlocks` 渲染破案播报。
- 在 Phase4-验收（task 62/72）补 `tsc --noEmit` 与桌面手动验证：确认 `/app/news` 在真结局触发后可达且渲染 ending 正文。
- 若不想新增 App：改 good 分支 endEffects 用 `openApp` + 全局 EndingOverlay 取代 `openNewsApp` 路由跳转（见 H2 的统一方案）。

---

#### H2. endings.json 的 `epilogueBlocks`/`postEndingWechatMessage` 在前端零消费，normal 结局完全无可视化

- **维度**：endings
- **severity**：high
- **对抗复核**：CONFIRMED（severityAdjustment: same，维持 high）。对抗复核额外发现：normal 结局的 epilogueBlocks（endings.json:48-78）同样无组件渲染，且 normal 分支无 `openNewsApp` 调用（call-scripts.json:221-224 仅 `advanceChapter + pushEnding`），普通结局旁白同样不可见。即三结局中 normal 完全无交付、good 旁白与结局后微信消息均未交付，仅 bad 有降级黑屏——范围比 finding 标题更广。

**证据**
- `src/data/loader.ts:294-302` 定义 endingSchema 含 `epilogueBlocks`(296)/`postEndingSms`(297)/`postEndingWechatMessage`(298-301)；`loader.ts:944-949` 提供 `getEndingById`/`getAllEndings` 公共访问器。
- 全仓 grep `epilogueBlocks|getEndingById|getAllEndings|postEndingWechatMessage|getNewsEndingId|\.epilogue`：命中仅 `loader.ts` 自身、`types/index.ts:366-368`、`AppNavigationService.ts` 注释与 getNewsEndingId 实现。**没有任何 .tsx 组件读取这些字段**。
- `src/utils/shellState.ts:309-317` `useChapter()` 仅 `return {currentChapterId, endingId, finished}` 原值，无渲染逻辑。
- `public/data/phone/call-scripts.json:221-224` normal 分支 endEffects 仅 `[advanceChapter ch-finale, pushEnding normal]`，无 `openNewsApp`（对照 good 分支 line 183-187 含 `openNewsApp good`）。
- good 结局 `postEndingWechatMessage`（`thread-li-lin-wechat` 的 `msg-good-ending-li-thanks`，endings.json:33-46）未注入：`public/data/wechat/messages/thread-li-lin-wechat.json` 12 条消息无该 id；grep 全 src 无 `postEndingWechatMessage` 消费代码；WechatApp 仅 `loadThreadMessages` 读取静态 `messageFile`（ChatTab.tsx:228/250, data.ts:249）。
- 唯一结局渲染组件是 `src/apps/DoorbellApp/DoorbellApp.tsx:92,188` BadEndingScreen，仅服务 bad，不含 good/normal，且只渲染 daoEvent.onTimeoutText，未读 endings.json bad.epilogueBlocks。

**失败场景**
玩家勾选不足 5 证据或漏关键项 → normal 分支执行 `pushEnding('normal')` → 状态结束但屏幕无任何 normal 旁白（「证据不足，调查中断」等 epilogueBlocks）展示，玩家只看到通话字幕结束后挂断；good 结局的 postEndingWechatMessage（李桥瑞答谢微信）也未注入微信会话。违反 §9.4 三结局分别触发（normal 无交付）。

**修复指向**
- 回 **Phase4 frontend-phone-apps/frontend-phone-shell**：新增全局 EndingOverlay/EndingView 组件（订阅 `useGameStore.endingId/finished`），`finished=true` 时 `getEndingById(endingId).epilogueBlocks` 渲染对应结局旁白；按 `postEndingWechatMessage` 把结局后微信消息追加到对应 thread（订阅 `endingPushed` 事件 → 追加到 thread 内存态）。
- 或在 AppRouter 路由级对 `finished` 为真时强制跳到 EndingView。
- 该修复与 H1 可合并为单一方案：全局 EndingOverlay 替代 `openNewsApp` 路由跳转，统一渲染三结局的 epilogueBlocks。

---

#### H3. 谜题错答风险双计：`riskPerWrongAttempt` 与 `onFailure.addRisk` 叠加，puzzle-lab-backend 单次错答 +20（预期 +10）

- **维度**：risk-balance
- **severity**：high
- **对抗复核**：CONFIRMED（severityAdjustment: same，维持 high）。对抗复核修正两处轻微不准确（不改变结论）：①finding 引用路径写 `src/engine/effect/EffectExecutor.ts`，实际为 `src/engine/puzzle/EffectExecutor.ts`（行号 L97-98 正确）；②finding 称「puzzle-qq-login/lvzhong/pdf/xinxwang 同样并存」中，`puzzle-pdf-screening`（puzzles.json L51-67）有 `onFailure.addRisk:3`(L65) 但无 `riskPerWrongAttempt` 字段，故 pdf 不发生双计（单次 +3）；真正双计的是 qq-login/lvzhong-internal/xinxwang-backend/lab-backend 四个。

**证据**（独立复核通过）
- `src/engine/puzzle/PuzzleService.ts` 失败分支（L138-141 附近）：`if (puzzle.riskPerWrongAttempt && >0) { store.addRisk(puzzle.riskPerWrongAttempt); riskDelta=... }` 直接调 store action；紧随其后 `executeEffects(puzzle.onFailure)`。
- `src/engine/puzzle/EffectExecutor.ts:97-98` `case 'addRisk': h.addRisk(e.amount)` → `src/engine/index.ts:35-36` `handlers.addRisk = (amount) => RiskService.addRisk(amount)` → `RiskService.ts:36-43` 内部 `store.addRisk(amount)` 再 `checkRiskConsequences`。即 onFailure.addRisk 最终也落到 `store.addRisk`，与 PuzzleService 直调是两次独立累加。
- `src/engine/store/gameStore.ts:198-205` addRisk 仅 `Math.max(0, Min(100, s.risk + n))`，不幂等、无「已加过」守卫。
- `RiskService.ts:65-74` `after >= thresholds.badEndingAt(=100)` → `pushEnding('bad')` 不可回退。
- `puzzles.json` puzzle-lab-backend 同时含 `riskPerWrongAttempt:10`(L115) 与 `onFailure:[{type:'addRisk',amount:10}]`(L122-124)，单次错答 = 10+10 = 20。
- `risk-events.json normalPlaythroughRiskEstimate`(L102-117) 明确按单计设计：L113「正常路径约 10-50」、L115 `maxPlausibleNormalPlaythrough:50`。双计后 3 次错=60 逼红边、5 次错=100 直接触发 bad，与设计文档自述矛盾，正常玩家被误伤。

**失败场景**
正常玩家在实验室后台谜题输错 6 次寻线索：每次 +20（PuzzleService 加 10 + onFailure 加 10），6 次累计 120 → gameStore.addRisk 钳到 100 → RiskService.checkRiskConsequences 判定 >=badEndingAt → pushEnding('bad')。即便 3 次错也达 60 已逼近红边，5 次达 100 直接 bad。CLAUDE.md §6.8（L156）「评审校验正常通关路径 risk 不会无端到 100」与 §9.4「坏结局...风险值满」证实设计意图为单计，当前实现违约。

**修复指向**
- 回 **Phase4 frontend-engine** 修 `src/engine/puzzle/PuzzleService.ts`：失败分支二选一——要么删除 L138-141 的 `riskPerWrongAttempt` 加风险（保留 onFailure.addRisk 为唯一来源），要么从 puzzles.json 移除各谜题 onFailure 内的 addRisk（保留 riskPerWrongAttempt）。
- **建议保留 `riskPerWrongAttempt` 为单一来源、删 onFailure.addRisk**，更符合 §4.2「怎么验在代码」原则。
- 同步回 **Phase1 level-designer** 核对 puzzles.json 注释与 risk-events.json `normalPlaythroughRiskEstimate` 是否仍成立（单计后的估算）。

---

#### H4. risk-events.json 的 `askedContact`/`visitSensitivePage` 事件为死数据，引擎无消费方，对应风险值永不触发

- **维度**：risk-balance
- **severity**：high
- **对抗复核**：CONFIRMED（severityAdjustment: same，维持 high）。对抗复核额外确认 `risk-events.json:3 $description` 明言「前端 RiskService 按本清单消费」，但 RiskService 仅消费 thresholds；normalPlaythroughRiskEstimate 把「访问敏感页面(经费报告):+10」(L112) 计入正常路径风险估算，实际为 +0，使 §6.8/§9.4「风险值满」坏结局驱动的评审基准失真。

**证据**
- `src/engine/risk/RiskService.ts:17` import getRiskEvents，但仅 `getThresholds()`(L26-33) 读取 thresholds；events 数组（risk-events.json L9-101）无任何 src/ 代码遍历匹配分发。grep 全 src 仅 loader.ts 加载、types 定义、RiskService 读阈值；无 RiskEventDispatcher。
- `askedContact(+20)` 永不触发：grep `addRisk|setRisk|真相|askedContact|risk-press|second-threat|pushTriggerRiskEventId` 在 `src/apps/WechatApp/` 零命中。向张强追问「真相」无任何风险钩子。`risk-events.json:71-80 risk-press-zhangqiang`(amount 20) 为死事件。
- `visitSensitivePage(+10)` 永不触发：`page-lab-funding-report.json:80-85 onViewEffects` 仅 `startCountdown/pushSms/pushDoorbell/playAudio`，无 addRisk。`ChapterDirector.ts:131-141 visitPage` 仅 emit pageFirstVisited → `triggerOnViewEffects`(113-121) 只执行 onViewEffects；无任何代码匹配 risk-events.json:61-68。访问经费报告实际 +0。
- `pushTriggerRiskEventId` 字段无消费方：仅出现在 `types/index.ts:466`、`loader.ts:364`、`PhoneApp/data.ts:106` 三处定义；`SmsService.ts:21-35 pushSms` 仅按 smsEventId 投递，从不读 pushTriggerRiskEventId。

**失败场景**
按 §6.8/§9.4，「多次错密码/反复追问张强/访问多个敏感页」应驱动坏结局。实际：玩家向张强追问「真相」（askedContact char-zhangqiang）应 +20，访问经费报告页（visitSensitivePage page-lab-funding-report）应 +10，但因无分发逻辑均 +0。坏结局实际只能由倒计时超时或谜题错答双计触发，「故意作死才到 100」的设计意图落空——追问张强等作死行为反而不加分，违背 §6.8「正常通关路径 risk 不会无端到 100」与 `normalPlaythroughRiskEstimate.badEndingReachesVia`(L116 明列「反复追问张强+访问全部敏感页面」)。

**修复指向**
- 回 **Phase4 frontend-engine** 新增风险事件分发：在 RiskService 或新 RiskEventDispatcher 中实现按 trigger.kind（puzzleWrongAttempt/visitSensitivePage/askedContact/countdownTick/puzzleSolved）+ 条件字段匹配 events，并接入 `ChapterDirector.visitPage`（visitSensitivePage）与 askedContact 触发点（微信/短信向张强提问时）。
- **或**若决定不实现这两类事件，回 **Phase1 level-designer** 重写 risk-events.json 删除 askedContact/visitSensitivePage 并在说明中阐明，避免文档与实现漂移。
- 两者二选一，不可既不实现也不删——否则 §4 数据即契约的文档可信度持续受损。

---

### MEDIUM 级缺陷（4 项）

---

#### M1. bad 结局渲染只在 DoorbellApp 内，缺全局结局覆盖层，倒计时归零时玩家在其它 App 看不到坏结局表现

- **维度**：endings
- **severity**：medium
- **对抗复核**：CONFIRMED（severityAdjustment: same，维持 medium）

**证据**
- `src/apps/DoorbellApp/DoorbellApp.tsx:91` `if (endingId==='bad' || (finished && countdownExpired)) return <BadEndingScreen/>`，BadEndingScreen 在 :188 定义为 DoorbellApp 私有组件，仅渲染 daoEvent.onTimeoutText，未读 endings.json bad.epilogueBlocks。
- `src/apps/PhoneShell/PhoneShell.tsx:18-112` 仅用 `useRisk/useShaking/useRedEdgeIntensity`，渲染 StatusBar+NotificationBar+{children}+红边 overlay，无 endingId/finished 分支，无 EndingOverlay。
- `src/apps/PhoneShell/AppRouter.tsx:48-70` RootLayout 仅 `<PhoneShell><Suspense><Outlet/></Suspense></PhoneShell>`，PhoneShell 与各 App 之间未插入任何全局结局组件。
- `src/apps/PhoneShell/Desktop.tsx:1-154` 仅渲染图标网格与 dock，无 endingId 引用（在桌面归零同样看不到坏结局）。
- `src/utils/shellState.ts:307-317` useChapter() 只把 endingId/finished 作为快照值返回，不渲染。
- 失败链路：`CountdownService.ts:35-48 expireCountdown` → `pushEnding('bad')`；`:85-93 tick` → `expireCountdown`；`useCountdown.ts:16-30` 以 250ms 间隔驱动。tick 经 DoorbellApp.tsx:76 / BrowserApp.tsx:55 / StatusBar.tsx:70 的 CountdownBadge 全局挂载触发，store.finished=true 落盘正确。但 `PhoneApp.tsx:122-130` phase==='calling' 直接 return <CallView/>，CallView(:234-425) 全文无 endingId/finished 判定，归零时 PhoneApp UI 不变。
- 旁证：`RiskService.ts:70-73` risk==100 时同样 `pushEnding('bad')`，这是 DoorbellApp 之外触发的坏结局源，同样无全局遮罩。

**失败场景**
玩家在 PhoneApp 拨号途中倒计时归零 → pushEnding('bad') 落盘，finished=true，但当前渲染的是 PhoneApp.CallView，屏幕不会黑屏也不显示「林哲也消失了」；玩家须手动切到 DoorbellApp 才看到 BadEndingScreen。bad 触发态正确（§9.4 的 state 翻转 OK），但 UI 表现不可靠。

**修复指向**
- 回 **Phase4 frontend-phone-shell**：在 PhoneShell 顶层（PhoneShell.tsx children 外层）加全局 EndingOverlay，订阅 `endingId/finished`，bad 时全屏黑屏 + onTimeoutText/epilogueBlocks，确保任何 App 中归零/风险满都立即遮罩。
- 该修复与 H1/H2 的全局结局方案可统一：单一 EndingOverlay 覆盖三结局，bad 用遮罩、good/normal 用 ending view。

---

#### M2. ch-2 / ch-4 enterCondition 缺少前置章节谜题守卫，可被越序进入并跳过 ch-1 / ch-3

- **维度**：chapter-reachability
- **severity**：medium（对抗复核维持 same）

**证据**（独立复核通过）
- `public/data/meta/chapters.json:46-51` ch-2 enterCondition = `and:[clueRegistered:clue-lvzhong-hidden-url]`，无 puzzleSolved 守卫；`:96-101` ch-4 = `and:[evidenceCollected:ev-xinxwang-lab-news]`，无前置谜题守卫。对照 ch-1(:26 puzzleSolved:puzzle-qq-login)、ch-3(:76 puzzleSolved:puzzle-lvzhong-internal)、ch-5(:121 puzzleSolved:puzzle-upload-paper)、ch-finale(:142 puzzleSolved:puzzle-lab-backend) 均有谜题守卫，唯独 ch-2/ch-4 没有。
- `src/engine/chapter/ChapterDirector.ts:50-56` reevaluateChapters 遍历 index>currentIndex 的章节，进入第一个 evaluateCondition 为真者，跳过条件为假者（缺少串行化约束）。
- `src/apps/BrowserApp/manifest.ts:17` availableFrom:"ch-prologue" 且无 hiddenUntilPuzzleId；`AppRegistry.useVisibleApps` 仅做 chapterOrder>=availableFrom 粗过滤，浏览器在序章一开始就可用。
- 公开页可达链路：`search-index.json:1-7`「绿草中学」→`page-lvzhong-home`(public)→`page-lvzhong-notice`(public, :74 registersClueId:"clue-lvzhong-hidden-url")；`search-index.json:76-82`「新希望成长中心」→`page-xinxwang-home`(public)→`page-xinxwang-cooperation`(public, :61-62 registersClueId:"clue-xinxwang-lab-coop" + triggersEvidenceId:"ev-xinxwang-lab-news")。
- 查看即取证链路通：`ClueRegistry.ts:53-86 onView` 注册线索 + :63 emit clueRegistered + :69-82 collectRelatedEvidence + :75 emit evidenceCollected；`ChapterDirector.ts:33-35` 监听 clueRegistered/evidenceCollected → reevaluateChapters。
- `gameStore.ts:284-286 advanceChapter` 无 index/前向守卫，可设任意 chapterId。
- 结局降级后果：`puzzles.json:16` puzzle-qq-login.onSuccess 才 `collectEvidence ev-qq-chat-plan`；`:144-150` puzzle-evidence-finale.requiredEvidenceIds 含 ev-qq-chat-plan。ch-1 被跳过 → puzzle-qq-login 未解 → ev-qq-chat-plan 永不收集 → 终章 evidenceSet 校验失败 → 真结局不可达。

**失败场景**
玩家在 ch-prologue(index 0) 打开浏览器 → 百度搜「绿草中学」→ page-lvzhong-home → 点「通知公告」→ page-lvzhong-notice → ClueRegistry 注册 clue-lvzhong-hidden-url → emit clueRegistered → reevaluateChapters。当前 currentIndex=0：ch-1(index1, puzzleSolved:puzzle-qq-login)=false 跳过；ch-2(index2, clueRegistered:clue-lvzhong-hidden-url)=true → 直接 enterChapter(ch-2)。结果 ch-1 被跳过，mono-ch1 不播，puzzle-qq-login 未解，ev-qq-chat-plan 未收集，终章 puzzle-evidence-finale 的 requiredEvidenceIds 缺该证据 → 真结局路径降级（玩家须事后回溯解 QQ 登录恢复，store.advanceChapter 无 index 守卫会把 currentChapterId 倒回 ch-1，形成 ping-pong）。同理 ch-4 可在 ch-2/ch-3 未完成时被提前进入。

**修复指向**
- 回 **Phase1 level-designer** 修 `public/data/meta/chapters.json`：ch-2 enterCondition 改为 `and:[puzzleSolved:puzzle-qq-login, clueRegistered:clue-lvzhong-hidden-url]`；ch-4 改为 `and:[puzzleSolved:puzzle-lvzhong-internal, evidenceCollected:ev-xinxwang-lab-news]`。
- **或**回 **Phase4 frontend-engine** 修 `ChapterDirector.reevaluateChapters`：增加不得越过条件为假的中间章节的串行化约束（ch.index>currentIndex 但存在某中间章节 k 满足 currentIndex<k<ch.index 且 evaluateCondition(k) 为假时，不进入 ch）。
- 两法互补，建议两处都做（数据层守卫 + 引擎层串行化约束双保险）。

---

#### M3. `executeEffects` 未按注释守卫 finished，存在 pushEnding 后副作用继续执行的隐患

- **维度**：endings
- **severity**：medium
- **对抗复核**：CONFIRMED（severityAdjustment: same，维持 medium）

**证据**
- `src/engine/puzzle/EffectExecutor.ts:74-77` docstring 明写「仅在游戏未 finished 时执行（除 pushEnding 本身）；finished 后其余 effect 被忽略」——对外承诺了一个 finished 守卫。
- `EffectExecutor.ts:78-93` 的 executeEffects 循环（for (const e of effects)）对每条 effect 无条件 dispatch，无任何 `if(getGameStore().finished) break` 或非 pushEnding 类型守卫；dispatch（行 95-148）是纯 switch，亦无 finished 检查。注释与实现矛盾——真实的文档/契约缺陷。
- 当前 happy 路径靠顺序侥幸安全：good 分支 endEffects（call-scripts.json:183-187）= [advanceChapter, openNewsApp, pushEnding]，normal 分支（221-224）= [advanceChapter, pushEnding]，pushEnding 均在末尾，故无 pushEnding 之后写入。
- store 层声称的「所有 action no-op」安全网（gameStore.ts:16）只部分实现：只有 `pushEnding` 本体守卫 finished（gameStore.ts:288-296，行290 `if(get().finished) return`），而 `collectEvidence`(:181-189)、`addRisk`(:198-204)、`advanceChapter`(:284-286)、`solvePuzzle`/`registerClue`/`attemptPuzzle` 均不检查 finished。
- 更窄的链式隐患真实存在：`RiskService.checkRiskConsequences`(RiskService.ts:65-78) 在 `after>=badEndingAt` 时调 `store.pushEnding('bad')`（已 finished 则 no-op）但仍无条件 `emit('endingPushed',{endingId:'bad'})`，可能在 store 实为 good/normal 终态时抛出 bad-ending 事件。

**失败场景**
若未来 normal/good 分支 endEffects 调整把 addRisk/collectEvidence 排到 pushEnding 之后（如增加结局后追证据），会在 finished=true 状态下继续改 store（addRisk 可能再次触发 RiskService 链式 pushEnding，或 collectEvidence 在终态后写入），导致状态不一致或重复 pushEnding 事件。当前 happy 路径因顺序侥幸安全，但引擎契约与实现不符。

**修复指向**
- 回 **Phase4 frontend-engine** `src/engine/puzzle/EffectExecutor.ts`：在 executeEffects 循环内对非 pushEnding 类型增加 `if (getGameStore().finished) break` 守卫，使注释与实现一致；或修正注释移除承诺。
- 两者二选一即可，推荐前者以兑现契约承诺。

---

#### M4. 悬空 riskEvent 引用：sms-zhangqiang-second-threat.pushTriggerRiskEventId 指向不存在的 risk-press-zhangqiang-for-truth

- **维度**：build-types-ids（同一根因缺陷也被 risk-balance 维度捕获，见 L1）
- **severity**：medium（build-types-ids 维度对抗复核维持 same）
- **对抗复核**：CONFIRMED（build-types-ids 维度 severityAdjustment: same，维持 medium；同源 defect 在 risk-balance 维度被降为 low，见 L1）

**证据**（独立复核通过）
- `public/data/phone/sms.json:23` 该事件 pushTriggerRiskEventId="risk-press-zhangqiang-for-truth"。
- `public/data/meta/risk-events.json:71` 该风险事件 id="risk-press-zhangqiang"（无 -for-truth 后缀）。
- grep 整个仓库 `risk-press-zhangqiang-for-truth` 仅作为引用出现在 sms.json 及 dist 副本，从未作为 risk-event id 定义存在 → 悬空引用坐实。
- `src/types/index.ts:466 pushTriggerRiskEventId?: string` 与 `src/data/loader.ts:364 z.string().optional()` 均为纯字符串、无对 risk-events.json 的外键校验，故 Zod/tsc 均不拦截，§9 验证标准 2 不能捕获此缺陷。
- src/ 内 pushTriggerRiskEventId 仅 3 处声明（loader.ts:364, PhoneApp/data.ts:106, types/index.ts:466），无任何读取点；通读 `src/engine/feedback/SmsService.ts` 全文确认仅 `getSmsEventById/pushSms/toast/emit`，从不读 pushTriggerRiskEventId → 当前确无崩溃。
- 加成证据：sms.json:35 该 SMS 自带 comment 明写「与 risk-events risk-press-zhangqiang 关联（该事件 amount 20）」，与 risk-events.json:71-79（askedContact/char-zhangqiang/keyword '真相'/amount 20）逐一对齐，证明字段值是笔误而非有意改名。

**失败场景**
未来若 PhoneApp/SmsApp 开发 pushTriggerRiskEventId 消费逻辑（按 riskEvent id 查 RiskEvent 取 amount/触发条件），查询 riskEventById('risk-press-zhangqiang-for-truth') 返回 undefined → 该 sms 的风险联动静默失效，玩家追问张强真相后不会按设计加风险，或触发 undefined.amount 运行时异常。当前因无运行时读取故无崩溃，但属数据即契约（§4）层面的悬空引用。

**修复指向**
- 回 **Phase1 level-designer**（meta/risk-events.json）：将 `risk-press-zhangqiang` 重命名为 `risk-press-zhangqiang-for-truth`（与 sms 引用对齐）；
- **或**回 **Phase2 writer-phone-story**（phone/sms.json:23）：将该 sms 的 pushTriggerRiskEventId 改为 `risk-press-zhangqiang`。二选一统一即可。
- 建议同时让 SmsService 实际消费此字段以闭环，或显式删除该字段避免遗留半成品契约。

---

### LOW 级缺陷（13 项）

> low 级缺陷无碍核心闭环，但违反契约清晰度或属加固项。分类列出，按维度归组。对抗复核中 risk-balance 维度有一条原 medium 被降为 low（见 L1）。

---

#### L1. risk-event id 与 sms pushTriggerRiskEventId 不一致：risk-press-zhangqiang vs risk-press-zhangqiang-for-truth（M4 同源缺陷，risk-balance 视角）

- **维度**：risk-balance
- **severity**：low（原 medium，对抗复核降级，severityAdjustment: lower）
- **对抗复核**：CONFIRMED（缺陷成立），但 severity 由 medium 降为 low。

**降级理由（对抗复核）**
- 字面事实坐实（同 M4）。但 finding 的失败场景「永不推送…静默丢失，叙事断裂」在当前实现下不成立：
  1. `pushTriggerRiskEventId` 字段无任何运行期消费方（仅 3 处声明，src/engine/** 全无读取）。
  2. `sms-zhangqiang-second-threat` 的实际送达路径在 `src/apps/SmsApp/SmsApp.tsx:120-121` `case 'sms-zhangqiang-second-threat': { return risk >= 20; }`，由「风险值阈值得 20」判定，与 pushTriggerRiskEventId 串匹配无关；而 risk-events.json:73 该事件 amount 正是 20，sms.json:35 comment 也注明关联经「amount 20」，故 today 短信能正确推送。
  3. src/engine/risk/RiskService.ts 仅消费 thresholds（getThresholds），无 RiskEventDispatcher，finding 描述的「按 pushTriggerRiskEventId 反查推送」调度器是不存在的假设。
- 综上：缺陷（悬挂 id 引用）成立 so confirmed=true；但影响为隐性契约漂移而非功能叙事断裂，失败场景依赖未实现的调度器，实际送达经独立阈值机制工作，severity 降为 low。

**修复指向**：同 M4（统一 id 或删除字段）。

---

#### L2. risk-events.json 注释「访问经费报告 +10」与实现不符：page-lab-funding-report.onViewEffects 不含 addRisk

- **维度**：risk-balance
- **severity**：low
- **对抗复核**：未单独复核（low 级，依附于 H4 的 verify 结论）

**证据**
- `public/data/meta/risk-events.json:61-69` risk-visit-sensitive-page 声明 +10，触发 pageId=page-lab-funding-report。
- `public/data/browser/pages/page-lab-funding-report.json:80-85 onViewEffects` 仅含 `startCountdown/pushSms/pushDoorbell/playAudio`，无 addRisk。

**失败场景**
玩家打开经费报告页时据设计应 +10（敏感访问），实际 +0；与 §6.8「访问多个敏感页」累积到 100 的设计不符。该问题实质是 H4 的子症——若 RiskEventDispatcher 落地，visitSensitivePage 应由 dispatcher 统一处理，而非把 addRisk 写进 page.onViewEffects。

**修复指向**
- 由 H4 的 RiskEventDispatcher 统一处理 visitSensitivePage，不要把 addRisk 写进 page.onViewEffects（避免与敏感事件机制重复）。
- 回 **Phase1 level-designer** 同步核查是否还有 page-lab-subject-list 等其它应计敏感访问但未声明的页面。

---

#### L3. 文档残留废弃答案 20251128（已在 §6.1 显式废弃，不在审查作用域 public/data/src 内）

- **维度**：password-consistency
- **severity**：low
- **对抗复核**：未单独复核（low 级，§6.1 已声明废弃）

**证据**
- `docs/game_about/剧情大纲.md:45` 含「猜出QQ密码是 `20251128`」。
- public/data 与 src 全量 grep `20251128` 零命中。
- `puzzles.json:7-11` answer="0328"，oneOf accepted=["0328","20260328"]，与 §6.1 统一方案一致。

**失败场景**
非功能缺陷：玩家不可见（docs 为只读设计文档，未进入 public/data 也不被 src 引用）。仅当未来某 agent 误把剧情大纲.md 当真源回填数据时，会引入错误答案 20251128 导致玩家无法通关。当前实际游戏数据层无此风险。

**修复指向**
- 无需回 phase 修复（§6.1 已声明该处为早期设定遗留、以 §6 统一方案为准）。
- 如追求文档洁净，可由主控在只读文档头部加注「本处 20251128 已被 CLAUDE.md §6.1 统一为 0328」标记，避免后续 agent 误读；data/src 层无需改动。

---

#### L4. evidenceSet 校验器无运行时红鲱鱼守卫，仅依赖数据契约

- **维度**：red-herring
- **severity**：low
- **对抗复核**：未单独复核（low 级加固项）

**证据**
- `src/engine/puzzle/validators.ts:114-119` matchEvidenceSet 只读取 requiredEvidenceIds 与 minLength，不交叉 clue-map.json 的 isRedHerring。
- 当前 clue-map.json 中 5 处红鲱鱼 relatedEvidenceIds 均为空，故无证据可泄露，隔离成立。

**失败场景**
若后续 level-designer 误将某红鲱鱼线索的 relatedEvidenceIds 填上 ev-* 并把该 ev-* 加入 finale.requiredEvidenceIds，引擎不会拦截，违规将静默通过。

**修复指向**
- 回 **Phase5** 加固项：在 `src/data/loader.ts` Zod 加载后增加一次性断言：遍历 clue-map 中 isRedHerring:true 的 clue 收集其 relatedEvidenceIds，断言这些 id 不出现在任何 puzzle.matchStrategy.requiredEvidenceIds（evidenceSet 式）与 call-scripts evidenceSelection.requiredEvidenceIds 中，违反则加载期抛错。非当前缺陷。

---

#### L5. triggersEvidenceId 字段在引擎中为死字段，证据收集实际不依赖它

- **维度**：clue-closure
- **severity**：low
- **对抗复核**：未单独复核（low 级，依附于 clue-closure 维度 verify）

**证据**
- `types/index.ts:101,138,166,218` 定义 ChatMessage/MomentsPost/OfficialAccountArticle/WebPage.triggersEvidenceId。
- `page-xinxwang-cooperation.json:62` 写入 `"triggersEvidenceId":"ev-xinxwang-lab-news"`（另 page-lab-funding-report/page-lab-subject-list 等多条载体也写入）。
- 全量 grep 显示 `ClueRegistry.ts/evidence/EvidenceService.ts/PuzzleService.ts/EffectExecutor.ts` 均不读取该字段，仅 `src/data/loader.ts` Zod schema 与 `src/apps/*/data.ts` 声明。

**失败场景**
若 level-designer 误以为「在 page.triggersEvidenceId 写证据ID 即会被 onView 收集」而省略 `clue.relatedEvidenceIds`，则该证据无法被收集。当前 ev-xinxwang-lab-news 因 clue-xinxwang-lab-coop.relatedEvidenceIds 同步写了该证据才闭环；page 上的 triggersEvidenceId 是冗余且具误导性的。

**修复指向**
- 回 **Phase3/frontend-engine**：要么在 `ClueRegistry.collectRelatedEvidence` 增补分支读取载体（page/message/moment/article）.triggersEvidenceId 并按 collectingCondition 收集，使字段生效；要么删除 payload 端与 types 上的 triggersEvidenceId 字段，单一 reliance `clue.relatedEvidenceIds` + collectingCondition，并在 SCHEMA.md 标注其弃用。推荐前者以兑现 §4.2「关卡机制钩子」设计意图。

---

#### L6. puzzle-evidence-finale.registersEvidenceIds 与 matchEvidenceSet 校验前置条件冗余，存在语义混淆

- **维度**：clue-closure
- **severity**：low
- **对抗复核**：未单独复核（low 级）

**证据**
- `puzzles.json:157-163` puzzle-evidence-finale.registersEvidenceIds 列 5 项关键证据。
- `PuzzleService.ts:94-99` 成功后 `store.solvePuzzle({registerEvidenceIds})` 将其并入 collectedEvidenceIds（gameStore.ts:152-154 collectEvidence 去重）。
- `validators.ts:114 matchEvidenceSet` 已要求 requiredEvidenceIds 全部命中 selected(=已收集) 才返回 ok。

**失败场景**
无破坏性后果（matchEvidenceSet 保证 ok 仅在 5 证据均已收集时为真，registerEvidenceIds 此时是 no-op 去重）。但该字段使「终章谜题成功会收集证据」与「证据必须先收集才能通过终章谜题」并存，语义自相矛盾，易误导后续维护者认为可绕过收集。

**修复指向**
- 回 **Phase1 level-designer**：删除 puzzle-evidence-finale.registersEvidenceIds（它对终章校验无贡献）；或在 PuzzleService 对 evidenceSelection 类谜题跳过 registerEvidenceIds 注入。属契约清晰度问题，不影响闭环。

---

#### L7. 终章存在 AlbumApp 与 PhoneApp 双重 submit(puzzle-evidence-finale)，onSuccess 二次执行（幂等但冗余）

- **维度**：clue-closure
- **severity**：low
- **对抗复核**：未单独复核（low 级）

**证据**
- `AlbumApp.tsx:142,176` `usePuzzle('puzzle-evidence-finale').submit({selected})` → PuzzleService 执行 onSuccess(advanceChapter ch-finale)；随后 AlbumApp:189 goCallPolice→openApp('phone')。
- `PhoneApp.tsx:250,342` 在 call-script-dispatcher-report 的 evidenceSelection 节点再次 submitFinale({selected})，已解谜题再次 executeEffects(onSuccess)→advanceChapter ch-finale 二次。
- `PuzzleService.ts:88-99` 已解谜题仍会执行 onSuccess。

**失败场景**
玩家在 AlbumApp 提交通过后再拨打电话，通话内 evidenceSelection 仍强制玩家重复「发送证据」动作，且 advanceChapter ch-finale 被执行两次。功能幂等无崩溃，但交互冗余、与「证据已通过终章校验可直接拨号」的 AlbumApp 提示语义重复。

**修复指向**
- 回 **Phase4 frontend-phone-apps/frontend-phone-shell**：PhoneApp 通话脚本在 finalePuzzled 已解时应跳过 evidenceSelection 节点直接走 good 分支渲染（PhoneApp.tsx:361-366 useEffect 当前为空占位，未实现该短路）；或统一终章提交入口，避免双路径。不影响真结局可达性。

---

#### L8. 章节 objectives 完成态从未写入 completedObjectives，目标追踪功能断路

- **维度**：chapter-reachability
- **severity**：low
- **对抗复核**：未单独复核（low 级）

**证据**
- `src/engine/store/gameStore.ts:191-196` completeObjective action 已定义，操作 completedObjectives。
- `src/engine/puzzle/PuzzleService.ts:94-99` submit 成功分支调 solvePuzzle 时未传 completeObjectiveId，且 puzzles.json 无 objective 绑定字段。
- 全仓 grep "completeObjective" 仅命中 gameStore 定义与解构剥离，引擎/服务中无任何调用点。

**失败场景**
chapters.json 每章 objectives 声明了 completionPuzzleId/completionEvidenceId/completionClueId，但解谜/取证/注册线索后均未调 store.completeObjective(id)。completedObjectives 永远为空数组。若 UI 依据 completedObjectives 渲染目标完成态（打勾），所有目标永远显示未完成。对 reachability 本身不阻塞（章节推进由 enterCondition 驱动，不读 completedObjectives），但「每章 objectives 可达成」在追踪层面失真。

**修复指向**
- 回 **Phase4 frontend-engine**：在 `src/engine/puzzle/PuzzleService.ts`、`src/engine/clue/ClueRegistry.ts`、`src/engine/evidence/EvidenceService.ts` 的 solve/register/collect 成功后遍历当前章节 objectives，对 completionPuzzleId/completionClueId/completionEvidenceId 命中者调 store.completeObjective。
- 或将 UI 改为从 solvedPuzzleIds/registeredClueIds/collectedEvidenceIds 派生目标完成态，弃用 completedObjectives。

---

#### L9. ch-2/ch-4 enterCondition 用单元素 and 包裹，语义冗余且暗示遗漏的第二条件

- **维度**：chapter-reachability
- **severity**：low
- **对抗复核**：未单独复核（依附于 M2 verify）

**证据**
- `chapters.json:46-51` ch-2: `{kind:'and', conditions:[{kind:'clueRegistered',...}]}` 仅 1 个子条件；`:96-101` ch-4 同样单元素 and。

**失败场景**
and:[X] 等价于 X，单元素 and 无额外语义。结合 M2，强烈暗示设计意图原为多条件串行（应含前置谜题守卫），回填阶段被简化掉。

**修复指向**
- 回 **Phase1 level-designer**：要么补上第二条件（见 M2 的修复），要么去掉 and 直接用单条件；不要保留零增益的 and 包装。

---

#### L10. enterChapter 重复 emit chapterAdvanced 事件，订阅方二次响应

- **维度**：chapter-reachability
- **severity**：low
- **对抗复核**：未单独复核（low 级）

**证据**
- `src/engine/chapter/ChapterDirector.ts:93` enterChapter 内 emit('chapterAdvanced',...) 无条件触发。
- ChapterDirector.ts:104 同函数内，若 chapter.introMonologueId 存在且未展示，再次 emit('chapterAdvanced',...)。

**失败场景**
凡进入带 introMonologueId 的章节（全部 7 章），chapterAdvanced 被 emit 两次。useChapter.ts:20 订阅 chapterAdvanced 触发 force 重渲染，导致每次进章双次重渲染；任何其它订阅者也会被触发两次，可能造成动画闪跳或计数错位。对 reachability 不阻塞，属副作用正确性瑕疵。

**修复指向**
- 回 **Phase4 frontend-engine** `src/engine/chapter/ChapterDirector.ts`：只在 enterChapter 末尾 emit 一次 chapterAdvanced；或将独白分支的 emit 改为更细粒度事件（如 monologueShown），与 chapterAdvanced 解耦。

---

#### L11. ev-xinxwang-lab-news（5 项 required 之一）仅靠页面查看收集，且 ch-4 进入条件硬依赖它，路径单一脆弱

- **维度**：endings
- **severity**：low
- **对抗复核**：未单独复核（low 级）

**证据**
- `puzzles.json:142-150` requiredEvidenceIds 含 ev-xinxwang-lab-news。
- `evidence-registry.json:37-39` ev-xinxwang-lab-news collectingCondition='onView', triggerPageId='page-xinxwang-cooperation'（非 onPuzzleSolve，无任何 puzzle.onSuccess 收集它）。
- `clue-map.json:71-82` clue-xinxwang-lab-coop (source=web-page:page-xinxwang-cooperation, relatedEvidenceIds=[ev-xinxwang-lab-news], autoRegisterOnView=true)。
- `ClueRegistry.ts:97-114` collectRelatedEvidence 仅在 collectingCondition==='onView' 且 triggerClueId 命中时收。
- `chapters.json:96-101` ch-4 enterCondition 硬依赖 evidenceCollected:ev-xinxwang-lab-news。view 收集入口仅在 BrowserApp.tsx:109 clueApi.view({kind:'page',pageId})。

**失败场景**
正常路径下 page-xinxwang-cooperation 为 public 且被 page-xinxwang-home 顶部 nav 链接，可达，happy 路径成立。但该证据是 5 项中唯一不走 puzzle.onSuccess 的，收集完全依赖玩家在 BrowserApp 主动打开该合作单位页且触发 enterPage→clueApi.view；若玩家遗漏该页（合作页非主线必经），ev-xinxwang-lab-news 缺失 → puzzle-evidence-finale evidenceSet 校验失败 → 强制 normal 结局，且 ch-4 因 enterCondition 不满足而无法推进。

**修复指向**
- 回 **Phase1 level-designer**：考虑在 puzzle-lvzhong-internal 或新希望相关节点用 collectEvidence effect 把 ev-xinxwang-lab-news 纳入解谜收集兜底；
- **或**回 **Phase2 writer-browser**：在 page-xinxwang-home 更显著地引导至 cooperation 页（现仅 nav 链接），降低遗漏概率。

---

#### L12. 类型契约命名不当：Puzzle.hintIds 声明为 ClueId[] 但数据填 hint id

- **维度**：build-types-ids
- **severity**：low
- **对抗复核**：未单独复核（low 级类型修正）

**证据**
- `src/types/index.ts:301` 声明 `hintIds: ClueId[];`。
- `puzzles.json` 中 puzzle-qq-login.hintIds=["hint-qq-password"]、puzzle-lvzhong-internal.hintIds=["hint-lvzhong-password"]、puzzle-xinxwang-backend.hintIds=["hint-xinxwang-password"]、puzzle-lab-backend.hintIds=["hint-lab-password"]，这些 id 存在于 `public/data/story/hints.json`，而非 clustering/clue-map.json（clue-* 共 19 条，无 hint- 前缀）。
- `loader.ts:249 puzzleSchema.hintIds: z.array(idStr)` 仅校验非空字符串未约束为 ClueId。
- 运行时 PuzzleService.ts:148-149 把 puzzle.hintIds 当 hint id 传给 store.markHintShown(hid) 并写入 shownHintIds（string[]，types/index.ts:439），功能正确；但 getHintById(id) 在 src 中无任何调用方，提示文本 UI 只用 res.hintTriggered 布尔硬编码文案（QqLogin.tsx:56），hintIds 内容实际未被读取显示——属功能 stub，非本维度硬伤。

**失败场景**
按类型契约 hintIds 应是 ClueId[]，reviewer/agent 若按类型做引用合法性 lint（如本审查初期按 clueIds 校验），会误报 4 处悬空 ClueId 引用。

**修复指向**
- 回 **Phase0 doc-engineer** `src/types/index.ts:301`：将 `hintIds: ClueId[]` 改为 `hintIds: string[]` 或新增 `HintId` 类型别名 `hintIds: HintId[]`，使类型与数据语义一致；`loader.ts:249` 一并同步。属类型契约修正，不影响构建与运行。

---

## 三、7 维度详审总结

### DIM-1. clue-closure — verdict: PASS

5 项关键证据（ev-qq-chat-plan / ev-lvzhong-agreement / ev-xinxwang-lab-news / ev-paper-pdf / ev-lab-funding-report）均存在从序章到终章的可达闭环。核心机制独立复验：
1. 每条关键证据都有匹配的可达 clue-source 且载体被 phase3 回填了 registersClueId/triggersEvidenceId（page-xinxwang-cooperation、page-lvzhong-notice、page-lvzhong-contact、page-arxiv-paper、page-lab-funding-report、thread-li-yan-qq、moment-li-0311-endfield、article-ai-interpret 均已确认）。
2. 引擎 ClueRegistry.onView 查 clue-map.json 表注册线索、collectRelatedEvidence 按 `clue.relatedEvidenceIds` + `collectingCondition==='onView'` 收集证据，onPuzzleSolve 类证据不被 onView 误收。
3. 4 项关键证据由对应 puzzle.onSuccess 的 collectEvidence effect 收集（ev-qq-chat-plan←puzzle-qq-login, ev-lvzhong-agreement←puzzle-lvzhong-internal, ev-paper-pdf←puzzle-upload-paper, ev-lab-funding-report←puzzle-lab-backend），1 项（ev-xinxwang-lab-news）由 onPage view 路径收集。
4. 终章 puzzle-evidence-finale.matchStrategy.evidenceSet 要求 requiredEvidenceIds 5 项齐备且 minLength>=5，validators.matchEvidenceSet 正确实现。
5. 终章勾选两条路径均闭环——AlbumApp.usePuzzle('puzzle-evidence-finale').submit({selected}) 与 PhoneApp call-script-dispatcher-report 的 evidenceSelection→submitFinale→branch good.endEffects(pushEnding good + openNewsApp) 经 EffectExecutor 执行。
6. 18 条 registersClueId + triggersEvidenceId 回填独立复验一致。未发现闭环断裂。

low 级瑕疵 3 项（L5/L6/L7），无碍闭环但违反契约清晰度。

### DIM-2. red-herring — verdict: PASS

5 处红鲱鱼（终末地讨论/思过室窗户照/校长信箱/3失联者新闻/新希望后台财务）全部 `isRedHerring:true` 且 relatedEvidenceIds 均为空，无关联证据可泄露。终章 puzzle-evidence-finale.requiredEvidenceIds 仅含 5 项关键证据（不含任何红鲱鱼证据），call-scripts.json 举报通话的 requiredEvidenceIds 同样仅含 5 项关键证据，两处一致。puzzle-xinxwang-backend.onSuccess 仅 registerClue 注册红鲱鱼线索、无 collectEvidence 关键证据，其解锁页 page-xinxwang-financial 无 triggersEvidenceId/onViewEffects。chapters.json 中无任何章节 enterCondition 或 objective 以红鲱鱼 puzzle/clue/evidence 为前置，红鲱鱼不阻塞通关。validators.ts 的 evidenceSet 判别器只用 requiredEvidenceIds+minLength 校验。红鲱鱼隔离维度通过。加固项 1 个（L4）。

### DIM-3. password-consistency — verdict: PASS

puzzles.json 全部 6 类谜题答案与 §6.1 一致且与剧情文本线索闭环；validators.ts 判别器正确、不持硬编码答案；PuzzleService/QqLogin 入口不硬编码答案。QQ 答案 0328(+容错 20260328) 在 public/data 与 src 中全程无 20251128，仅在 docs 只读遗留文档残留（已被 §6.1 显式废弃，非缺陷，见 L3）。终章 requiredEvidenceIds=5 项、minLength=5。红鲱鱼 88888888 严格隔离于 requiredEvidenceIds 之外。

### DIM-4. chapter-reachability — verdict: PARTIAL

evaluateCondition 正确处理 gameStart/puzzleSolved/evidenceCollected/clueRegistered/and 递归；每章 enterCondition 依赖的 puzzle/clue/evidence 均可在前置章节达成（clue 注册路径经 BrowserApp.visitPage→useClue.view→ClueRegistry.onView→clueRegistered→reevaluateChapters 完整可达，ch-2/clue-lvzhong-hidden-url 路径已确认活跃）。但 ch-2 与 ch-4 的 enterCondition 仅依赖「查看即取证」类条件，缺少前置章节谜题守卫，触发页均为 public，可被越序进入从而跳过 ch-1（及 ch-3），破坏 §9.3 线性流程并可能使关键证据 ev-qq-chat-plan 缺失而削弱真结局路径（可回溯恢复，非硬锁，见 M2）。另发现 L8/L9/L10 三项 low。

### DIM-5. endings — verdict: FAIL

三结局的「触发态翻转」（endings.json trigger 绑定 + pushEnding 不可回退 + 倒计时/风险满→bad）在数据与引擎层均正确闭环：good=evidenceSufficient、normal=evidenceInsufficient、bad=countdownExpired(countdown-finale) 且 CountdownService.expireCountdown/RiskService(==100) 都能调 pushEnding('bad')；gameStore.pushEnding 设 finished=true 后幂等忽略后续。5 项关键证据在 happy 路径能凑齐。page-lab-funding-report.onViewEffects 四件套由 ChapterDirector 在首访触发，绑定正确。

但「三结局可达/达成的玩家可见闭环」是坏的，存在 2 项 HIGH（H1/H2）+ 2 项 medium（M1/M3）+ 1 项 low（L11）。违反 §9.4 三结局分别触发的玩家可见交付。

### DIM-6. build-types-ids — verdict: PARTIAL

核心构建/类型/ID 合法性基本全过：tsc --noEmit 与 npm run build 均 exit 0；110 个 JSON 全部 JSON.parse 通过；9 个 App 各有 manifest、PhoneShell 无 manifest（设计如此）；EffectExecutor 覆盖全部 15 个 PuzzleEffect type（exhaustive check 完备）；RichBlocks 覆盖全部 6 个 ArticleBlock + 11 个 PageBlock type；唯一 GameState store（webgame-save）；5 项关键证据 ev-id 与 §7 严格对齐，7 个谜题答案与 §6.1 一致、前端无硬编码答案；所有 registry 内无重复 ID；28 个 effect 全部解析到合法目标；所有跨文件 characterId/puzzleId/evidenceId/clueId/pageId/threadId/chapterId/endingId/smsEventId/doorbellEventId/callScriptId/riskEventId 引用均解析通过——除 M4（悬空 riskEvent 引用）+ L12（hintIds 类型）。dist 产物正确带 base '/webgame/'，110 个 JSON 已复制到 dist/data。

### DIM-7. risk-balance — verdict: FAIL

风险阈值实现本身正确（max=100 钳制、badEndingAt==100 触发 bad、redAlertAt>70 红边），但风险值供给严重失真。2 项 HIGH（H3 双计 / H4 死数据）+ 2 项 low（H4 子症 L2 + 降级后的 L1）。正常通关路径存在误触 bad 结局风险，且「被盯上/访问敏感页面」叙事风险完全不生效，不达 §6.8 要求。

---

## 四、Phase5 结论 + 后续修复清单

### Phase5 结论：不可发布（FAIL）

虽然 §6 强制项中的「红鲱鱼隔离」「密码一致性（含 20251128 废弃处置）」「线索闭环」三个维度全部 PASS，但「三结局可达（§9.4）」与「风险值阈值（§6.8）」两个 §6/§9 强制维度 FAIL，且任意一项 HIGH 都不能放过。必须回 Phase1/Phase4 修复 4 项 high 后重测方可发布。

§9.7「reviewer 的 docs/engineering/REVIEW_REPORT.md 全部通过或已修复」未达成——此报告本身即证据。

### 后续修复清单（按 phase 分发，按严重度排序）

**必须修复（high，阻塞发布）**

1. **[Phase4 frontend-phone-apps/frontend-phone-shell]** H1+H2+M1 统一方案：新增全局 EndingOverlay/EndingView 组件（订阅 `useGameStore.endingId/finished`），渲染三结局的 epilogueBlocks；新增 NewsApp 或用 EndingView 取代 openNewsApp 路由跳转；按 postEndingWechatMessage 把结局后微信消息追加到对应 thread；bad 时全屏黑屏遮罩。补 tsc + 桌面手动验证。
   - 涉及文件：`src/apps/PhoneShell/PhoneShell.tsx`、新建 `src/apps/PhoneShell/EndingOverlay.tsx` 或 `src/apps/NewsApp/{manifest.ts,NewsApp.tsx}`、`src/apps/PhoneShell/AppRegistry.ts`、`src/apps/PhoneShell/AppRouter.tsx`、消费 `src/data/loader.ts:944-949 getEndingById`。

2. **[Phase4 frontend-engine]** H3：修 `src/engine/puzzle/PuzzleService.ts` 失败分支，删除 L138-141 的 riskPerWrongAttempt 加风险（保留 onFailure.addRisk 为唯一来源），或删各谜题 onFailure 内 addRisk。建议前者。

3. **[Phase4 frontend-engine]** H4：新增 RiskEventDispatcher，按 trigger.kind 分发 risk-events.json events，接入 ChapterDirector.visitPage（visitSensitivePage）与 askedContact 触发点；或回 Phase1 删除 risk-events.json 的 askedContact/visitSensitivePage 并阐明。
   - 涉及文件：`src/engine/risk/RiskService.ts` 或新建 `src/engine/risk/RiskEventDispatcher.ts`、`src/engine/chapter/ChapterDirector.ts:131-141`。

**应修复（medium，影响体验）**

4. **[Phase1 level-designer]** M2：`public/data/meta/chapters.json` ch-2 enterCondition 加 `puzzleSolved:puzzle-qq-login`、ch-4 加 `puzzleSolved:puzzle-lvzhong-internal`；或 [Phase4 frontend-engine] ChapterDirector.reevaluateChapters 增串行化约束。建议两处都做。
5. **[Phase4 frontend-engine]** M3：`src/engine/puzzle/EffectExecutor.ts` executeEffects 循环内对非 pushEnding 类型加 `if (getGameStore().finished) break` 守卫。
6. **[Phase1 level-designer 或 Phase2 writer-phone-story]** M4/L1：统一 risk-event id（risk-press-zhangqiang vs risk-press-zhangqiang-for-truth），并让 SmsService 实际消费此字段或删除字段。

**可选修复（low，加固与契约清晰度）**

7. **[Phase5]** L4：loader.ts 加载后增加红鲱鱼 relatedEvidenceIds 不进 requiredEvidenceIds 的一次性断言。
8. **[Phase3/frontend-engine]** L5：使 triggersEvidenceId 生效或删除该字段并 SCHEMA 标注弃用。
9. **[Phase1 level-designer]** L6：删 puzzle-evidence-finale.registersEvidenceIds；L9：ch-2/ch-4 去掉单元素 and 或补第二条件。
10. **[Phase4 frontend-phone-apps]** L7：PhoneApp 通话脚本在 finalePuzzle 已解时跳过 evidenceSelection。
11. **[Phase4 frontend-engine]** L8：在 solve/register/collect 成功后调 store.completeObjective，或 UI 改从派生状态；L10：ChapterDirector.enterChapter 只 emit 一次 chapterAdvanced。
12. **[Phase1 level-designer / Phase2 writer-browser]** L11：用 collectEvidence effect 把 ev-xinxwang-lab-news 纳入解谜兜底，或在 page-xinxwang-home 加强引导。
13. **[Phase1 level-designer]** L2：核查 page-lab-subject-list 等其它应计敏感访问页面（依附于 H4）。
14. **[Phase0 doc-engineer]** L12：`src/types/index.ts:301` hintIds 类型改为 `string[]` 或 `HintId[]`，loader.ts:249 同步。
15. **[主控]** L3：可选在 docs/game_about/剧情大纲.md 头部加注 20251128 已被弃用（data/src 层无需改动）。

### 重测验收标准（修复后）

- tsc --noEmit + npm run build 均 exit 0；
- `npm run dev` 手动走通 §9.3 主线，确认：
  - 真结局：5 证据齐 + 180s 内拨号 → 全局 EndingOverlay 渲染 good.epilogueBlocks + postEndingWechatMessage 注入微信；
  - 普通结局：不足 5 证据拨号 → EndingOverlay 渲染 normal.epilogueBlocks；
  - 坏结局：任意 App 中倒计时归零或风险满 → 全局黑屏遮罩；
- ch-2 进章前必须已解 puzzle-qq-login，ch-4 进章前必须已解 puzzle-lvzhong-internal；
- 谜题错答不再双计（单次 +10，正常通关路径 risk 不超 50）；
- 访问经费报告页 +10、向张强追问真相 +20 生效；
- review report 全过或已修复（§9.7）。

---

> 报告生成时间：2026-08-19
> 审查方式：blind-review 7 维度 + 对抗复核 9 项 ≥medium finding
> 数据基线：public/data/** + src/engine/** + src/apps/**（对照 .claude/CLAUDE.md §4/§4.2/§5/§6/§7/§9）
