/**
 * src/sites/shared/pageContent.ts
 *
 * 站点取本站页面内容的唯一出口。站点禁止 import @/data/loader（那是游戏侧），
 * 故本文件直接 fetch `public/data/browser/pages/<pageId>.json` 并做轻量缓存。
 *
 * 返回的是 page JSON 的"内容子集"——仅供站点渲染用，剥离了游戏侧字段（puzzleId
 * 对应关系等由站点 manifest 管）。站点只消费 blocks + 标题 + url + 文本。
 *
 * 不做 Zod 校验（那是 loader 的职责，开发期 loader 已校验全量）。本文件只做取数。
 */
import type { PageBlock } from '@/types'

/** 站点用的页面内容（纯展示字段，无游戏语义）。 */
export interface SitePage {
  id: string
  siteId: string
  url: string
  title: string
  blocks: PageBlock[]
  /** 站点登录表单 block 声明的"登录 token"（编排层映射到 puzzleId）。站点不感知其含义。 */
  loginTokens?: string[]
}

const _cache = new Map<string, SitePage | null>()

function fetchJson(path: string): Promise<unknown> {
  // import.meta.env.BASE_URL 必须原样出现（CLAUDE.md §2，构建时静态替换）
  return fetch(`${import.meta.env.BASE_URL}${path}`).then((res) => {
    if (!res.ok) throw new Error(`[pageContent] fetch failed: ${path} → ${res.status}`)
    return res.json()
  })
}

/** 把原始 page JSON 转成 SitePage（剥离游戏字段，提取 block 里 loginForm 的 token）。 */
function toSitePage(raw: Record<string, unknown>): SitePage {
  const blocks = (raw.blocks as PageBlock[]) ?? []
  const loginTokens: string[] = []
  for (const b of blocks) {
    if (b && typeof b === 'object' && (b as { type?: string }).type === 'loginForm') {
      const tok = (b as { puzzleId?: string }).puzzleId
      if (tok) loginTokens.push(tok)
    }
  }
  return {
    id: (raw.id as string) ?? '',
    siteId: (raw.siteId as string) ?? '',
    url: (raw.url as string) ?? '',
    title: (raw.title as string) ?? '',
    blocks,
    loginTokens: loginTokens.length ? loginTokens : undefined,
  }
}

/** 取某页面（带内存缓存）。pageId 形如 page-lvzhong-home。 */
export async function getPageContent(pageId: string): Promise<SitePage | null> {
  if (_cache.has(pageId)) return _cache.get(pageId) ?? null
  try {
    const raw = (await fetchJson(`data/browser/pages/${pageId}.json`)) as Record<string, unknown>
    const page = toSitePage(raw)
    _cache.set(pageId, page)
    return page
  } catch (e) {
    console.warn('[pageContent] 取页失败', pageId, e)
    _cache.set(pageId, null)
    return null
  }
}

/** 同步取已缓存页（未加载返回 undefined）。 */
export function getCachedPageContent(pageId: string): SitePage | undefined {
  const v = _cache.get(pageId)
  return v === null ? undefined : v
}
