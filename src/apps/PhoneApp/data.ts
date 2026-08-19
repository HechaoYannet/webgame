/**
 * src/apps/PhoneApp/data.ts
 *
 * 本文件由 frontend-phone-apps agent 维护，仅供本 agent 的 6 个 App 内部使用。
 *
 * 作用：定义 phone/* 与终章相关 JSON 的运行时数据类型 + 按需 fetch 加载器。
 * 这些 JSON 的 schema 由 writer-phone-story 自描述（见各文件 $description），
 * 不在 src/types/index.ts 内（types 只覆盖跨 agent 契约面），故此处本地定义类型。
 *
 * 严格遵循 CLAUDE.md §2：`import.meta.env.BASE_URL` 原样出现于拼路径。
 * 严格遵循 CLAUDE.md §4：只读消费 public/data，不生成。
 */

import type {
  ArticleBlock,
  ChapterId,
  Clue,
  ClueId,
  ContactId,
  Ending,
  EndingId,
  Evidence,
  EvidenceId,
  Puzzle,
  PuzzleEffect,
  PuzzleId,
} from '@/types';

// ===== phone/call-log.json =====
export type CallStatus =
  | 'no-answer'
  | 'answered'
  | 'declined-auto'
  | 'busy';
export type CallDirection = 'incoming' | 'outgoing';

export interface CallRecord {
  id: string;
  contactCharacterId: ContactId | null;
  displayNumber: string;
  rawNumber?: string;
  direction: CallDirection;
  status: CallStatus;
  statusText: string;
  calledAt: string;
  durationSec: number;
  relatedChapterId: ChapterId;
  scriptId: string | null;
}

// ===== phone/call-scripts.json =====
export type CallScriptBlock =
  | {
      type: 'line';
      speaker: ContactId | null;
      text: string;
      timestampSec: number;
      characterBehavior?: string;
      audioAssetId?: string;
    }
  | { type: 'system'; text: string; timestampSec: number }
  | {
      type: 'evidenceSelection';
      puzzleId: PuzzleId;
      prompt: string;
      minLength: number;
      requiredEvidenceIds: EvidenceId[];
      optionalEvidenceIds?: EvidenceId[];
      timestampSec: number;
    }
  | {
      type: 'branch';
      condition: { kind: 'puzzleSucceeded' | 'puzzleFailed'; puzzleId: PuzzleId };
      branchId: 'good' | 'normal';
      timestampSec: number;
    };

export interface CallScriptBranch {
  blocks: CallScriptBlock[];
  endEffects: PuzzleEffect[];
}

export interface CallScript {
  id: string;
  title: string;
  callee: ContactId | null;
  calleeDisplay: string;
  blocks: CallScriptBlock[];
  endEffect?: PuzzleEffect | null;
  branches?: Record<string, CallScriptBranch>;
}

// ===== phone/sms.json =====
export type SmsAlertStyle = 'info' | 'warning' | 'danger' | 'success';
export type SmsSender =
  | ContactId
  | {
      kind: 'unknownNumber';
      display: string;
      digits: string;
    };

export interface SmsEvent {
  id: string;
  pushTriggerPuzzleId?: PuzzleId;
  pushTriggerRiskEventId?: string;
  pushTrigger?: unknown;
  pushTriggerEndingId?: EndingId;
  from: SmsSender;
  /** 'sent' = 玩家发出。默认 received。 */
  direction?: 'sent';
  receivedAt: string;
  body: string;
  footnote?: string | null;
  alertStyle: SmsAlertStyle;
  registersClueId?: ClueId | null;
  triggersEvidenceId?: EvidenceId | null;
}

// ===== phone/doorbell-events.json =====
export interface DoorbellLiveFeed {
  sceneDescription: string;
  characterAssetId: string;
  clipAssetId: string;
  loop: boolean;
}
export interface DoorbellAudio {
  assetId: string;
  loop: boolean;
  volume: number;
}
export interface DoorbellFeedback {
  type: 'vibrate' | 'redEdgePulse';
  pattern?: string;
  intensity?: number;
}
export interface DoorbellCountdownBar {
  countdownId: string;
  durationSec: number;
  style: 'red';
  alertText: string;
  alertStyle: 'danger';
}
export interface DoorbellEvent {
  id: string;
  sourcePuzzleId: PuzzleId;
  pushTriggerPuzzleId: PuzzleId;
  triggeredAt: string;
  doorbellCharacterId: ContactId;
  title: string;
  pushNotification: { appName: string; title: string; body: string };
  liveFeed: DoorbellLiveFeed;
  audio: DoorbellAudio;
  deviceFeedback: DoorbellFeedback[];
  countdownBar: DoorbellCountdownBar;
  onTimeoutText: string;
  onTimeoutEndingId: EndingId;
  registersClueId?: ClueId | null;
  triggersEvidenceId?: EvidenceId | null;
}

// ===== phone/notes.json =====
export interface Note {
  id: string;
  title: string;
  createdAt: string;
  pinned: boolean;
  body: string;
  isTemplate: boolean;
}

// ===== 加载器（按需 fetch，带 base_url） =====
const BASE = import.meta.env.BASE_URL;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(BASE + 'data/' + path);
  if (!res.ok) throw new Error('data load failed: ' + path + ' (' + res.status + ')');
  return (await res.json()) as T;
}

export async function loadCallLog(): Promise<CallRecord[]> {
  const data = await fetchJson<{ records: CallRecord[] }>('phone/call-log.json');
  return data.records;
}

export async function loadCallScripts(): Promise<CallScript[]> {
  const data = await fetchJson<{ scripts: CallScript[] }>('phone/call-scripts.json');
  return data.scripts;
}

export async function loadSms(): Promise<SmsEvent[]> {
  const data = await fetchJson<{ events: SmsEvent[] }>('phone/sms.json');
  return data.events;
}

export async function loadDoorbell(): Promise<DoorbellEvent[]> {
  const data = await fetchJson<{ events: DoorbellEvent[] }>('phone/doorbell-events.json');
  return data.events;
}

export async function loadNotes(): Promise<Note[]> {
  const data = await fetchJson<{ notes: Note[] }>('phone/notes.json');
  return data.notes;
}

export async function loadPuzzles(): Promise<Puzzle[]> {
  return await fetchJson<Puzzle[]>('puzzle/puzzles.json');
}

export async function loadEvidence(): Promise<Evidence[]> {
  return await fetchJson<Evidence[]>('meta/evidence-registry.json');
}

export async function loadEndings(): Promise<Ending[]> {
  return await fetchJson<Ending[]>('meta/endings.json');
}

export async function loadClues(): Promise<Clue[]> {
  return await fetchJson<Clue[]>('clustering/clue-map.json');
}

// 复用类型导出（供组件方便引入）
export type { ArticleBlock, EndingId };
