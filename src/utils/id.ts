/**
 * src/utils/id.ts
 *
 * 稳定 ID / 通用 uid 工具（frontend-phone-shell自有，CLAUDE.md §4.2）。
 * 仅用于运行态临时 ID（通知队列项 key、React key 兜底等），
 * 不生成跨 agent 耦合的剧情 ID（剧情 ID 全在 data/*.json，前端只读消费）。
 */

/** 拼接前缀的随机短 id，保证同页 key 唯一。 */
export function uid(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 10)
  const time = Date.now().toString(36).slice(-4)
  return `${prefix}-${time}${rand}`
}

/** 把任意字符串规范化为短 slug（用于兜底 key，不用于剧情 ID 生成）。 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'item'
}

/**
 * 从可能为 undefined 的对象里按 key 取值，
 * 提供 fallback。小工具避免散落的 `??`。
 */
export function pick<T>(obj: Record<string, T> | undefined, key: string, fallback: T): T {
  if (obj && key in obj) return obj[key]
  return fallback
}
