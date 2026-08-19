/**
 * WechatApp/ContactsTab.tsx — 通讯录 Tab
 *
 * 读 wechat/contacts.json 按 characters 反查信息，按字母/星标排序展示；
 * 点击联系人可发起会话跳转（通过回调上抛）。失联联系人灰显并标注状态。
 */
import { useMemo, useState } from "react";
import type { Character, WechatContact } from "@/types";
import { Avatar } from "./Avatar";
import {
  buildCharacterDictionary,
  displayName,
  loadWechatContacts,
  type CharacterDictionary,
} from "./data";
import { useEffect } from "react";

export interface ContactsTabProps {
  characters: Character[];
  onOpenThread?: (threadId?: string, characterId?: string) => void;
}

export function ContactsTab({
  characters,
}: ContactsTabProps): JSX.Element {
  const [contacts, setContacts] = useState<WechatContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dict = useMemo(
    () => buildCharacterDictionary(characters),
    [characters],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadWechatContacts()
      .then((c) => {
        if (!cancelled) setContacts(c);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 排序：星标高在前，公众号在后，其余按昵称拼音/字符序
  const sorted = useMemo(() => {
    return [...contacts].sort((a, b) => {
      if (!!a.isOfficialAccount !== !!b.isOfficialAccount) {
        return a.isOfficialAccount ? 1 : -1;
      }
      const sa = a.starValue ?? 0;
      const sb = b.starValue ?? 0;
      if (sa !== sb) return sb - sa;
      return (a.wechatRemark || a.wechatNickname).localeCompare(
        b.wechatRemark || b.wechatNickname,
        "zh-Hans-CN",
      );
    });
  }, [contacts]);

  const official = sorted.filter((c) => c.isOfficialAccount);
  const persons = sorted.filter((c) => !c.isOfficialAccount);

  return (
    <div className="wc-contacts-tab">
      <header className="wc-header">
        <div className="wc-header-titles">
          <div className="wc-header-title">通讯录</div>
        </div>
      </header>
      {loading && <div className="wc-empty">加载中…</div>}
      {!loading && error && (
        <div className="wc-empty wc-error">加载失败：{error}</div>
      )}
      {!loading && !error && (
        <div className="wc-contacts-body">
          <ContactSection
            title={`联系人（${persons.length}）`}
            contacts={persons}
            dict={dict}
          />
          {official.length > 0 && (
            <ContactSection
              title={`公众号（${official.length}）`}
              contacts={official}
              dict={dict}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ContactSection({
  title,
  contacts,
  dict,
}: {
  title: string;
  contacts: WechatContact[];
  dict: CharacterDictionary;
}): JSX.Element {
  return (
    <section className="wc-contact-section">
      <h3 className="wc-contact-section-title">{title}</h3>
      <ul className="wc-contact-list">
        {contacts.map((c, i) => {
          const ch = dict.byId.get(c.characterId);
          const label = c.wechatRemark || c.wechatNickname;
          const grey = c.status === "lost";
          return (
            <li
              key={`${c.characterId}-${i}`}
              className={`wc-contact-row${grey ? " wc-contact-lost" : ""}`}
            >
              <Avatar
                character={ch}
                characterId={c.characterId}
                size={36}
                grey={grey}
              />
              <span className="wc-contact-label">{label}</span>
              {c.status === "lost" && (
                <span className="wc-contact-status">失联</span>
              )}
              {(c.starValue ?? 0) >= 4 && (
                <span className="wc-contact-star" aria-label="星标">
                  ★
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// 保持 displayName 引用以备未来联系人卡展开使用
void displayName;
