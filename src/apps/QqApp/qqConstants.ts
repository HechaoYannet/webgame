/**
 * src/apps/QqApp/qqConstants.ts — QqApp 本地常量（frontend-qq 独占）。
 *
 * 这不是引擎桥接层。QQ 登录 / PDF 解密校验全部走 @/game/answerCheck 的 checkAnswer
 * （答案 20251128 / 0312 不在前端硬编码，由 puzzles.json + answerCheck 校验，CLAUDE.md §4 + §6.1）。
 *
 * 此处只承载稳定 ID 字面量（CLAUDE.md §4.2 命名约定允许在代码中以字面量引用稳定 ID）。
 */

/** QQ 登录谜题 ID（oneOf 容错 20251128 / 1128，CLAUDE.md §6.1）。 */
export const PUZZLE_QQ_LOGIN = 'puzzle-qq-login'
/** 心理筛查 PDF 解密谜题 ID（答案 0312 在 puzzles.json，@/game/answerCheck 校验）。 */
export const PUZZLE_PDF_SCREENING = 'puzzle-pdf-screening'
