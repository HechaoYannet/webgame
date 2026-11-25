/**
 * WechatApp/Avatar.tsx — 角色头像
 *
 * 优先渲染 character.avatarAssetId 对应的真实头像（经 @/utils/assetUrl 候选扩展名解析，
 * 含 .svg）；全部候选失败才回退"首字符 + 稳定色相"色块。不显示 assetId 调试文本。
 */
import { useEffect, useState } from "react";
import type { Character } from "@/types";
import { imageUrlCandidates } from "@/utils/assetUrl";
import { displayName } from "./data";

export interface AvatarProps {
  character?: Character;
  characterId?: string;
  size?: number;
  /** 失联/离线灰阶覆盖。 */
  grey?: boolean;
  className?: string;
}

export function Avatar({
  character,
  characterId,
  size = 40,
  grey = false,
  className = "",
}: AvatarProps): JSX.Element {
  const name = displayName(character);
  const first = name.trim().charAt(0) || "?";
  const assetId = character?.avatarAssetId ?? "";
  const [idx, setIdx] = useState(0);

  // 切换人物时重置候选下标
  useEffect(() => {
    setIdx(0);
  }, [assetId]);

  const candidates = assetId ? imageUrlCandidates(assetId) : [];
  const showImage = idx < candidates.length;

  // 用 characterId 哈希出稳定色相，仅作为图片全部失败时的首字色块底色
  const hue = hashHue(character?.id ?? characterId ?? name);
  const style: React.CSSProperties = {
    width: size,
    height: size,
    background: showImage ? undefined : `hsl(${hue} 55% 55%)`,
    fontSize: size * 0.42,
  };
  return (
    <div
      className={`wc-avatar ${grey ? "wc-avatar-grey" : ""} ${className}`.trim()}
      style={style}
      data-asset-id={character?.avatarAssetId}
      aria-label={name}
    >
      {showImage ? (
        <img
          className="wc-avatar-img"
          src={candidates[idx]}
          alt=""
          loading="lazy"
          onError={() => setIdx((i) => i + 1)}
        />
      ) : (
        first
      )}
    </div>
  );
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) % 360;
  }
  return Math.abs(h) % 360;
}
