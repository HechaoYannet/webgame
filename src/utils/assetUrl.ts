/**
 * src/utils/assetUrl.ts
 *
 * 静态资源 URL 解析（统一入口）。
 *
 * 历史问题：public/data 里的 assetId 一律不带文件扩展名（如 "photo-campus-backwall"），
 * 而 public/assets 下的真实文件带扩展名（photo-campus-backwall.png）。旧实现直接拼
 * "assets/<assetId>" 导致所有图片/音频 404 → 全站灰框占位（"网站不真实"主因）。
 *
 * 本模块提供"候选 URL 序列"：先试原样（支持 assetId 自带扩展名，如
 * paper-source-crystal.pdf），失败再依序试常见扩展名。调用方（PlaceholderImage /
 * MomentsTab 图片网格 / audio.ts）用 onError 依序推进即可。
 *
 * 只做路径计算，不做网络请求。import.meta.env.BASE_URL 必须原样出现（CLAUDE.md §2）。
 */

const IMAGE_EXTS = ['', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']
const MEDIA_EXTS = ['', '.mp3', '.mp4', '.webm', '.ogg', '.wav']

function base(): string {
  return import.meta.env.BASE_URL
}

/** 图片类 assetId → 候选 URL 列表（按优先级）。 */
export function imageUrlCandidates(assetId: string): string[] {
  const out: string[] = []
  for (const ext of IMAGE_EXTS) out.push(base() + "assets/" + assetId + ext)
  return out
}

/** 音频/视频类 assetId → 候选 URL 列表（按优先级）。 */
export function mediaUrlCandidates(assetId: string): string[] {
  const out: string[] = []
  for (const ext of MEDIA_EXTS) out.push(base() + "assets/" + assetId + ext)
  return out
}

/** 首选 URL（与旧行为一致：assetId 原样拼接）。 */
export function assetUrl(assetId: string): string {
  return base() + "assets/" + assetId
}
