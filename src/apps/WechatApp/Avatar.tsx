/**
 * WechatApp/Avatar.tsx — 角色头像
 *
 * 资源体系未落地时用首字符圆形占位；assetId 透传给 phone-shell 资源层做替换。
 * CLAUDE.md §3：不触碰 src/ui，本目录自带最小实现，签名稳定。
 */
import type { Character } from "@/types";
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
  // 用 characterId 哈希出稳定色相，避免资源未落地时一片灰白
  const hue = hashHue(character?.id ?? characterId ?? name);
  const style: React.CSSProperties = {
    width: size,
    height: size,
    background: `hsl(${hue} 55% 55%)`,
    fontSize: size * 0.42,
  };
  return (
    <div
      className={`wc-avatar ${grey ? "wc-avatar-grey" : ""} ${className}`.trim()}
      style={style}
      data-asset-id={character?.avatarAssetId}
      aria-label={name}
    >
      {first}
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
