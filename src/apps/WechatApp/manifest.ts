/**
 * WechatApp/manifest.ts — App 注册清单
 *
 * CLAUDE.md §2：HashRouter，路由对象用 Component（大写，v7 替代 v6 element）。
 * §3 文件所有权：本文件属 frontend-wechat。AppRegistry（frontend-phone-shell）用
 * import.meta.glob 扫描 apps 下各 manifest.ts 自动聚合，Component 字段为 unknown（与 React 解耦），
 * phone-shell 在注册处把它当作 React.LazyExoticComponent<React.ComponentType<unknown>> 使用，
 * 此处不做额外 cast。
 */
import { lazy } from "react";
import type { AppManifest } from "@/types";

export const WechatAppManifest: AppManifest = {
  appId: "wechat",
  title: "微信",
  icon: "wechat.png",
  route: "/app/wechat",
  Component: lazy(() => import("./WechatApp")),
  availableFrom: "ch-prologue",
};
