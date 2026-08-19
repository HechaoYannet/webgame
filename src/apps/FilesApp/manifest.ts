/**
 * FilesApp manifest.
 *
 * 由 phone-shell 用 import.meta.glob 扫描 ./apps/ 下各子目录 manifest.ts
 * 自动聚合到 AppRegistry（CLAUDE.md §3 + §4）。Component 用 React.lazy 包裹；
 * 类型契约里 Component 字段是 unknown（与 React 解耦），这里 cast 回 lazy 组件。
 */
import { lazy } from 'react';
import type { AppManifest } from '@/types';

const FilesApp = lazy(() => import('./FilesApp'));

export const FilesAppManifest: AppManifest = {
  appId: 'files',
  title: '文件',
  icon: 'files.png',
  route: '/app/files',
  Component: FilesApp as unknown as AppManifest['Component'],
  availableFrom: 'ch-prologue',
};
