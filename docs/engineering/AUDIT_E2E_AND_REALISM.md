# 《张强宿舍大逃杀》端到端可玩性 + 真实性审核报告

> 审核方式：静态审查（逐文件读 public/data/** 与 src/**）+ **实测**（npm run build + 自建 Node 静态服务 + 无头 Chrome CDP 全程真实操作 UI：点击、输入、上传 PDF、拨号，逐屏读取 DOM 文本与 localStorage）。
> 结论分「实测确认」与「静态确认」两级标注，凡实测项均给出实际观察到的屏幕文本或存储值。

---

## 0. 结论速览

| 问题 | 结论 |
|---|---|
| 能不能端到端玩完？ | **能通关，但必须依赖一个游戏从未提示的动作：手动刷新手机标签页**。不刷新则相册永远为空、真结局不可达。 |
| 三种结局可达性 | 真结局 = 可（实测渲染成功）；**普通结局 = 不可达（逻辑死锁）**；**坏结局 = 不可达（跨标签失效）**。 |
| 技术健康度 | tsc -b && vite build 通过；全程 0 console error / 0 exception；Zod 数据校验全通过。 |
| 真实性 | 骨架像（域名/栏目/字段/文风大多对），但**占位符、作者旁白、工序残留直接印在玩家可见处**，且 **44 个资源引用中 32 个文件不存在**（头像/配图/首图/视频全缺，退化成灰框与字母方块）。 |

---

## 1. 端到端缺陷（实测为主）

### E2E-1【high·实测】跨标签状态不同步：手机刷新前看不到网页里收集的证据

- 复现：手机标签页（#/）先打开 → 另一个标签页浏览 新希望新闻页 / 实验室经费报告 / 绿中协议 / 上传论文，localStorage.webgame-save 正确累积到 4 项证据 → 回到手机标签页打开相册：**空态**（调查中看到的聊天记录、协议、论文、报告会自动归档到这里。先去微信 / QQ / 网站查看关键内容吧）。
- 手动 F5 后同一相册显示：已归档 3 项 · 关键证据 3/5（实测值）。
- 原因：src/game/gameStore.ts 用 zustand/persist，**无 storage 事件同步**（全仓 grep 无 addEventListener storage）。每个标签页的 store 在文档加载时水合一次，之后各自为政；站点在另一个标签页里的 collectEvidence 只写它自己的内存 + localStorage，而手机标签页的内存快照停留在打开时的旧值。
- 影响：puzzle-evidence-finale 需要 5 项证据，其中 4 项只能从网页侧归档。手机标签页内存里拿不到 → 通话内证据勾选弹窗永远凑不齐 5 项。
- 反向问题同样存在：手机标签页里的任何一次状态写入（登录 QQ、推进章节等）都会用它的旧快照**覆盖** localStorage，把网页侧刚归档的证据抹掉。实测：网页侧 localStorage 显示 3 项后，在手机标签页完成一次 QQ 登录，collectedEvidenceIds 立即变回空数组。

### E2E-2【high·实测+静态】普通结局不可达（证据不足分支被按钮禁用死锁）

- src/apps/PhoneApp/PhoneApp.tsx:529：const canSend = selected.size >= minLength，而 minLength 取自 puzzles.json 的 puzzle-evidence-finale.matchStrategy.minLength = 5。
- 实测：当玩家只收集到 4 项证据时，弹窗显示「至少勾选 5 项，且需包含全部 5 项必选证据（必选已勾 4/5）」，发送证据（4）按钮 **disabled**，点击无效（探针返回 DISABLED），通话无法结束、不产生任何结局。
- 想走普通结局需要「勾选数 ≥5 但不含全部必选」，即必须收集到 **6 项**证据再手动取消一项必选。而第 6 项 ev-lab-upload-log **全仓无任何收集路径**（grep ev-lab-upload-log src 零命中），可收集证据上限恰好是 5 项。
- 结论：普通结局（normal）在当前构建中**不可能到达**，与代码注释「允许在未集齐必选时发送（证据不足 → 普通结局分支）」相矛盾。

### E2E-3【high·实测】3 分钟倒计时 / 威胁短信 / 刀哥门铃 / 心跳全部发生在另一个标签页，玩家侧完全无感

- 触发链：page-lab-funding-report 被浏览 → src/sites/shared/gameEvent.ts:63-67 → startFinaleCountdown()（src/utils/shellState.ts:344-363）→ 启动倒计时、投递短信、投递门铃、播心跳、红边、震屏。
- 但站点永远在**新标签页**打开（src/sites/sitePage.ts:63 window.open 带 _blank），而站点路由 #/site/:siteId/* 是 RootLayout 之外的顶级路由，**不渲染 PhoneShell** → 该标签页里没有状态栏、没有通知栏、没有短信/门铃 App。
- 实测（手机标签页视角）：网页标签页已浏览经费报告并写入 currentChapterId: ch-finale，但手机标签页正文查询「倒计时」「门口有人停留」「别多管闲事」**全部 false**；手机状态栏始终是 15:00 / 87%。
- 倒计时归零 → 坏结局的唯一入口是 watchCountdownExpiry()（shellState.ts:508），它只在 PhoneShell 挂载时启动（PhoneShell.tsx:35）。网页标签页没有 PhoneShell → 那里的倒计时**连 expired 都不会被标记**。
- 结论：终章「压迫四件套」（倒计时/心跳/威胁短信/门铃实时画面）在玩家实际所在的界面上 **100% 不可见**；坏结局实际不可达。

### E2E-4【high·实测】智能门铃 App 永远不会出现在桌面

- src/apps/DoorbellApp/manifest.ts 声明 availableFrom: ch-5；而 advanceChapter 全仓只有两处调用（shellState.ts:349 与 PhoneApp.tsx:484，都写 ch-finale），**ch-5 永远不会成为当前章节** → useVisibleApps() 过滤掉门铃。
- 实测桌面 aria-label 列表：打开 相册 / 打开 电话 / 打开 QQ / 打开 短信 / 打开 微信 / 打开百度搜索 —— 无门铃（开场页却宣传门铃是玩法之一）。
- 唯一可能的入口（门铃推送通知）也只在网页标签页的内存里生成，而那里没有通知栏。

### E2E-5【high·实测】进入任意 App 后没有任何返回桌面的入口

- 全仓 grep：导向 / 的只有两处兜底 Navigate（AppRouter.tsx:102,131），没有任何用户可点的返回桌面/Home。
- PhoneShell.tsx:148-161 的 Home indicator 是纯装饰 div（无 handler）；各 App 的 ‹ 只回到 App 内部列表。
- 实测：进入微信/QQ/相册后只能靠浏览器后退键；而开场页又建议「建议在桌面浏览器全屏体验」（IntroScreen.tsx:150），全屏下连后退键都没有。

### E2E-6【medium·静态】可选证据 ev-lab-upload-log 无获取路径

- call-scripts.json 的 optionalEvidenceIds 与 evidence-registry 都声明了它，但 src/sites/shared/gameEvent.ts 的 pageId→证据映射里没有承载系统日志的 page-lab-subject-list，全仓无收集调用 → 该项永远拿不到（并直接导致 E2E-2 的死锁无法绕过）。

### E2E-7【medium·静态】章节系统名存实亡

- chapters.json 定义 7 章，但 currentChapterId 只会是 ch-prologue（初始）或 ch-finale（终章触发时）。UI 唯一消费方是桌面 App 可见性过滤，因此除门铃外当前无可见后果，但章节独白类内容（如 sms-mom-care）永不触发。

---

## 2. 不真实的地方（玩家可见）

### A. 直接印在页面上的占位符（high）

| 位置 | 原文 | 为什么假 |
|---|---|---|
| src/sites/site-xinxwang/Layout.tsx:111,126-132 | 地址：长沙市某区某路168号 / 湘ICP备XXXXXXXX号 · 湘公网安备 XXXXXXXXXXXXX号 | 机构官网页脚，全站每页可见 |
| public/data/browser/pages/page-xinxwang-contact.json:30 | 电话：0731-8XXXXXXX | 联系我们页是玩家必看页 |
| src/sites/site-shanhe-med/index.tsx:116 | 地址：某省某市某区山河医科大学 | 大学全站页脚；且该校页脚无任何备案号 |
| src/sites/site-lvzhong/index.tsx:135-136 | 电话：0731-8800XXXX / 湘ICP备 2026 绿草中学 版权所有 · 湘教QS（2026）第 号 | **实测在登录页页脚直接可见** |
| public/data/browser/pages/page-tianyancha.json:28 | 统一社会信用代码 91430100MAXXXXXX26 | 18 位信用代码带 6 个 X |
| src/sites/site-hnedu/index.tsx:649 | 湘 ICP 备 00000000 号 · 湘公网安备 00000000000000 号 | 政府站页脚填 0 |
| src/sites/site-hnga/Layout.tsx:130 | 湘ICP备12345678号 | 顺子号，同页其它证号格式反而正确 |
| public/data/wechat/messages/thread-cliparents-wechat.json:90 | @张强 我家孩子叫XXX，能优惠点吗 | 家长群气泡里直接出现 XXX |

### B. 作者旁白 / 工序残留写进正文（high）

- page-news-police-crackdown.json:12：……抓获嫌疑人若干。该案与本案无直接关联，但暗示此类犯罪客观存在。—— 「本案」「暗示」是设计说明，不是新闻语言。
- page-xinxwang-voices.json:37：【已删除留言 · 页面缓存残留】……（该留言已被管理员删除，但浏览器缓存仍可检索到）—— 伪站自己解释「这是怎么被玩家找到的」，直接打碎第四面墙。
- src/sites/site-tianyancha/index.tsx:95：数据来源：公开工商登记信息（模拟数据，仅供参考）—— 伪站自称模拟数据。
- 站名「预印本论文库（仿arXiv）」（sites.json）会作为百度搜索结果标题渲染；page-shanhe-research-crystal.json 正文写「论文链接：见arxiv」；page-shanhe-lab.json 写「……或仿arXiv详情页」。
- page-arxiv-paper.json：伦理审批栏暂留空，待补充。（摘要里写待办）、▌ 评论区 + 匿名评论者 A（arXiv 摘要页没有评论区）。
- page-lab-funding-report.json / page-lab-subject-list.json：后台页用叙述口吻替玩家总结线索（受试者名单明确列出李桥瑞、闫欣泽……／所有受试者来源均为新希望成长中心）—— 真实管理后台不会写概述句。
- page-shanhe-news-award.json：（报道未涉及实验对象来源与伦理审查）—— 新闻自带编辑旁白。

### C. 现实不可能（high/medium）

- **一个号码被四家单位共用**：0731-88888888 同时是省公安厅举报电话（page-hnga.json）、省教育厅投诉电话（site-hnedu/index.tsx:156,307,648）、湖南新闻网新闻热线（site-news/Layout.tsx:53）、新希望成长中心咨询热线（site-xinxwang/Layout.tsx:72）。实测新希望页头即显示「咨询热线：0731-88888888」。
- **公安厅要闻日期在未来**：site-hnga/HomePage.tsx:95 起为 2026-08-12 / 2026-08-05 / 2026-07-28 / 2026-07-15（含夏季治安打击整治行动），而游戏当下是 2026-03-13。
- **后台登录页自我剧透**（实测可见）：site-shanhe-med/index.tsx:387「管理员登录。测试账号：admin。密码提示：基金号 2025YFC0123456 的后 6 位。」；site-lvzhong/index.tsx:537-540「账号：zhangqiang。密码提示：我的小目标（6位英文）」并在页内重复一遍。真实系统不会给出账号与答案格式。
- **天眼查字段与企业类型冲突**：主体写「（普通合伙）」却给法定代表人 / 注册资本 / 股东；关联企业里放「国家重点实验室（陈建国为法定代表人）」—— 实验室不是企业、没有工商登记。
- **资金流向自相矛盾**：page-lvzhong-agreement.json 写「每推荐一名学生，新希望成长中心向绿草中学返款 20 万元」，page-xinxwang-financial.json 记「学生转介费入账 +200,000 对方 绿草中学」（方向相反）；且「一学期 20 万学费」与「返款 20 万」并存，机构经济上不成立。
- **AI 工具域名**：https://paper-ai-interpret.local/（.local 是 mDNS 保留后缀，不可能是公网服务），页脚还把域名当版权署名。
- **arXiv 细节**：ID 2026.0228.001 是旧式伪 ID（2007 后应为 YYMM.NNNNN）；分类把 q-bio.BM 译成「生物膜」、q-bio.TO 译成「其它」；chembio 不是 arXiv 分类；ISSN 2026-0228 不合校验规则。

### D. 资源缺失导致的「灰框化」（high，实测统计）

脚本统计 public/data/** 中所有资源引用：**共 44 个 assetId，实际存在 12 个，缺失 32 个**。缺失清单：

- 全部 **18 个角色头像**（avatar-linzhe…avatar-dad）→ 微信/QQ 头像全部退化成姓名首字色块。
- **4 个网站首图**（campus-hero-lvzhong / xw-home-banner / shanhe-campus / shanhe-lab-building）→ 三个官网首页顶部是灰底占位框。
- **9 条朋友圈配图 + 5 条 QQ 空间配图**（moments-li-0309-wall-key、moments-li-0301-certificate-blur、qzone-li-0309-backwall-img 等）→ 关键线索图（后墙钥匙、模糊证书）看不到，放大看细节机制失效。
- **门铃视频** video-doorbell-dao-loop → 实时画面是一只手绘 SVG 光头剪影，且同屏挂「实时画面不可用」角标（DoorbellApp.tsx:113-115,138-152）。
- **相册 App 图标** album.png 无对应文件、且 icons.tsx 只对部分 id 做后缀归一化 → 桌面第一项实测渲染为「相」字方块（实测桌面文本首项即「相」）。

### E. 手机 UI 不像真机 / 死交互（medium）

- **相册被改成证据面板**：标题「证据档案」、进度「已归档 N 项 · 关键证据 x/y」、缩略图是 ★/·、并直接写出通关指令「还差 N 项关键证据。全部集齐后，拨打 0731-88888888 举报。」（AlbumApp.tsx:34-61）。相册里一张照片都没有。
- **游戏引导写进 App**：实测拨号页与短信页均出现「拨打 0731-88888888」（SmsApp.tsx:355-356、PhoneApp.tsx:180、DoorbellApp.tsx:132）。
- **短信列表 1970 纪元**：SmsApp.tsx:213 刘叔线程 lastMessageTime: 0 → :345 fmtDate(new Date(0).toISOString()) → 显示 01/01。
- **会话预览是占位文案**：微信一律「点击进入对话」、QQ 显示「N 条未读/点击查看」（ChatTab.tsx:177-179、ChatView.tsx:73-77）。实测 QQ 列表全部为「N 条未读」。
- **QQ 登录页常驻解题提示**（实测可见）：提示：李桥瑞说过「密码是那个日子」——想想他最近最在意什么。（QqLogin.tsx:139-141）。
- **桌面 dock 与网格重复**：实测 aria-label 列表中 打开 电话 / 打开 短信 / 打开 微信 各出现两次；dock 过滤表里还留着已不存在的 browser（Desktop.tsx:113-118）。
- **图标语义错**：状态栏心跳用相册图标（StatusBar.tsx:70）、全屏危险用齿轮（NotificationBar.tsx:214）；电量在危险时变成数值并变红，平时恒 87%。
- **时间格式五套并存**：微信因与真实系统日期比较，游戏内「今天」永不匹配 → 每条气泡都显示日期；QQ 恒 MM-DD HH:mm；短信 MM/DD；朋友圈走正则不换算时区；通知横幅用玩家真实系统时间（shellState.ts:151 createdAt: Date.now()）。实测通知横幅会出现现实日期。
- **死按钮**（点与不点无差别）：微信输入框 ··· / 😊 / ＋、搜索、添加、「我」页四项、朋友圈相机；QQ 通讯录行、空间说说点击、语音按钮；短信快捷回复的 toast 无渲染组件（useToasts 无消费者）。

### F. 时间线与事实错误（medium/high）

| 位置 | 问题 |
|---|---|
| src/apps/PhoneShell/IntroScreen.tsx:32 | 2026年3月12日，周五 —— **3-12 是周四**（3-13 才是周五，chapters.json 也写「失联的周五」） |
| public/data/qq/qzone.json:22、qq/messages/thread-game-qq.json:27,72,95 | 废弃值 **328** 残留 4 处（328公测见 / 328 328 重要的事说两遍 / 328见 / 已约，328一起肝），与**同一会话第 9 行**的「终末地11月28号公测！都预约了吗」直接矛盾。QQ 密码只接受 1128/20251128 → 按 328 推理的玩家**卡死在第一个谜题** |
| phone/sms.json:13、doorbell-events.json:9、call-log.json:78 | 18:30 触发 180 秒倒计时 → 18:33 就该坏结局，但数据里 18:35 还有威胁来电、18:38 才拨举报电话、18:45 收到已受理回执——3 分钟窗口装不下 15 分钟的事件 |
| 微信/QQ 班级群 4 处（2026-03-11 20:05-20:35） | 「明天放假」早了一天（校方通知 3-13 14:00 才放假） |
| public/data/meta/endings.json:96 | 「第二天，高二三班多了一个空座位」—— 全库唯一三班，其余全是高二一班 |
| public/data/wechat/messages/thread-ershou-wechat.json | authorCharacterId: char-linzhe-nickname / char-yanxinze-nickname 两个 ID 全库不存在 → 10 条消息全部显示匿名，且潜入计划的问价挂在林哲名下 |
| public/data/wechat/official-accounts.json:496,531,560,581 | 公众号 4 篇文章 publishedAt 为 3-14 / 3-15 / 3-16 / 3-18 —— **未来内容**，且列表按时间倒序排在最前 |
| public/data/phone/notes.json:25-28 | 备忘录里存着把 5 个谜题答案全部写好的攻略（→ 20251128 / yigeyi / 0312 / 123456）。当前构建**无备忘录 App**（src/apps 仅 6 个 manifest），故玩家看不到；但它仍在数据契约内，一旦接回即破题 |
| public/data/qq/group-files.json:49,53 | 闫欣泽 23:45 把「思过室窗户」照片传进**班主任也在的班级群文件**，全班零反应；gf-endfield-reserve-link 的文件名是「高兴」（链接标题写进了 name） |
| public/data/puzzle/puzzles.json:38 | 标题「登录新希望成长中心后台）」多一个右括号 |

---

## 3. 数据层「死内容」（玩家永远看不到，但仍在契约里）

- phone/notes.json、wechat/contacts.json：无 App/Tab 消费（备忘录 App、微信通讯录 Tab 均已不在构建中）。
- phone/sms.json 中 4 类事件无分发器：sms-zhangqiang-second-threat（pushTriggerRiskEventId）、sms-mom-care（chapterEntered ch-5）、sms-verification-redherring（idleOnPage 30s）、sms-good-ending-dispatcher（pushTriggerEndingId）。风险系统在去引擎化时被删除，只留下 useRisk() no-op（shellState.ts:430）。
- call-scripts.json 的 call-script-zhangqiang-threat-incoming.endEffect.addRisk、doorbell-events.json 的 deviceFeedback 部分字段同样无消费方。
- src/ui 中的一批死代码组件（ChatBubble.tsx、PasswordInput.tsx、RichBlocks 的 PageBlock 渲染器）全仓无 import，其中「开发者注释 / 线索已写入页面源码注释」等文案一旦接线就会直接曝光。

---

## 4. 修复优先级建议

**P0（决定能否正常通关）**
1. 跨标签状态：给 gameStore 加 storage 事件监听（或把证据集合改为每次从 localStorage 读取 / 用 BroadcastChannel 同步），并让网页侧与手机侧合并而非覆盖；否则玩家必须靠手动刷新才能通关。
2. 证据不足分支：canSend 应取 Math.min(minLength, collected.length)，或在弹窗内提示「证据不足也可发送（普通结局）」，让 normal 结局可达。
3. 终章四件套改由手机标签页触发：站点只上报「看过经费报告」（写 localStorage / 广播），由 PhoneShell 侧启动倒计时、短信、门铃；否则坏结局与全部压迫感到不了玩家眼前。

**P1（沉浸感）**
4. 清理占位符（6 个站的 ICP/公安备案号、电话、地址、信用代码、家长群 XXX）。
5. 删掉正文里的作者旁白（该案与本案无直接关联 / 仿arXiv / 见arxiv / 待补充 / 【已删除留言·页面缓存残留】 / 模拟数据仅供参考 / 后台页的线索总结句）。
6. 清 328（4 处），补全「终末地公测日」的可查来源（当前 2025-11-28 只出现在已死的 notes.json 与几句聊天里，且链接指向真实外网（故意设计，玩家必须通过访问外网得知公测真实日期，而不是在游戏文本中看到））。
7. IntroScreen 星期改「周四」（或把前情提要走成 3-13）。
8. 补 32 个缺失资源，或把缺失呈现改成不露馅的方案（真人头像/配图/首图/门铃视频）。

**P2（可用性/打磨）**
9. 加「返回桌面」入口（Home 指示条或手势）。
10. 短信 lastMessageTime: 0 修 1970；统一时间格式；通知横幅改用游戏内时钟。
11. 门铃 App 的章节门控改掉（ch-5 永不发生）；或直接把门铃并入终章流程。
12. 清死按钮（微信 ···/😊/＋、搜索、添加、「我」页四项、QQ 通讯录行…）或补最小反馈。

---

## 5. 本次实测已确认「能正常工作」的部分（正面结论）

- npm run build（tsc -b && vite build）**通过**，270 modules，无类型错误。
- 启动与运行全程 **0 console error / 0 uncaught exception**（多轮无头 Chrome 实测累计）。
- loadGameData() 的 Zod 全量校验通过（任一 JSON 不合契约都会在启动时抛错并显示数据加载失败）。
- **QQ 密码 20251128 实测登录成功**（输入 → 登录 → 进入 QQ 主界面，solvedPuzzleIds 记录 puzzle-qq-login）。
- **绿中校务系统 yigeyi 实测登录成功**（#/site/site-lvzhong/notice/screening/qiangzhang → 自动跳 agreement，归档 ev-lvzhong-agreement）。
- **论文上传谜题实测通过**：上传真实 paper-source-crystal.pdf（sha256 = cc5038dd…9f3，与 site-ai-pdf/manifest.ts 的 EXPECTED_PAPER_SHA256 一致）→ 跳转 result 页并归档 ev-paper-pdf。
- **真结局实测渲染成功**：拨 073188888888 → 接线员字幕 → 弹窗「必选已勾 5/5」→ 发送证据 → 「结局播报 / 真结局：成功举报 / 湖南警方破获非法人体实验案」+ 李桥瑞「兄弟，谢谢你。我欠你一条命。」，endingId: good, finished: true。
- 站点归档链实测有效：新希望新闻页 → ev-xinxwang-lab-news；经费报告页 → ev-lab-funding-report；绿中协议页 → ev-lvzhong-agreement；论文解读 → ev-paper-pdf；QQ「你同桌」会话 → ev-qq-chat-plan。
- 代码链路本身是通的——**问题不在能不能玩，而在玩家要做什么才能让它生效**。

---

## 附：本次审核的副作用

- dist/ 已重建：审核开始时 dist/assets/SiteRouter-*.js 早于 4 个源文件（src/sites/site-shanhe-med/index.tsx、src/sites/site-lvzhong/index.tsx、src/apps/PhoneApp/PhoneApp.tsx、src/sites/site-ai-pdf/index.tsx，最新一个晚 3 分钟），旧包含缺失逻辑；现 dist 与 src 一致。
- 审核用的临时探针脚本、日志与 Chrome 临时 profile 均已删除，工作区无残留。
