/**
 * WechatApp/WechatApp.tsx — 微信 App 主入口
 *
 * - 底部 Tab：聊天 / 朋友圈 / 公众号 / 通讯录（交互设计 §二）。
 * - 启动时一次性加载 meta/characters.json（人物反查，供各 Tab 复用）。
 * - 挂载 useEngineBridge 监听引擎回推。
 *
 * 技术栈（CLAUDE.md §2）：React + TS；HashRouter 路由由 PhoneShell 的 AppRouter 管，
 * 本组件只渲染内容；import.meta.env.BASE_URL 在 data.ts 中原样出现。
 */
import { useEffect, useState } from "react";
import type { Character } from "@/types";
import { loadCharacters } from "./data";
import "./WechatApp.css";
import { useEngineBridge } from "./wechatEngine";
import { ChatTab } from "./ChatTab";
import { MomentsTab } from "./MomentsTab";
import { OfficialTab } from "./OfficialTab";
import { ContactsTab } from "./ContactsTab";

type TabKey = "chat" | "moments" | "official" | "contacts";

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "chat", label: "聊天", icon: "💬" },
  { key: "moments", label: "朋友圈", icon: "🌟" },
  { key: "official", label: "公众号", icon: "📰" },
  { key: "contacts", label: "通讯录", icon: "👥" },
];

export default function WechatApp(): JSX.Element {
  useEngineBridge();
  const [tab, setTab] = useState<TabKey>("chat");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [charsError, setCharsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCharacters()
      .then((c) => {
        if (!cancelled) setCharacters(c);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setCharsError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="wc-app">
      <div className="wc-app-body">
        {charsError && (
          <div className="wc-app-warn">人物加载失败：{charsError}</div>
        )}
        {tab === "chat" && <ChatTab characters={characters} />}
        {tab === "moments" && <MomentsTab characters={characters} />}
        {tab === "official" && <OfficialTab characters={characters} />}
        {tab === "contacts" && <ContactsTab characters={characters} />}
      </div>
      <nav className="wc-tabbar" aria-label="微信底部导航">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`wc-tabbar-item${tab === t.key ? " is-active" : ""}`}
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
          >
            <span className="wc-tabbar-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span className="wc-tabbar-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
