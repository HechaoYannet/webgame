/**
 * WechatApp/data.ts — 微信 App 本地视图辅助（迁移后）。
 *
 * 数据加载职责已迁移到 @/data/loader（getWechatThreads / getMessages / getMoments /
 * getAllArticles / getArticleById / getAllCharacters / getAllWechatContacts / getContact /
 * getWechatContact）。本文件仅保留纯视图辅助：CharacterDictionary（byId/list）+
 * displayName（Character → 显示名）。
 *
 * 不再 fetch / Zod 校验（loader 已在 main.tsx await 过，同步 getter 安全）。
 * 不修改 src/types；仅为本地视图便利。
 */
import type { Character } from "@/types";

/* ------------------------------------------------------------------ *
 * 人物字典辅助
 * ------------------------------------------------------------------ */

export interface CharacterDictionary {
  byId: Map<string, Character>;
  list: Character[];
}

export function buildCharacterDictionary(
  chars: Character[],
): CharacterDictionary {
  return {
    list: chars,
    byId: new Map(chars.map((c) => [c.id, c])),
  };
}

/** 取人物显示名（优先 displayName → name）。 */
export function displayName(c: Character | undefined): string {
  return c?.displayName ?? c?.name ?? "匿名";
}
