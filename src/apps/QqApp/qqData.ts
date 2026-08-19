/**
 * src/apps/QqApp/qqData.ts
 *
 * QQ App 数据访问层（frontend-qq 独占）。
 * 优先使用 src/data/loader.ts 的缓存索引（CLAUDE.md §4：数据即契约）。
 * loader 的同步查询 API 需先 `await loadGameData()`，故 QqApp 顶层负责加载，
 * 子组件按需调用同步 getter 与异步 getMessages。
 *
 * group-files.json 是 writer-qq 的自描述结构（src/types 未收录），loader 无对应
 * getter，故直接 `fetch(import.meta.env.BASE_URL + ...)`（CLAUDE.md §2：
 * import.meta.env.BASE_URL 必须原样出现）。
 */
import type { ContactId, QqContact } from '@/types'

// ===== group-files.json 本地类型（writer-qq 自描述 schema，不在 src/types）=====
export interface QqGroupFile {
  id: string
  name: string
  uploaderCharacterId: ContactId
  uploadedAt: string
  type: 'pdf' | 'xlsx' | 'image' | 'link'
  sizeKB: number
  relatePageId?: string
  assetId?: string
  link?: { title?: string; url?: string }
  note?: string
  registersClueId?: string
}
export interface QqGroupFileGroup {
  threadId: string
  title: string
  files: QqGroupFile[]
}
export interface QqGroupFilesData {
  groups: QqGroupFileGroup[]
}

/** import.meta.env.BASE_URL 原样出现（CLAUDE.md §2）。 */
export async function loadGroupFiles(): Promise<QqGroupFilesData> {
  const res = await fetch(import.meta.env.BASE_URL + 'data/qq/group-files.json')
  if (!res.ok) throw new Error(`[QqApp] fetch group-files failed: ${res.status}`)
  return (await res.json()) as QqGroupFilesData
}

/**
 * 群聊 participantCharacterIds 的"对方"：群聊 contact.json 用群 characterId（如
 * char-yanxinze 用于高二一班级群）作占位，真正的群标题在 thread.title。这里取
 * 非玩家(李桥瑞)的第一个 participant 作头像命名 fallback。
 */
export function contactLabel(qc: QqContact | undefined): string {
  if (!qc) return ''
  return qc.qqRemark || qc.qqNickname
}
