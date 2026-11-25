/**
 * WechatApp/ProfileTab.tsx — "我的" 个人中心 Tab
 *
 * 只保留真实可展示的信息：玩家头像、昵称、微信号。
 * 收藏 / 朋友圈 / 视频号 / 设置等无功能菜单项、资料卡 "›" 死按钮已删除
 * （审核报告 2.E 死交互）；不新增假功能。
 * 遵循现有 Tab 模式：接收 characters 数组、用 buildCharacterDictionary + displayName。
 */
import { useMemo } from "react";
import type { Character } from "@/types";
import { Avatar } from "./Avatar";
import { buildCharacterDictionary, displayName } from "./data";

export interface ProfileTabProps {
  characters: Character[];
}

const PLAYER_ID = "char-linzhe";

export function ProfileTab({ characters }: ProfileTabProps): JSX.Element {
  const dict = useMemo(
    () => buildCharacterDictionary(characters),
    [characters],
  );
  const player = dict.byId.get(PLAYER_ID);

  return (
    <div className="wc-profile-tab">
      <header className="wc-header">
        <div className="wc-header-titles">
          <div className="wc-header-title">我</div>
        </div>
      </header>

      <div className="wc-profile-body">
        <div className="wc-profile-card">
          <div className="wc-profile-card-main">
            <Avatar character={player} characterId={PLAYER_ID} size={64} />
            <div className="wc-profile-info">
              <div className="wc-profile-name">{displayName(player)}</div>
              <div className="wc-profile-wxid">微信号：linzhe2026</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
