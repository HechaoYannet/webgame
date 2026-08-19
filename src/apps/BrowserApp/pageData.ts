/**
 * BrowserApp 页面数据加载器 + URL 匹配器（核心机制，CLAUDE.md §4.2 discoverableBy）。
 *
 * 纯前端、数据驱动：所有"网站"都是站内伪造页。前端只读 public/data/browser/**。
 * 不硬编码任何 URL / 密码 / 剧情文本——全部从 JSON 读。
 *
 * 三种发现方式（DiscoverableBy）：
 *   1. 公开页（accessibility.kind=public / loginRequired / linkedOnly）：url 直接命中。
 *   2. urlSuffix：隐藏页，玩家在基础 URL 后加 suffix（如 .../qiangzhang）才命中。
 *      basePageId 指向一个已知页面，其 url + suffix = 隐藏页 url。
 *   3. sourceCodeComment：隐藏页，其地址藏在某页 sourceComment block 的 HTML 注释里；
 *      玩家在该页点"查看源代码"看到注释 → 输入注释里的 URL 才命中。
 *   4. search：伪造百度搜索，读 search-index.json 倒排索引，关键词命中返回结果页。
 */
import { z } from "zod";
import type {
  DiscoverableBy,
  PageBlock,
  PageId,
  Site,
  WebPage,
} from "@/types";

// ===== Zod schemas（与 src/types/index.ts §6 / docs/engineering/SCHEMA.md §6 对齐）=====
const pageAccessibilitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("public") }),
  z.object({
    kind: z.literal("hidden"),
    discoverFrom: z.string(),
    hint: z.string(),
  }),
  z.object({
    kind: z.literal("loginRequired"),
    puzzleId: z.string(),
  }),
  z.object({
    kind: z.literal("linkedOnly"),
    fromPageId: z.string(),
  }),
]);

// PageBlock 的 zod：用 z.custom 因联合里含字面量 type，且 form/loginForm 等带额外字段。
// 这里只做结构最小校验，详细联合校验交给运行时渲染（types 已保证编译期）。
const pageBlockSchema: z.ZodType<PageBlock> = z.custom<PageBlock>(
  (v): v is PageBlock =>
    typeof v === "object" && v !== null && typeof (v as { type?: unknown }).type === "string",
);

const discoverableBySchema: z.ZodType<DiscoverableBy> = z.custom<DiscoverableBy>(
  (v): v is DiscoverableBy =>
    typeof v === "object" && v !== null && typeof (v as { type?: unknown }).type === "string",
);

const webPageSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  url: z.string(),
  title: z.string(),
  accessibility: pageAccessibilitySchema,
  blocks: z.array(pageBlockSchema),
  discoverableBy: z.array(discoverableBySchema).optional(),
  registersClueId: z.string().optional(),
  triggersEvidenceId: z.string().optional(),
  containsAssetId: z.string().optional(),
  assetRequiresPuzzleId: z.string().optional(),
  onViewEffects: z.array(z.custom()).optional(),
});

const siteSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string(),
  pages: z.array(z.string()),
});

const searchIndexSchema = z.array(
  z.object({ keyword: z.string(), pageIds: z.array(z.string()) }),
);

// ===== 缓存（一次会话内不变）=====
let sitesCache: Site[] | null = null;
let searchIndexCache: { keyword: string; pageIds: PageId[] }[] | null = null;
const pageCache = new Map<PageId, WebPage>();

const DATA_BASE = import.meta.env.BASE_URL + "data/browser/";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return (await res.json()) as T;
}

/** 加载 sites.json（站点清单 + baseUrl + 页面 ID 列表）。 */
export async function loadSites(): Promise<Site[]> {
  if (sitesCache) return sitesCache;
  const raw = await fetchJson<unknown>(DATA_BASE + "sites.json");
  const parsed = z.array(siteSchema).parse(raw);
  sitesCache = parsed;
  return parsed;
}

/** 加载 search-index.json（百度搜索倒排索引）。 */
export async function loadSearchIndex(): Promise<
  { keyword: string; pageIds: PageId[] }[]
> {
  if (searchIndexCache) return searchIndexCache;
  const raw = await fetchJson<unknown>(DATA_BASE + "search-index.json");
  const parsed = searchIndexSchema.parse(raw);
  searchIndexCache = parsed;
  return parsed;
}

/** 按 pageId 加载单个页面 JSON（pages/<pageId>.json），带 zod 校验 + 缓存。 */
export async function loadPage(pageId: PageId): Promise<WebPage> {
  const cached = pageCache.get(pageId);
  if (cached) return cached;
  const raw = await fetchJson<unknown>(DATA_BASE + `pages/${pageId}.json`);
  const parsed = webPageSchema.parse(raw) as WebPage;
  pageCache.set(pageId, parsed);
  return parsed;
}

