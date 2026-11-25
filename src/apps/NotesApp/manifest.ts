/**
 * NotesApp manifest.
 *
 * 备忘录 App：消费 public/data/phone/notes.json。此前该数据没有任何消费者，
 * 被审核报告第 3 节列为「死内容」（且其中一条速查把 5 个谜题答案全写好了）。
 * 答案速查条目已从数据删除，接回本 App 不会破题。
 */
import { lazy } from 'react';
import type { AppManifest } from '@/types';

const NotesApp = lazy(() => import('./NotesApp'));

export const NotesAppManifest: AppManifest = {
  appId: 'notes',
  title: '备忘录',
  icon: 'notes',
  route: '/app/notes',
  Component: NotesApp as unknown as AppManifest['Component'],
  availableFrom: 'ch-prologue',
};
