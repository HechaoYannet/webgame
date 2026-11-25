/**
 * src/sites/shared/siteRegistry.ts
 *
 * 全站 pageId → 站内路由 的聚合表（各站 manifest 的 pageRoutes 由本文件统一汇总）。
 *
 * 为什么需要它：站点之间必须解耦（站点不得 import 另一个站点的 index/数据），
 * 但"搜索结果深链"（百度 → 实验室后台 / 论文详情）与"跨站内容链接"
 * （论文发表 → 预印本论文库）天然需要知道别的页面的地址。
 * 解法：各站 manifest 只声明**自己**的 pageId→路由；本文件在 shared 层
 * 用 import.meta.glob 汇总成一张只读表，站点与 site-baidu 都从这张表取地址，
 * 不产生站点之间的直接依赖。
 *
 * 路由形态统一为浏览器路由路径（不含 '#'）：/site/<siteId>/<站内路径>。
 * 生成外链（新标签）时再拼 import.meta.env.BASE_URL 与 '#'。
 */
import type { PageId } from '@/types'

interface RouteLike {
  pageId?: string
  path?: string
  slug?: string
}

interface ManifestLike {
  siteId?: string
  name?: string
  pageRoutes?: RouteLike[]
}

interface ManifestModule {
  manifest?: ManifestLike
  default?: ManifestLike
}

export interface SiteRouteInfo {
  siteId: string
  /** 站内相对路径（首页为空串）。 */
  path: string
}

// 各站 manifest 静态聚合（改动 manifest 即改动本表，无需再维护第二份映射）。
const manifestModules = import.meta.glob<ManifestModule>('../*/manifest.ts', { eager: true })

const pageRoutes = new Map<string, SiteRouteInfo>()
const siteNames = new Map<string, string>()

for (const mod of Object.values(manifestModules)) {
  const manifest = mod.manifest ?? mod.default
  if (!manifest?.siteId) continue
  if (manifest.name) siteNames.set(manifest.siteId, manifest.name)
  for (const route of manifest.pageRoutes ?? []) {
    if (!route?.pageId) continue
    pageRoutes.set(route.pageId, {
      siteId: manifest.siteId,
      // 各站历史命名不一：path（arxiv/ai-pdf/tianyancha…）或 slug（lvzhong/xinxwang/news…）
      path: route.path ?? route.slug ?? '',
    })
  }
}

/** 取页面所属站点与站内路径（未登记返回 undefined）。 */
export function getSiteRouteByPageId(pageId: PageId | string): SiteRouteInfo | undefined {
  return pageRoutes.get(pageId)
}

/** 取站点的展示名（搜索结果的"来源站点"用）。 */
export function getSiteNameById(siteId: string): string | undefined {
  return siteNames.get(siteId)
}

/** 站点根路由路径 /site/<siteId>。 */
export function getSiteRootPath(siteId: string): string {
  return '/site/' + siteId
}

/**
 * 页面 → 浏览器路由路径（/site/<siteId>/<path>）。未登记时回退到站点根。
 */
export function getRouterPathByPageId(pageId: PageId | string, fallbackSiteId?: string): string | undefined {
  const route = pageRoutes.get(pageId)
  if (route) {
    const suffix = route.path ? '/' + route.path.replace(/^\/+/, '') : ''
    return getSiteRootPath(route.siteId) + suffix
  }
  return fallbackSiteId ? getSiteRootPath(fallbackSiteId) : undefined
}

/**
 * 页面 → 可直接用于 window.open 的完整站内 URL（<base>#/site/<siteId>/<path>）。
 * 注意 import.meta.env.BASE_URL 必须原样出现（Vite 构建时静态替换）。
 */
export function getSitePageUrl(pageId: PageId | string, fallbackSiteId?: string): string | undefined {
  const path = getRouterPathByPageId(pageId, fallbackSiteId)
  if (!path) return undefined
  return import.meta.env.BASE_URL + '#' + path
}
