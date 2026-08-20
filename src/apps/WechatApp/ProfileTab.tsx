/**
 * WechatApp/ProfileTab.tsx — "我的" 个人中心 Tab
 *
 * - 展示玩家头像、昵称、微信号。
 * - 菜单行：收藏 / 朋友圈 / 视频号 / 设置（右侧箭头）。
 * - 遵循现有 Tab 模式：接收 characters 数组、用 buildCharacterDictionary + displayName。
 * - 使用本目录自带的 Avatar 组件（与 ChatTab / MomentsTab / ContactsTab 一致）。
 */
import { useMemo } from "react";
import type { Character } from "@/types";
import { Avatar } from "./Avatar";
import {
  buildCharacterDictionary,
  displayName,
  type CharacterDictionary,
} from "./data";

export interface ProfileTabProps {
  characters: Character[];
}

/* ------------------------------------------------------------------ *
 * 菜单项定义
 * ------------------------------------------------------------------ */

interface MenuItemDef {
  icon: string;
  label: string;
  /** 可选的点击处理（集成时由 WechatApp.tsx 注回调）。 */
  onClick?: () => void;
}

function MenuRow({ icon, label, onClick }: MenuItemDef): JSX.Element {
  return (
    <button
      type="button"
      className="wc-profile-menu-row"
      onClick={onClick}
      tabIndex={onClick ? 0 : -1}
      aria-disabled={!onClick}
    >
      <span className="wc-profile-menu-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="wc-profile-menu-label">{label}</span>
      <span className="wc-profile-menu-arrow" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * 玩家信息卡
 * ------------------------------------------------------------------ */

interface ProfileCardProps {
  dict: CharacterDictionary;
}

const PLAYER_ID = "char-linzhe";

function ProfileCard({ dict }: ProfileCardProps): JSX.Element {
  const player = dict.byId.get(PLAYER_ID);

  return (
    <div className="wc-profile-card">
      <div className="wc-profile-card-main">
        <Avatar
          character={player}
          characterId={PLAYER_ID}
          size={64}
        />
        <div className="wc-profile-info">
          <div className="wc-profile-name">{displayName(player)}</div>
          <div className="wc-profile-wxid">微信号：linzhe2026</div>
        </div>
        <div className="wc-profile-more-btn" aria-label="更多信息">
          <span className="wc-profile-more-arrow">›</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Tab 容器
 * ------------------------------------------------------------------ */

export function ProfileTab({ characters }: ProfileTabProps): JSX.Element {
  const dict = useMemo(
    () => buildCharacterDictionary(characters),
    [characters],
  );

  const menuSection1: MenuItemDef[] = [
    { icon: "★", label: "收藏" },
    { icon: "◉", label: "朋友圈" },
    { icon: "▶", label: "视频号" },
  ];

  const menuSection2: MenuItemDef[] = [
    { icon: "⚙", label: "设置" },
  ];

  return (
    <div className="wc-profile-tab">
      <header className="wc-header">
        <div className="wc-header-titles">
          <div className="wc-header-title">我</div>
        </div>
      </header>

      <div className="wc-profile-body">
        <ProfileCard dict={dict} />

        <div className="wc-profile-menu-section">
          {menuSection1.map((item) => (
            <MenuRow key={item.label} {...item} />
          ))}
        </div>

        <div className="wc-profile-menu-section">
          {menuSection2.map((item) => (
            <MenuRow key={item.label} {...item} />
          ))}
        </div>
      </div>
    </div>
  );
}