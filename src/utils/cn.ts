/**
 * src/utils/cn.ts
 *
 * 极简 className 拼接器（无第三方依赖）。
 * 过滤 falsy，空格连接。供所有共享 UI 使用。
 */
export type ClassValue = string | number | false | null | undefined

export function cn(...values: ClassValue[]): string {
  const out: string[] = []
  for (const v of values) {
    if (!v && v !== 0) continue
    const s = String(v).trim()
    if (s) out.push(s)
  }
  return out.join(' ')
}
