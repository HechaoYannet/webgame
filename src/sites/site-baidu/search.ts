/**
 * site-baidu 搜索数据层。
 *
 * 自行 fetch 两份 JSON（不经游戏 loader，本站与游戏系统完全解耦）：
 *  - data/browser/search-index.json：关键词到 pageId 列表的索引。
 *  - data/browser/sites.json：站点清单（含 id / name / baseUrl / pages），
 *    据此建 pageId 到 siteId 的反查表，供结果点击在新标签打开对应站点根。
 *
 * 模糊匹配策略：大小写不敏感，查询串与索引 keyword 互相包含即命中。
 * 命中的 pageId 去重保序，组合成结果条目。
 *
 * 深链：sites.json 只给"站有哪些 page"，具体 pageId → 站内路径由
 * shared/siteRegistry（各站 manifest 的 pageRoutes 汇总）提供；结果点击因此能
 * 直达命中页面（如 lab.shanhe-med.cn → 实验室后台登录），而不是永远落到站点首页。
 */
import { getRouterPathByPageId, getSiteRouteByPageId } from '@/sites/shared/siteRegistry'

export interface SearchIndexEntry {
  keyword: string
  pageIds: string[]
}

export interface SiteRecord {
  id: string
  name: string
  baseUrl: string
  pages: string[]
}

export interface SearchResult {
  pageId: string
  siteId: string
  siteName: string
  baseUrl: string
  matchedKeyword: string
  /** 命中页面的站内路由路径（/site/<siteId>/<path>）；未登记时回退站点根。 */
  routePath: string
  /** 命中页面的站内路径（相对站点根的 slug，首页为空串），用于展示完整网址。 */
  pagePath: string
}

let indexCache: SearchIndexEntry[] | null = null
let sitesCache: SiteRecord[] | null = null
let pageToSite: Map<string, string> | null = null
let pageToSiteName: Map<string, string> | null = null
let pageToBaseUrl: Map<string, string> | null = null

function requireBase(): string {
  // import.meta.env.BASE_URL 必须原样出现（构建时静态替换）
  return import.meta.env.BASE_URL
}

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(requireBase() + path)
  if (!res.ok) throw new Error(`[site-baidu] fetch 失败：${path} → ${res.status}`)
  return res.json()
}

async function ensureIndex(): Promise<SearchIndexEntry[]> {
  if (indexCache) return indexCache
  indexCache = (await fetchJson('data/browser/search-index.json')) as SearchIndexEntry[]
  return indexCache
}

async function ensureSites(): Promise<SiteRecord[]> {
  if (sitesCache) return sitesCache
  sitesCache = (await fetchJson('data/browser/sites.json')) as SiteRecord[]
  pageToSite = new Map()
  pageToSiteName = new Map()
  pageToBaseUrl = new Map()
  for (const s of sitesCache) {
    for (const pid of s.pages) {
      pageToSite.set(pid, s.id)
      pageToSiteName.set(pid, s.name)
      pageToBaseUrl.set(pid, s.baseUrl)
    }
  }
  return sitesCache
}

/** 执行模糊搜索，返回去重保序的结果列表。空查询返回空数组。 */
export async function search(query: string): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []
  await Promise.all([ensureIndex(), ensureSites()])
  const index = indexCache ?? []
  const pToSite = pageToSite
  const pToSiteName = pageToSiteName
  const pToBaseUrl = pageToBaseUrl
  const seen = new Set<string>()
  const out: SearchResult[] = []
  for (const entry of index) {
    const kw = entry.keyword.toLowerCase()
    const hit = kw.includes(q) || q.includes(kw)
    if (!hit) continue
    for (const pid of entry.pageIds) {
      if (seen.has(pid)) continue
      const sid = pToSite?.get(pid)
      if (!sid) continue
      seen.add(pid)
      const route = getSiteRouteByPageId(pid)
      out.push({
        pageId: pid,
        siteId: sid,
        siteName: pToSiteName?.get(pid) ?? sid,
        baseUrl: pToBaseUrl?.get(pid) ?? '',
        matchedKeyword: entry.keyword,
        routePath: getRouterPathByPageId(pid, sid) ?? '/site/' + sid,
        pagePath: route?.path ?? '',
      })
    }
  }
  return out
}

/** 构造站点根的新标签 URL：BASE_URL 拼上井号斜杠 site 斜杠 siteId。 */
export function siteRootUrl(siteId: string): string {
  return `${requireBase()}#/site/${siteId}`
}

/** 数据是否已就绪（用于首页预热，避免首次搜索卡顿）。 */
export async function warmup(): Promise<void> {
  await Promise.all([ensureIndex(), ensureSites()])
}
