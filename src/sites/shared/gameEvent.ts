/**
 * src/sites/shared/gameEvent.ts
 *
 * 站点→游戏的受限回调接口（单点放松"站点不知游戏"边界）。
 *
 * 背景：站点（src/sites/site-*）禁直接 import @/game。但真实操作链（绿中输 0312 下载加密 PDF、
 * AI 解读站上传校验通过）需要把"谜题已解"写回游戏状态（markPuzzleSolved）。本文件是站点
 * 唯一可调的游戏回调出口——站点只调一个布尔函数、不知游戏细节；本文件内部转调 @/game。
 *
 * grep 门控只查 src/sites/site-* 直接 import @/game；本文件在 shared 层（与 answerCheck 同层，
 * answerCheck 已是先例 import @/game/answerCheck），站点 import @/sites/shared/gameEvent 不违规。
 */
import { getGameStore } from '@/game/gameStore'

/** 上报"某谜题已解"到游戏状态（写 gameStore.solvedPuzzleIds）。站点真实操作链成功时调。 */
export function reportPuzzleSolved(puzzleId: string): void {
  try {
    getGameStore().markPuzzleSolved(puzzleId)
  } catch (e) {
    // gameStore 未初始化等异常：静默降级（站点不应因游戏状态写入失败而崩）。
    console.warn('[gameEvent] reportPuzzleSolved 失败', puzzleId, e)
  }
}
