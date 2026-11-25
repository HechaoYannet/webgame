/**
 * DoorbellApp manifest.
 *
 * 由 phone-shell 用 import.meta.glob 扫描 ./apps/ 下各子目录 manifest.ts
 * 自动聚合到 AppRegistry（CLAUDE.md §3 + §4）。Component 用 React.lazy 包裹；
 * 类型契约里 Component 字段是 unknown（与 React 解耦），这里 cast 回 lazy 组件。
 *
 * 常驻桌面：门铃是开场宣传的玩法之一，但 advanceChapter 全库只会写
 * ch-prologue / ch-finale，ch-5 永远不会成为当前章节 → 原 availableFrom: 'ch-5'
 * 使门铃 App 永远不出现（审核报告 E2E-4）。改为 prologue 常驻，
 * 门口事件仍由终章 deliverDoorbell 触发。
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
  availableFrom: 'ch-prologue',
};
