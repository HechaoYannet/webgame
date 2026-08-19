/**
 * DoorbellApp manifest.
 *
 * 由 phone-shell 用 import.meta.glob 扫描 ./apps/ 下各子目录 manifest.ts
 * 自动聚合到 AppRegistry（CLAUDE.md §3 + §4）。Component 用 React.lazy 包裹；
 * 类型契约里 Component 字段是 unknown（与 React 解耦），这里 cast 回 lazy 组件。
 *
 * 终章前隐藏：刀哥仅在 puzzle-lab-backend.onSuccess pushDoorbell 后才上门，
 * 桌面图标在 ch-5 起可见（玩家进入第五章时门铃 App 出现在桌面）。
 */
import { lazy } from 'react';
import type { AppManifest } from '@/types';

const DoorbellApp = lazy(() => import('./DoorbellApp'));

export const DoorbellAppManifest: AppManifest = {
  appId: 'doorbell',
  title: '智能门铃',
  icon: 'doorbell.png',
  route: '/app/doorbell',
  Component: DoorbellApp as unknown as AppManifest['Component'],
  availableFrom: 'ch-5',
};
