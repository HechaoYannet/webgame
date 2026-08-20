/**
 * src/sites/shared/answerCheck.ts
 *
 * 站点唯一可用的"游戏接口"：登录表单校验。
 *
 * 站点代码（src/sites/<siteId>/**）禁止 import @/game、@/engine、@/data/loader。
 * 本文件是它们接触"密码校验"的唯一出口——一个布尔函数。站点不需要知道密码、
 * 不需要知道 puzzleId 语义，编排层把 puzzleId 接好注入。
 *
 * 用法（站点登录表单）：
 *   const ok = await checkLogin(inputPassword)
 *   if (ok) navigate('/admin/...')
 */
import { checkAnswer, type PuzzleInput } from '@/game/answerCheck'

/** 校验登录输入是否正确。返回 true=登录通过（站点据此揭示后台页）。无副作用。 */
export function checkLogin(puzzleId: string, input: PuzzleInput): boolean {
  return checkAnswer(puzzleId, input)
}
