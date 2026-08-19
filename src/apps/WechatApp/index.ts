/**
 * WechatApp/index.ts — 桶导出
 *
 * AppRegistry（frontend-phone-shell）通过 import.meta.glob 扫描 apps 下
 * 各 manifest.ts 聚合 manifest，本目录默认导出主组件供 lazy 直接引用。
 */
export { default } from "./WechatApp";
export { WechatAppManifest } from "./manifest";