/**
 * 把玩家"裸 URL"归一化：去 protocol / 去末尾斜杠 / 小写 host。
 * 例：https://www.lvzhong-edu.cn/ → www.lvzhong-edu.cn
 *     https://www.lvzhong-edu.cn/notice/screening/qiangzhang → www.lvzhong-edu.cn/notice/screening/qiangzhang
 *     www.baidu.com/s?wd=绿草中学 → www.baidu.com/s?wd=绿草中学
 */
export function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!u) return "";
  // 补协议让 URL 可解析（搜索结果可能没带 http）
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const parsed = new URL(u);
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    const host = parsed.hostname.toLowerCase();
    let out = host + path;
    if (parsed.search) out += parsed.search;
    return out;
  } catch {
    // 非 URL（如纯关键词），原样返回去小写化
    return u;
  }
}

/**
 * 是否百度搜索请求：玩家在地址栏输入 baidu.com 或 baidu.com/s?wd=xxx。
 * 命中→走伪造搜索而非 url 匹配。
 */
export function isBaiduSearch(normalized: string): boolean {
  return /^www\.baidu\.com(\/s.*)?$/.test(normalized) || normalized === "www.baidu.com";
}

/**
 * 从百度 URL 抽查询词（?wd=... 或纯关键词 fallback）。
 */
export function extractBaiduQuery(rawInput: string): string {
  const m = rawInput.match(/[?&]wd=([^&]+)/);
  if (m) return decodeURIComponent(m[1]);
  // 玩家直接在 baidu.com 后接关键词的情况
  const after = rawInput.split("baidu.com")[1] ?? "";
  return after.replace(/[/?]/g, "").trim();
}

/**
 * URL 匹配器核心：在已加载 sites/pages 范围内，找与 normalizedUrl 对应的页面。
 *
 * 匹配顺序（数据驱动）：
 *   1. 精确匹配某页 url（公开/登录后/链接进入页都走这里）。
 *   2. urlSuffix 隐藏页：若某页 discoverableBy 含 urlSuffix，则当
 *      normalizeUrl(basePage.url + suffix) === normalizedUrl 时命中。
 *   3. sourceCodeComment 隐藏页：玩家点了"查看源代码"看到注释里的 URL，再把它输进地址栏——
 *      这其实也是精确匹配（注释里写的 URL == 该页 url）。此处不需特殊逻辑，
 *      仅在 view-source 侧暴露注释文本。
 *
 * 返回命中页面 + 通过哪种方式命中（用于提示 UI）。
 */
export type UrlMatch =
  | { kind: "page"; page: WebPage; via: "direct" | "urlSuffix" }
  | { kind: "notFound" };

export async function matchUrl(
  normalizedUrl: string,
): Promise<UrlMatch> {
  if (!normalizedUrl) return { kind: "notFound" };

  const sites = await loadSites();
  // 1. 精确匹配
  for (const site of sites) {
    for (const pageId of site.pages) {
      const page = await loadPage(pageId);
      if (normalizeUrl(page.url) === normalizedUrl) {
        return { kind: "page", page, via: "direct" };
      }
    }
  }

  // 2. urlSuffix 隐藏页：basePage.url + suffix
  for (const site of sites) {
    for (const pageId of site.pages) {
      const page = await loadPage(pageId);
      const suffixEntry = page.discoverableBy?.find(
        (d): d is Extract<DiscoverableBy, { type: "urlSuffix" }> =>
          d.type === "urlSuffix",
      );
      if (!suffixEntry) continue;
      const basePage = await loadPage(suffixEntry.basePageId);
      const composite = normalizeUrl(basePage.url + suffixEntry.suffix);
      if (composite === normalizedUrl) {
        return { kind: "page", page, via: "urlSuffix" };
      }
    }
  }

  return { kind: "notFound" };
}

/**
 * 伪造百度搜索：在 search-index.json 倒排索引中找包含 query 的关键词，
 * 去重聚合对应 pageIds。命中 0 条也返回空数组（渲染"无结果"）。
 */
export async function baiduSearch(query: string): Promise<PageId[]> {
  const index = await loadSearchIndex();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits = new Set<PageId>();
  for (const entry of index) {
    if (entry.keyword.toLowerCase().includes(q) || q.includes(entry.keyword.toLowerCase())) {
      for (const pid of entry.pageIds) hits.add(pid);
    }
  }
  return Array.from(hits);
}

/**
 * 返回某页"查看源代码"应展示的注释文本（页面 blocks 里所有 sourceComment 的 comment）。
 * 藏后台地址等线索用（校长信箱 / 实验室官网）。仅 sourceComment 块出现，其它块在源码视图里隐藏。
 */
export function extractSourceComments(page: WebPage): string[] {
  return page.blocks
    .filter((b): b is Extract<PageBlock, { type: "sourceComment" }> => b.type === "sourceComment")
    .map((b) => b.comment);
}
