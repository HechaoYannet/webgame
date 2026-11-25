/**
 * WechatApp/MomentImage.tsx — 朋友圈配图
 *
 * 真实渲染 public/assets 下的配图（经 @/utils/assetUrl 候选扩展名解析，
 * 修复 assetId 无扩展名导致的 404）。文件缺失时回落中性灰块，不显示调试文本。
 */
import { AssetImage } from "./AssetImage";

export function MomentImage({ assetId }: { assetId: string }): JSX.Element {
  return <AssetImage assetId={assetId} />;
}
