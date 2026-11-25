/**
 * src/sites/shared/gameEvent.ts
 *
 * 站点→游戏的受限回调接口（单点放松"站点不知游戏"边界）。
 *
 * 背景：站点（src/sites/site-*）禁直接 import @/game、@/utils。但真实操作链需要把
 * "谜题已解""已查看某页"写回游戏状态（markPuzzleSolved / collectEvidence / 终局倒计时）。
 * 本文件是站点唯一可调的游戏回调出口——站点只调语义化函数、不知游戏细节；
 * 本文件内部转调 @/game 与 @/utils/shellState。
 *
 * 门控说明：grep 只查 src/sites/site-* 直接 import @/game；本文件在 shared 层
 * （与 answerCheck 同层），站点 import @/sites/shared/gameEvent 不违规。
 */
import { getGameStore } from '@/game/gameStore'
import { collectEvidence } from '@/game/evidence'

/** 上报"某谜题已解"到游戏状态（写 gameStore.solvedPuzzleIds）。站点真实操作链成功时调。 */
export function reportPuzzleSolved(puzzleId: string): void {
  try {
    getGameStore().markPuzzleSolved(puzzleId)
  } catch (e) {
    console.warn("[gameEvent] reportPuzzleSolved 失败", puzzleId, e)
  }
}

/** 上报"已收集某证据"（查看关键内容自动归档；幂等）。 */
export function reportEvidenceCollected(evidenceId: string): void {
  try {
    collectEvidence(evidenceId as never)
  } catch (e) {
    console.warn("[gameEvent] reportEvidenceCollected 失败", evidenceId, e)
  }
}

/**
 * 上报"已查看某页面"。游戏侧按 pageId 决定副作用（证据归档 / 终局倒计时等）。
 * 站点不知道这些语义，只上报"我看过了哪页"。幂等由游戏侧保证。
 */
export function reportPageViewed(pageId: string): void {
  try {
    applyPageEffect(pageId)
  } catch (e) {
    console.warn("[gameEvent] reportPageViewed 失败", pageId, e)
  }
  beginPageActivity(pageId)
}

// ===== 站点停留心跳（供手机侧 idleOnPage 短信触发）=====
// 站点在新标签页，手机侧无法直接感知"玩家在某页停留了多久"。这里把当前页写入
// 同源 localStorage 并每 5s 刷新时间戳；手机标签页的 watchSiteIdleSms 读到
// "同一 pageId 连续 N 秒且心跳未过期" 时投递 sms.json 里 idleOnPage 的短信。
// 关闭/刷新站点标签页时清除心跳，避免误判为仍在停留。
const SITE_ACTIVITY_KEY = 'webgame-site-activity'
let _activityPageId: string | null = null
let _activityTimer: ReturnType<typeof setInterval> | null = null
let _unloadBound = false

function writeActivityHeartbeat(): void {
  if (!_activityPageId) return
  try {
    localStorage.setItem(SITE_ACTIVITY_KEY, JSON.stringify({ pageId: _activityPageId, at: Date.now() }))
  } catch {
    // localStorage 不可用时静默降级（idle 触发依赖它，不影响页面本身）
  }
}

function beginPageActivity(pageId: string): void {
  if (typeof window === 'undefined') return
  if (_activityPageId !== pageId) {
    _activityPageId = pageId
    writeActivityHeartbeat()
  }
  if (_activityTimer === null) {
    _activityTimer = window.setInterval(writeActivityHeartbeat, 5000)
  }
  if (!_unloadBound) {
    _unloadBound = true
    window.addEventListener('pagehide', () => {
      try {
        localStorage.removeItem(SITE_ACTIVITY_KEY)
      } catch {
        // ignore
      }
    })
  }
}

/** 页面 → 游戏副作用映射（与 public/data/browser/pages/*.json 的 pageId 对齐）。 */
function applyPageEffect(pageId: string): void {
  switch (pageId) {
    case 'page-lvzhong-agreement':
      // 绿中内部系统合作协议（需 zhangqiang 登录后可见）
      collectEvidence('ev-lvzhong-agreement')
      break
    case 'page-xinxwang-news-lab':
      // 新希望官网新闻《我中心与山河医科大实验室签署合作协议》
      collectEvidence('ev-xinxwang-lab-news')
      break
    case 'page-ai-interpret':
      // AI 解读结果页（上传论文校验通过后到达）
      collectEvidence('ev-paper-pdf')
      break
    case 'page-lab-funding-report':
      // 经费报告：只归档证据。终章倒计时/威胁短信/门铃改由「手机标签页」侧启动——
      // 站点在新标签页打开、不渲染 PhoneShell，若在这里触发，玩家手机上看不到任何
      // 压迫感（审核报告 E2E-3）。手机侧监听 collectedEvidenceIds 变化后启动。
      collectEvidence('ev-lab-funding-report')
      break
    case 'page-lab-subject-list':
      // 实验室后台系统日志页承载 ev-lab-upload-log（第 6 项补强证据）。
      // 此前没有任何 pageId 映射到它，该证据永远拿不到（审核报告 E2E-6）。
      collectEvidence('ev-lab-upload-log')
      break
    default:
      break
  }
}
