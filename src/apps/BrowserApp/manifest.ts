// BrowserApp manifest.
//
// phone-shell uses import.meta.glob('./apps/*/manifest.ts') to aggregate into AppRegistry
// (CLAUDE.md section 3 + 4). Component is wrapped with React.lazy; the type contract keeps
// Component as unknown (decoupled from React), here cast back to a lazy component.
import { lazy } from "react";
import type { AppManifest } from "@/types";

const BrowserApp = lazy(() => import("./BrowserApp"));

export const BrowserAppManifest: AppManifest = {
  appId: "browser",
  title: "浏览器",
  icon: "browser.png",
  route: "/app/browser",
  Component: BrowserApp as unknown as AppManifest["Component"],
  availableFrom: "ch-prologue",
};
