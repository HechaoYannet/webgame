/**
 * src/apps/QqApp/qqConstants.ts — QqApp 本地常量（frontend-qq 独占）。
 *
 * 这不是 engine 桥接层。QQ 登录 / PDF 解密校验全部走真值引擎 hook
 * `usePuzzle(puzzleId).submit(value)`（@/engine/hooks/usePuzzle），答案 0328 / 0312
 * 不在前端硬编码，由 puzzles.json + engine/puzzle 校验（CLAUDE.md §4 + §6.1）。
 *
 * 此处只承载稳定 ID 字面量（CLAUDE.md §4.2 命名约定允许在代码中以字面量引用稳定 ID）。
 * 原桥接文件 qqEngine.ts 已删除，engine hooks 直接各组件自行 from '@/engine/hooks/*'。
 */

/** QQ 登录谜题 ID（oneOf 容错 0328 / 20260328，CLAUDE.md §6.1）。 */
export const PUZZLE_QQ_LOGIN = 'puzzle-qq-login'
/** 心理筛查 PDF 解密谜题 ID（答案 0312 在 puzzles.json，engine 校验）。 */
export const PUZZLE_PDF_SCREENING = 'puzzle-pdf-screening'
