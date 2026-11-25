/**
 * WechatApp/WechatApp.tsx — 微信 App 主入口
 *
 * - 底部 Tab：微信 / 公众号 / 发现 / 我（WeChat 风格）。
 * - 启动时 await loadGameData()（loader 幂等缓存），保证同步 getter 安全；
 *   人物通过 @/data/loader getAllCharacters() 同步取（main.tsx 已 await 过）。
 * - 挂载 useEngineBridge（重写后 no-op，保留调用面）。
 *
 * 技术栈（CLAUDE.md §2）：React + TS；HashRouter 路由由 PhoneShell 的 AppRouter 管，
 * 本组件只渲染内容；import.meta.env.BASE_URL 在 loader 内部出现。
 */
import { useEffect, useState } from "react";
import type { Character } from "@/types";
import { getAllCharacters, loadGameData } from "@/data/loader";
import "./WechatApp.css";
import { useEngineBridge } from "./wechatEngine";
import { ChatTab } from "./ChatTab";
import { ContactsTab } from "./ContactsTab";
import { MomentsTab } from "./MomentsTab";
import { OfficialTab } from "./OfficialTab";
import { ProfileTab } from "./ProfileTab";

type TabKey = "chat" | "contacts" | "official" | "discover" | "me";

interface TabDef {
  key: TabKey;
  label: string;
  /** SVG icon as JSX (uses currentColor for active state). */
  icon: JSX.Element;
}

/* SVG tab icons — clean outlines matching WeChat design. */
function TabIconChat(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

// 通讯录 Tab：此前 ContactsTab 已写好但没有任何地方渲染，wechat/contacts.json
// 因此完全无人消费（审核报告第 3 节列的死内容）。补回真机 WeChat 的通讯录页。
function TabIconContacts(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20v-1.5A4.5 4.5 0 017 14h4a4.5 4.5 0 014.5 4.5V20" />
      <path d="M16.5 5.2a3.5 3.5 0 010 6M18.5 20v-1.5a4.5 4.5 0 00-2.2-3.85" />
    </svg>
  );
}

function TabIconOfficial(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="7" y1="9" x2="17" y2="9" />
      <line x1="7" y1="13" x2="17" y2="13" />
      <line x1="7" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function TabIconDiscover(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function TabIconMe(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2" />
    </svg>
  );
}

const TABS: TabDef[] = [
  { key: "chat", label: "微信", icon: <TabIconChat /> },
  { key: "contacts", label: "通讯录", icon: <TabIconContacts /> },
  { key: "official", label: "公众号", icon: <TabIconOfficial /> },
  { key: "discover", label: "发现", icon: <TabIconDiscover /> },
  { key: "me", label: "我", icon: <TabIconMe /> },
];

export default function WechatApp(): JSX.Element {
  useEngineBridge();
  const [tab, setTab] = useState<TabKey>("chat");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [charsError, setCharsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // loader 幂等：loadGameData main.tsx 已 await 过，这里再 await 确保同步 getter 安全，
    // 然后同步读 characters 快照。
    loadGameData()
      .then(() => {
        if (cancelled) return;
        try {
          setCharacters(getAllCharacters());
          setCharsError(null);
        } catch (e: unknown) {
          setCharsError(e instanceof Error ? e.message : String(e));
        }
      })
      .catch((e: unknown) => {
        if (cancelled)
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
        {tab === "contacts" && <ContactsTab characters={characters} />}
        {tab === "official" && <OfficialTab characters={characters} />}
        {tab === "discover" && <MomentsTab characters={characters} />}
        {tab === "me" && <ProfileTab characters={characters} />}
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