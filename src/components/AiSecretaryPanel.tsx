import {
  Bot,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  ListTodo,
  PlusCircle,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  XCircle,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { buildAiSecretaryImportUrl } from '../aiSecretaryExport';
import type { Locale } from '../i18n';
import type { DistillStore, Project, ThoughtBlock } from '../model';
import type { ProjectCount } from '../selectors';

type AiSecretaryPanelProps = {
  locale: Locale;
  aiSecretaryUrl: string;
  draftPrompt?: string;
  draftPromptKey?: number;
  selectedBlock?: ThoughtBlock;
  store: DistillStore;
  projects: Project[];
  todayBlocks: ThoughtBlock[];
  focusProjects: ProjectCount[];
  totalBlocks: number;
};

type SecretaryEvent = {
  id?: string;
  title: string;
  timeRange?: string;
  location?: string;
  start?: string;
  end?: string;
  period?: string;
  isNow?: boolean;
};

type SecretaryTask = {
  id?: string;
  task: string;
  status?: string;
  importance?: string;
  category?: string;
  deadline?: string | null;
};

type SecretaryChatRecord = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  createdAt: string;
  updatedAt?: string;
  sourceClientId?: string;
};

type SecretarySchedule = {
  today: string;
  events: SecretaryEvent[];
  tasks: SecretaryTask[];
};

type AuthState = 'checking' | 'authenticated' | 'unauthorized';
type CalendarAction = 'create' | 'update' | 'delete';
type TaskAction = 'create' | 'update' | 'delete';
type OperationScope = 'calendar' | 'task';

type CalendarForm = {
  action: CalendarAction;
  eventId: string;
  title: string;
  start: string;
  end: string;
  location: string;
  description: string;
};

type TaskForm = {
  action: TaskAction;
  pageId: string;
  task: string;
  status: string;
  importance: string;
  category: string;
  deadline: string;
};

type OperationResponse = {
  ok?: boolean;
  message?: string;
  action?: string;
  approvalRequired?: boolean;
  approvalId?: string;
  approvalStatus?: string;
  eventId?: string;
  pageId?: string;
};

type PendingApproval = {
  scope: OperationScope;
  endpoint: '/api/calendar-action' | '/api/task-action';
  approvalId: string;
  label: string;
  payload: Record<string, unknown>;
  message: string;
  preview: ApprovalPreview;
};

type OperationHistoryStatus = 'completed' | 'failed' | 'rejected';
type OperationHistoryStatusFilter = OperationHistoryStatus | 'all';
type OperationHistoryScopeFilter = OperationScope | 'all';

type OperationHistoryEntry = {
  id: string;
  scope: OperationScope;
  endpoint: PendingApproval['endpoint'];
  approvalId?: string;
  label: string;
  payload: Record<string, unknown>;
  message: string;
  status: OperationHistoryStatus;
  preview: ApprovalPreview;
  attempts: number;
  createdAt: string;
  updatedAt: string;
};

type ApprovalPreviewRow = {
  label: string;
  before?: string;
  after: string;
};

type ApprovalPreview = {
  title: string;
  risk: string;
  rows: ApprovalPreviewRow[];
};

type ChatOperationDraft = {
  scope: OperationScope;
  endpoint: PendingApproval['endpoint'];
  payload: Record<string, unknown>;
  calendarForm?: CalendarForm;
  taskForm?: TaskForm;
  reply: string;
};

type ProjectPlanProject = {
  name: string;
  status: string;
  blocks: number;
  signal: string;
};

type ProjectPlanDraft = {
  calendarForm: CalendarForm;
  taskForm: TaskForm;
  proposals: ProjectPlanProposal[];
  reply: string;
};

type ProjectPlanProposal = {
  id: string;
  scope: OperationScope;
  endpoint: PendingApproval['endpoint'];
  title: string;
  detail: string;
  payload: Record<string, unknown>;
  selected: boolean;
};

function apiUrl(baseUrl: string, path: string) {
  return new URL(path, baseUrl).toString();
}

const OPERATION_HISTORY_KEY = 'distill-ai-secretary-operation-history';
const OPERATION_HISTORY_LIMIT = 20;

async function secretaryRequest<T>(baseUrl: string, path: string, init: RequestInit = {}, timeoutMs = 20000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(apiUrl(baseUrl, path), {
      ...init,
      credentials: 'include',
      signal: controller.signal,
      headers: init.body
        ? { 'Content-Type': 'application/json', ...(init.headers || {}) }
        : init.headers,
    });
    const text = await response.text();
    const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (!response.ok) {
      const message = typeof body.message === 'string' ? body.message : `HTTP ${response.status}`;
      throw new Error(response.status === 401 ? 'AI秘書へのログインが必要です。' : message);
    }
    return body as T;
  } finally {
    window.clearTimeout(timer);
  }
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function isOperationHistoryStatus(value: unknown): value is OperationHistoryStatus {
  return value === 'completed' || value === 'failed' || value === 'rejected';
}

function normalizeOperationHistoryRecords(value: unknown): OperationHistoryEntry[] {
  const records = Array.isArray(value)
    ? value
    : Array.isArray((value as { records?: unknown })?.records)
      ? (value as { records: unknown[] }).records
      : [];
  const deduped = new Map<string, OperationHistoryEntry>();
  for (const item of records) {
    const record = item && typeof item === 'object' ? item as Partial<OperationHistoryEntry> : null;
    if (
      !record ||
      typeof record.id !== 'string' ||
      (record.scope !== 'calendar' && record.scope !== 'task') ||
      (record.endpoint !== '/api/calendar-action' && record.endpoint !== '/api/task-action') ||
      typeof record.label !== 'string' ||
      typeof record.message !== 'string' ||
      !isOperationHistoryStatus(record.status) ||
      !record.payload ||
      typeof record.payload !== 'object' ||
      !record.preview ||
      typeof record.preview !== 'object' ||
      typeof record.createdAt !== 'string' ||
      typeof record.updatedAt !== 'string'
    ) {
      continue;
    }

    const nextRecord: OperationHistoryEntry = {
      id: record.id,
      scope: record.scope,
      endpoint: record.endpoint,
      approvalId: typeof record.approvalId === 'string' ? record.approvalId : undefined,
      label: record.label,
      payload: record.payload as Record<string, unknown>,
      message: record.message,
      status: record.status,
      preview: record.preview,
      attempts: Number.isFinite(Number(record.attempts)) ? Math.max(0, Math.round(Number(record.attempts))) : 0,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    const previous = deduped.get(nextRecord.id);
    if (!previous || new Date(nextRecord.updatedAt).getTime() >= new Date(previous.updatedAt).getTime()) {
      deduped.set(nextRecord.id, nextRecord);
    }
  }

  return [...deduped.values()]
    .sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime())
    .slice(0, OPERATION_HISTORY_LIMIT);
}

function mergeOperationHistoryRecords(localRecords: OperationHistoryEntry[], serverRecords: OperationHistoryEntry[]) {
  return normalizeOperationHistoryRecords([...localRecords, ...serverRecords]);
}

function readOperationHistory(): OperationHistoryEntry[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(OPERATION_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return normalizeOperationHistoryRecords(parsed);
  } catch {
    return [];
  }
}

function writeOperationHistory(entries: OperationHistoryEntry[]) {
  try {
    window.localStorage.setItem(OPERATION_HISTORY_KEY, JSON.stringify(normalizeOperationHistoryRecords(entries)));
  } catch {
    // 実行履歴は補助情報なので、保存失敗しても主要操作は止めない。
  }
}

function historyTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function operationHistorySearchText(entry: OperationHistoryEntry) {
  return [
    entry.scope,
    entry.status,
    entry.label,
    entry.message,
    entry.approvalId,
    entry.preview.title,
    entry.preview.risk,
    ...entry.preview.rows.flatMap((row) => [row.label, row.before, row.after]),
    JSON.stringify(entry.payload),
  ].filter(Boolean).join(' ').toLowerCase();
}

function operationRecoverySuggestion(entry: OperationHistoryEntry, isJa: boolean) {
  if (entry.status !== 'failed') return null;
  const haystack = operationHistorySearchText(entry);
  if (/(401|unauthorized|login|session|auth|認証|ログイン)/i.test(haystack)) {
    return {
      title: isJa ? '認証を更新' : 'Refresh authentication',
      detail: isJa
        ? 'AI秘書本体を開いてログインし直してから再試行してください。セッション切れの可能性が高いです。'
        : 'Open the full AI Secretary app, sign in again, then retry. The session likely expired.',
    };
  }
  if (/(approval|approved|missing|rejected|承認|却下)/i.test(haystack)) {
    return {
      title: isJa ? '承認状態を確認' : 'Check approval state',
      detail: isJa
        ? '承認IDが失効・却下済みの可能性があります。同じ案をもう一度承認キューへ作り直す方が安全です。'
        : 'The approval ID may be expired or rejected. Recreate the same proposal in the approval queue.',
    };
  }
  if (/(timeout|aborted|network|fetch|connection|econn|通信|接続)/i.test(haystack)) {
    return {
      title: isJa ? '通信を再試行' : 'Retry network call',
      detail: isJa
        ? '一時的な通信失敗の可能性があります。AI秘書サーバーとCloudflare Tunnelの起動状態を確認して再試行してください。'
        : 'This looks transient. Check the AI Secretary server and Cloudflare Tunnel, then retry.',
    };
  }
  if (/(400|invalid|required|title|start|end|date|time|入力|時刻)/i.test(haystack)) {
    return {
      title: isJa ? '入力値を修正' : 'Fix input values',
      detail: isJa
        ? 'タイトル、開始時刻、終了時刻、期限などの必須項目が不足している可能性があります。内容を確認して作り直してください。'
        : 'Required fields may be missing. Check title, start/end time, and date fields before recreating.',
    };
  }
  if (/(google|calendar|event|カレンダー|予定)/i.test(haystack)) {
    return {
      title: isJa ? 'Googleカレンダー連携を確認' : 'Check Google Calendar integration',
      detail: isJa
        ? 'Google Calendar APIの認可、対象カレンダー、開始/終了時刻の形式を確認してから再試行してください。'
        : 'Check Google Calendar authorization, target calendar, and start/end time format before retrying.',
    };
  }
  if (/(notion|task|page|タスク)/i.test(haystack)) {
    return {
      title: isJa ? 'Notionタスク連携を確認' : 'Check Notion task integration',
      detail: isJa
        ? 'Notion連携、ページID、DBプロパティ名、期限なしタスクの扱いを確認してから再試行してください。'
        : 'Check Notion authorization, page ID, database properties, and no-deadline task handling before retrying.',
    };
  }
  return {
    title: isJa ? '同じ内容で再試行' : 'Retry with the same payload',
    detail: isJa
      ? '原因が特定できない失敗です。まず再試行し、再度失敗したら履歴メッセージを見て入力値か連携設定を修正してください。'
      : 'The cause is unclear. Retry once, then inspect the message and fix either input values or integration settings.',
  };
}

function payloadWithoutApproval(payload: Record<string, unknown>) {
  const { approvalId: _approvalId, approval_id: _approval_id, ...safePayload } = payload;
  return safePayload;
}

function calendarActionFromPayload(value: unknown): CalendarAction {
  return value === 'update' || value === 'delete' ? value : 'create';
}

function taskActionFromPayload(value: unknown): TaskAction {
  return value === 'update' || value === 'delete' ? value : 'create';
}

function normalizeEvents(value: unknown): SecretaryEvent[] {
  return Array.isArray(value)
    ? value.slice(0, 12).map((item) => {
        const event = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return {
          title: text(event.title, '無題の予定'),
          id: text(event.id),
          timeRange: text(event.timeRange),
          location: text(event.location),
          start: text(event.start),
          end: text(event.end),
          period: text(event.period),
          isNow: event.isNow === true,
        };
      })
    : [];
}

function normalizeTasks(value: unknown): SecretaryTask[] {
  return Array.isArray(value)
    ? value.slice(0, 12).map((item) => {
        const task = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return {
          id: text(task.id),
          task: text(task.task, '無題のタスク'),
          status: text(task.status),
          importance: text(task.importance),
          category: text(task.category),
          deadline: typeof task.deadline === 'string' ? task.deadline : null,
        };
      })
    : [];
}

function normalizeChatRecords(value: unknown): SecretaryChatRecord[] {
  return Array.isArray(value)
    ? value.slice(-20).map((item) => {
        const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        const createdAt = text(record.createdAt, new Date().toISOString());
        const role: SecretaryChatRecord['role'] = record.role === 'user' ? 'user' : 'ai';
        return {
          id: text(record.id, `distill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
          role,
          content: text(record.content),
          createdAt,
          updatedAt: text(record.updatedAt, createdAt),
          sourceClientId: text(record.sourceClientId),
        };
      }).filter((record) => record.content)
    : [];
}

function createChatRecord(role: SecretaryChatRecord['role'], content: string): SecretaryChatRecord {
  const createdAt = new Date().toISOString();
  return {
    id: `distill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt,
    updatedAt: createdAt,
    sourceClientId: 'distill-native-ui',
  };
}

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function defaultDateTime(hour: number, minute = 0) {
  return `${localDateKey()}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function toDateTimeLocalValue(value?: string) {
  if (!value) return '';
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  return match ? `${match[1]}T${match[2]}:${match[3]}` : '';
}

function compactPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== ''),
  );
}

function previewValue(value: unknown, fallback = 'なし') {
  if (value == null || value === '') return fallback;
  return String(value).replace('T', ' ');
}

function compactMatchText(value: string) {
  return toHalfWidth(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function scoreTargetMatch(message: string, target: string) {
  const normalizedMessage = compactMatchText(message);
  const normalizedTarget = compactMatchText(target);
  if (!normalizedMessage || !normalizedTarget) return 0;
  if (normalizedMessage.includes(normalizedTarget)) return normalizedTarget.length + 20;
  const parts = normalizedTarget.split(/(?=[A-ZＡ-Ｚ])|[・\s_-]+/).filter((part) => part.length >= 2);
  return parts.reduce((score, part) => score + (normalizedMessage.includes(part) ? part.length : 0), 0);
}

function toHalfWidth(value: string) {
  return value
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[：]/g, ':')
    .replace(/[～〜]/g, '~');
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKeyFromMessage(message: string, now = new Date()) {
  const normalized = toHalfWidth(message);
  const isoDate = normalized.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoDate) {
    return `${isoDate[1]}-${isoDate[2].padStart(2, '0')}-${isoDate[3].padStart(2, '0')}`;
  }

  const monthDay = normalized.match(/(?:^|[^\d])(\d{1,2})\/(\d{1,2})(?:[^\d]|$)/);
  if (monthDay) {
    return `${now.getFullYear()}-${monthDay[1].padStart(2, '0')}-${monthDay[2].padStart(2, '0')}`;
  }

  if (/明日|あした/.test(message)) return localDateKey(addDays(now, 1));
  if (/明後日|あさって/.test(message)) return localDateKey(addDays(now, 2));
  return localDateKey(now);
}

function formatMinuteTime(hour: string, minute: string) {
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

function addMinutesToTime(time: string, minutesToAdd: number) {
  const [hourText, minuteText] = time.split(':');
  const date = new Date();
  date.setHours(Number(hourText), Number(minuteText) + minutesToAdd, 0, 0);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function addMinutesToDate(date: Date, minutes: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function roundUpToNextHalfHour(date: Date) {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const minute = next.getMinutes();
  const roundedMinute = minute === 0 || minute === 30 ? minute : minute < 30 ? 30 : 60;
  if (roundedMinute === 60) {
    next.setHours(next.getHours() + 1, 0, 0, 0);
  } else {
    next.setMinutes(roundedMinute, 0, 0);
  }
  return next;
}

function toDateTimeInputValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-') + `T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function displayDateTimeRange(start: Date, end: Date) {
  const date = [
    start.getFullYear(),
    String(start.getMonth() + 1).padStart(2, '0'),
    String(start.getDate()).padStart(2, '0'),
  ].join('-');
  return `${date} ${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}-${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
}

function eventDurationMinutes(event: SecretaryEvent) {
  if (!event.start || !event.end) return 30;
  const start = new Date(event.start).getTime();
  const end = new Date(event.end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 30;
  return Math.max(5, Math.min(24 * 60, Math.round((end - start) / 60000)));
}

function dateKeyFromEvent(event: SecretaryEvent, fallbackMessage: string) {
  const localValue = toDateTimeLocalValue(event.start);
  return localValue ? localValue.slice(0, 10) : dateKeyFromMessage(fallbackMessage);
}

function cleanOperationTitle(value: string, fallback: string) {
  const cleaned = value
    .replace(/^(から|より|~|-|、|。|\s)+/, '')
    .replace(/(を)?(予定|カレンダー|googleカレンダー|Googleカレンダー)?(に)?(追加|登録|入れて|作って|お願い|して|する|欲しい|ほしい).*$/i, '')
    .replace(/(っていう|という)$/i, '')
    .replace(/[「」『』"']/g, '')
    .trim();
  return cleaned || fallback;
}

function findBestEvent(message: string, events: SecretaryEvent[]) {
  return events
    .filter((event) => event.id && event.title)
    .map((event) => ({ event, score: scoreTargetMatch(message, event.title) }))
    .filter((item) => item.score > 0)
    .sort((first, second) => second.score - first.score)[0]?.event || null;
}

function findBestTask(message: string, tasks: SecretaryTask[]) {
  return tasks
    .filter((task) => task.id && task.task)
    .map((task) => ({ task, score: scoreTargetMatch(message, task.task) }))
    .filter((item) => item.score > 0)
    .sort((first, second) => second.score - first.score)[0]?.task || null;
}

function buildApprovalPreview(scope: OperationScope, payload: Record<string, unknown>, schedule: SecretarySchedule): ApprovalPreview {
  const action = String(payload.action || 'create');
  if (scope === 'calendar') {
    const event = schedule.events.find((item) => item.id && item.id === payload.eventId);
    const target = previewValue(payload.title || event?.title, '対象予定未定');
    if (action === 'delete') {
      return {
        title: 'Googleカレンダー削除プレビュー',
        risk: '承認すると、この予定をGoogleカレンダーから削除します。',
        rows: [
          { label: '対象', before: target, after: '削除' },
          { label: '現在時刻', before: eventLine(event || { title: target }), after: '削除' },
        ],
      };
    }

    if (action === 'update') {
      return {
        title: 'Googleカレンダー編集プレビュー',
        risk: '承認すると、既存予定の内容を変更します。',
        rows: [
          { label: '対象', before: previewValue(event?.title), after: target },
          { label: '開始', before: previewValue(toDateTimeLocalValue(event?.start)), after: previewValue(payload.start) },
          { label: '終了', before: previewValue(toDateTimeLocalValue(event?.end)), after: previewValue(payload.end) },
          { label: '場所', before: previewValue(event?.location), after: previewValue(payload.location) },
        ],
      };
    }

    return {
      title: 'Googleカレンダー追加プレビュー',
      risk: '承認すると、新しい予定をGoogleカレンダーへ追加します。',
      rows: [
        { label: 'タイトル', after: target },
        { label: '開始', after: previewValue(payload.start) },
        { label: '終了', after: previewValue(payload.end) },
        { label: '場所', after: previewValue(payload.location) },
      ],
    };
  }

  const task = schedule.tasks.find((item) => item.id && item.id === payload.pageId);
  const target = previewValue(payload.task || task?.task, '対象タスク未定');
  if (action === 'delete') {
    return {
      title: 'Notionタスク削除プレビュー',
      risk: '承認すると、このNotionタスクをアーカイブします。',
      rows: [
        { label: '対象', before: target, after: 'アーカイブ' },
        { label: '現在状態', before: previewValue(task?.status), after: 'アーカイブ' },
      ],
    };
  }

  if (action === 'update') {
    return {
      title: 'Notionタスク編集プレビュー',
      risk: '承認すると、既存タスクのプロパティを変更します。',
      rows: [
        { label: '対象', before: previewValue(task?.task), after: target },
        { label: '状態', before: previewValue(task?.status), after: previewValue(payload.status) },
        { label: '重要度', before: previewValue(task?.importance), after: previewValue(payload.importance) },
        { label: '期限', before: previewValue(task?.deadline), after: previewValue(payload.deadline) },
      ],
    };
  }

  return {
    title: 'Notionタスク追加プレビュー',
    risk: '承認すると、新しいタスクをNotionへ追加します。',
    rows: [
      { label: 'タスク', after: target },
      { label: '状態', after: previewValue(payload.status) },
      { label: '重要度', after: previewValue(payload.importance) },
      { label: '期限', after: previewValue(payload.deadline) },
    ],
  };
}

function parseCalendarDraft(message: string, schedule: SecretarySchedule, now = new Date()): ChatOperationDraft | null {
  const normalized = toHalfWidth(message);
  const matchedEvent = findBestEvent(message, schedule.events);
  const wantsDelete = /(削除|消して|消す|取り消し|キャンセル)/i.test(message);
  const wantsUpdate = /(変更|編集|修正|ずらして|移して|にして|へ変更)/i.test(message);
  const timeMatch = normalized.match(/(\d{1,2}):(\d{2})(?:\s*(?:~|-|から|ー)\s*(\d{1,2}):(\d{2}))?/);

  if (matchedEvent && wantsDelete) {
    const payload = compactPayload({
      action: 'delete',
      eventId: matchedEvent.id,
    });
    return {
      scope: 'calendar',
      endpoint: '/api/calendar-action',
      payload,
      calendarForm: {
        action: 'delete',
        eventId: matchedEvent.id || '',
        title: matchedEvent.title,
        start: toDateTimeLocalValue(matchedEvent.start),
        end: toDateTimeLocalValue(matchedEvent.end),
        location: matchedEvent.location || '',
        description: 'DistillチャットからAI秘書経由で削除',
      },
      reply: `予定削除ドラフトを作成しました: ${matchedEvent.title}。承認するとGoogleカレンダーから削除します。`,
    };
  }

  if (matchedEvent && wantsUpdate && timeMatch) {
    const dateKey = dateKeyFromEvent(matchedEvent, message);
    const startTime = formatMinuteTime(timeMatch[1], timeMatch[2]);
    const endTime = timeMatch[3] && timeMatch[4]
      ? formatMinuteTime(timeMatch[3], timeMatch[4])
      : addMinutesToTime(startTime, eventDurationMinutes(matchedEvent));
    const calendarForm: CalendarForm = {
      action: 'update',
      eventId: matchedEvent.id || '',
      title: matchedEvent.title,
      start: `${dateKey}T${startTime}`,
      end: `${dateKey}T${endTime}`,
      location: matchedEvent.location || '',
      description: 'DistillチャットからAI秘書経由で変更',
    };
    return {
      scope: 'calendar',
      endpoint: '/api/calendar-action',
      payload: compactPayload({
        action: 'update',
        eventId: matchedEvent.id,
        title: matchedEvent.title,
        start: calendarForm.start,
        end: calendarForm.end,
        location: calendarForm.location,
        description: calendarForm.description,
      }),
      calendarForm,
      reply: `予定編集ドラフトを作成しました: ${matchedEvent.title} / ${dateKey} ${startTime}-${endTime}。承認するとGoogleカレンダーへ反映します。`,
    };
  }

  const isCalendarIntent = /(予定|カレンダー|スケジュール|移動|会議|ミーティング|予約)/i.test(message)
    && /(追加|登録|入れて|作って|お願い|予定)/i.test(message);
  if (!isCalendarIntent || !timeMatch) return null;

  const dateKey = dateKeyFromMessage(message, now);
  const startTime = formatMinuteTime(timeMatch[1], timeMatch[2]);
  const endTime = timeMatch[3] && timeMatch[4]
    ? formatMinuteTime(timeMatch[3], timeMatch[4])
    : addMinutesToTime(startTime, 30);
  const afterTime = normalized.slice((timeMatch.index || 0) + timeMatch[0].length);
  const beforeTime = normalized.slice(0, timeMatch.index || 0);
  const title = cleanOperationTitle(afterTime, '') || cleanOperationTitle(beforeTime, '') || '予定';
  const description = 'DistillチャットからAI秘書経由で作成';
  const calendarForm: CalendarForm = {
    action: 'create',
    eventId: '',
    title,
    start: `${dateKey}T${startTime}`,
    end: `${dateKey}T${endTime}`,
    location: '',
    description,
  };

  return {
    scope: 'calendar',
    endpoint: '/api/calendar-action',
    payload: compactPayload({
      action: 'create',
      title,
      start: calendarForm.start,
      end: calendarForm.end,
      description,
    }),
    calendarForm,
    reply: `予定ドラフトを作成しました: ${title} / ${dateKey} ${startTime}-${endTime}。承認するとGoogleカレンダーへ反映します。`,
  };
}

function taskStatusFromMessage(message: string) {
  if (/(完了|済み|終わった|終わり)/.test(message)) return '完了';
  if (/(進行中|着手|開始)/.test(message)) return '進行中';
  if (/(未着手|戻して|未完了)/.test(message)) return '未着手';
  return '';
}

function parseTaskDraft(message: string, schedule: SecretarySchedule): ChatOperationDraft | null {
  const normalized = toHalfWidth(message);
  const matchedTask = findBestTask(message, schedule.tasks);
  const wantsDelete = /(削除|消して|消す|取り消し|キャンセル|アーカイブ)/i.test(message);
  const wantsUpdate = /(変更|編集|修正|にして|へ変更|完了|済み|進行中|着手|未着手)/i.test(message);
  const nextStatus = taskStatusFromMessage(message);

  if (matchedTask && wantsDelete) {
    const taskForm: TaskForm = {
      action: 'delete',
      pageId: matchedTask.id || '',
      task: matchedTask.task,
      status: matchedTask.status || '未着手',
      importance: matchedTask.importance || 'Medium',
      category: matchedTask.category || '生活',
      deadline: matchedTask.deadline || '',
    };
    return {
      scope: 'task',
      endpoint: '/api/task-action',
      payload: compactPayload({
        action: 'delete',
        pageId: matchedTask.id,
      }),
      taskForm,
      reply: `タスク削除ドラフトを作成しました: ${matchedTask.task}。承認するとNotionでアーカイブします。`,
    };
  }

  if (matchedTask && wantsUpdate) {
    const dateMatchForUpdate = normalized.match(/(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}\/\d{1,2})/);
    const deadline = /期限なし|日付なし/.test(message)
      ? ''
      : dateMatchForUpdate
        ? dateKeyFromMessage(dateMatchForUpdate[0])
        : (matchedTask.deadline || '');
    const taskForm: TaskForm = {
      action: 'update',
      pageId: matchedTask.id || '',
      task: matchedTask.task,
      status: nextStatus || matchedTask.status || '未着手',
      importance: matchedTask.importance || 'Medium',
      category: matchedTask.category || '生活',
      deadline,
    };
    return {
      scope: 'task',
      endpoint: '/api/task-action',
      payload: compactPayload({
        action: 'update',
        pageId: matchedTask.id,
        task: taskForm.task,
        status: taskForm.status,
        importance: taskForm.importance,
        category: taskForm.category,
        deadline: deadline || null,
      }),
      taskForm,
      reply: `タスク編集ドラフトを作成しました: ${matchedTask.task} / 状態 ${taskForm.status}${deadline ? ` / 期限 ${deadline}` : ' / 期限なし'}。承認するとNotionへ反映します。`,
    };
  }

  const isTaskIntent = /(タスク|todo|TODO|やること|したいこと|期限なし|買い出し|買い物|運動)/i.test(message)
    && !/(予定|カレンダー|スケジュール)/i.test(message)
    && /(追加|登録|入れて|作って|お願い|したい|やる|管理)/i.test(message);
  if (!isTaskIntent) return null;

  const dateMatch = normalized.match(/(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}\/\d{1,2})/);
  const deadline = /期限なし|日付なし/.test(message) ? '' : (dateMatch ? dateKeyFromMessage(dateMatch[0]) : '');
  const taskSource = normalized
    .replace(/^(タスク|TODO|todo|やること|したいこと)(追加|登録)?[:：\s]*/i, '')
    .replace(/^(今日|明日|期限なし|日付なし)(に|で|の)?/i, '')
    .replace(dateMatch?.[0] || '', '')
    .replace(/(を)?(タスク|TODO|todo)?(に)?(追加|登録|入れて|作って|お願い|して|する|したい|やる|管理).*$/i, '')
    .split(/[、。,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)[0] || '';
  const task = cleanOperationTitle(taskSource, '新しいタスク');
  const taskForm: TaskForm = {
    action: 'create',
    pageId: '',
    task,
    status: '未着手',
    importance: 'Medium',
    category: /(買い出し|買い物|食事|運動|健康)/.test(task) ? '生活' : '仕事',
    deadline,
  };

  return {
    scope: 'task',
    endpoint: '/api/task-action',
    payload: compactPayload({
      action: 'create',
      task,
      status: taskForm.status,
      importance: taskForm.importance,
      category: taskForm.category,
      deadline: deadline || null,
    }),
    taskForm,
    reply: `タスクドラフトを作成しました: ${task}${deadline ? ` / 期限 ${deadline}` : ' / 期限なし'}。承認するとNotionへ反映します。`,
  };
}

function parseChatOperationDraft(message: string, schedule: SecretarySchedule): ChatOperationDraft | null {
  const taskFirst = /(タスク|todo|TODO|やること|したいこと|Notion)/i.test(message);
  return taskFirst
    ? parseTaskDraft(message, schedule) || parseCalendarDraft(message, schedule)
    : parseCalendarDraft(message, schedule) || parseTaskDraft(message, schedule);
}

function looksLikeProjectPlanRequest(message: string) {
  return /(Distillの全プロジェクト|プロジェクト「|all Distill projects|Turn .*project|Big Rock|行動計画|目標達成)/i.test(message)
    && /(AI秘書|Secretary|予定|タスク|次の一手|schedule|task|action)/i.test(message);
}

function parseProjectPlanProjects(message: string): ProjectPlanProject[] {
  const projects = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => {
      const match = line.match(/^-\s*([^:：]+)[:：]\s*(.*)$/);
      if (!match) return null;
      const detail = match[2];
      const status = detail.match(/(?:状態|status)=([^,，]+)/i)?.[1]?.trim() || '';
      const blocks = Number(detail.match(/(?:関連ブロック|blocks)=?(\d+)/i)?.[1] || '0');
      const signal = detail.match(/(?:目的\/問い|signal)=([^,\n]+)/i)?.[1]?.trim() || '';
      return {
        name: match[1].trim(),
        status,
        blocks: Number.isFinite(blocks) ? blocks : 0,
        signal,
      };
    })
    .filter((project): project is ProjectPlanProject => Boolean(project));

  if (projects.length > 0) return projects;

  const quotedProject = message.match(/プロジェクト「([^」]+)」|project\s+"([^"]+)"/i);
  if (quotedProject) {
    return [{
      name: (quotedProject[1] || quotedProject[2]).trim(),
      status: text(message.match(/状態:\s*([^\n]+)/)?.[1] || message.match(/Status:\s*([^\n]+)/i)?.[1]),
      blocks: Number(message.match(/関連ブロック:\s*(\d+)/)?.[1] || message.match(/Related blocks:\s*(\d+)/i)?.[1] || '0'),
      signal: text(message.match(/目的\/問い:\s*([^\n]+)/)?.[1] || message.match(/Signal:\s*([^\n]+)/i)?.[1]),
    }];
  }

  return [];
}

function projectPlanScore(project: ProjectPlanProject) {
  const statusScore = /進行中|Active/i.test(project.status)
    ? 40
    : /設計|Design/i.test(project.status)
      ? 25
      : /次|Next/i.test(project.status)
        ? 18
        : 10;
  return statusScore + Math.min(project.blocks, 10);
}

function firstOpenSlot(schedule: SecretarySchedule, durationMinutes = 45) {
  const today = localDateKey();
  const workStart = new Date(`${today}T09:00:00`);
  const workEnd = new Date(`${today}T22:00:00`);
  const now = new Date();
  let cursor = localDateKey(now) === today && now > workStart ? roundUpToNextHalfHour(now) : workStart;
  if (cursor >= workEnd) {
    const tomorrow = addDays(new Date(`${today}T09:00:00`), 1);
    return { start: tomorrow, end: addMinutesToDate(tomorrow, durationMinutes) };
  }

  const busy = schedule.events
    .flatMap((event): { start: Date; end: Date }[] => {
      if (!event.start || !event.end) return [];
      const start = new Date(event.start);
      const end = new Date(event.end);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
      if (localDateKey(start) !== today || end <= cursor) return [];
      return [{ start, end }];
    })
    .sort((first, second) => first.start.getTime() - second.start.getTime());

  for (const event of busy) {
    if (addMinutesToDate(cursor, durationMinutes) <= event.start) {
      return { start: cursor, end: addMinutesToDate(cursor, durationMinutes) };
    }
    if (event.end > cursor) cursor = roundUpToNextHalfHour(event.end);
  }

  if (addMinutesToDate(cursor, durationMinutes) <= workEnd) {
    return { start: cursor, end: addMinutesToDate(cursor, durationMinutes) };
  }

  const tomorrow = addDays(new Date(`${today}T09:00:00`), 1);
  return { start: tomorrow, end: addMinutesToDate(tomorrow, durationMinutes) };
}

function buildProjectPlanDraft(message: string, schedule: SecretarySchedule, isJa: boolean): ProjectPlanDraft | null {
  if (!looksLikeProjectPlanRequest(message)) return null;

  const projects = parseProjectPlanProjects(message)
    .sort((first, second) => projectPlanScore(second) - projectPlanScore(first));
  const topProjects = projects.length > 0
    ? projects.slice(0, 3)
    : [{ name: isJa ? '最重要プロジェクト' : 'Top project', status: 'Active', blocks: 0, signal: '' }];
  const primary = topProjects[0];
  const firstSlot = firstOpenSlot(schedule, 45);
  const secondSlot = {
    start: addMinutesToDate(firstSlot.end, 15),
    end: addMinutesToDate(firstSlot.end, 60),
  };
  const thirdSlot = {
    start: addMinutesToDate(secondSlot.end, 15),
    end: addMinutesToDate(secondSlot.end, 45),
  };
  const slots = [firstSlot, secondSlot, thirdSlot];

  const calendarForm: CalendarForm = {
    action: 'create',
    eventId: '',
    title: `${primary.name}: ${isJa ? '次の一手' : 'next action'}`,
    start: toDateTimeInputValue(firstSlot.start),
    end: toDateTimeInputValue(firstSlot.end),
    location: '',
    description: isJa
      ? `Distillプロジェクトから自動生成: ${primary.signal || primary.status}`
      : `Auto-generated from Distill project: ${primary.signal || primary.status}`,
  };
  const taskForm: TaskForm = {
    action: 'create',
    pageId: '',
    task: `${primary.name}: ${isJa ? '今日の次の一手を1つ完了する' : 'complete one next action today'}`,
    status: '未着手',
    importance: 'High',
    category: isJa ? '仕事' : 'Work',
    deadline: localDateKey(),
  };

  const scheduleLines = topProjects.map((project, index) =>
    `- ${displayDateTimeRange(slots[index].start, slots[index].end)} ${project.name}: ${isJa ? '集中実行' : 'focused execution'}`,
  );
  const taskLines = topProjects.map((project, index) =>
    `- ${index === 0 ? 'High' : 'Medium'} / ${project.name}: ${project.signal || (isJa ? '次の一手を明確化' : 'clarify the next action')}`,
  );
  const proposals = topProjects.flatMap((project, index): ProjectPlanProposal[] => {
    const slot = slots[index];
    const importance = index === 0 ? 'High' : 'Medium';
    const calendarPayload = compactPayload({
      action: 'create',
      title: `${project.name}: ${isJa ? '集中実行' : 'focused execution'}`,
      start: toDateTimeInputValue(slot.start),
      end: toDateTimeInputValue(slot.end),
      description: isJa
        ? `Distillプロジェクトから自動生成: ${project.signal || project.status}`
        : `Auto-generated from Distill project: ${project.signal || project.status}`,
    });
    const taskPayload = compactPayload({
      action: 'create',
      task: `${project.name}: ${isJa ? '今日の次の一手を1つ完了する' : 'complete one next action today'}`,
      status: '未着手',
      importance,
      category: isJa ? '仕事' : 'Work',
      deadline: localDateKey(),
    });
    const slug = compactMatchText(project.name) || String(index + 1);

    return [
      {
        id: `calendar-${index}-${slug}`,
        scope: 'calendar',
        endpoint: '/api/calendar-action',
        title: `${project.name}: ${isJa ? '予定化' : 'schedule block'}`,
        detail: displayDateTimeRange(slot.start, slot.end),
        payload: calendarPayload,
        selected: index === 0,
      },
      {
        id: `task-${index}-${slug}`,
        scope: 'task',
        endpoint: '/api/task-action',
        title: `${project.name}: ${isJa ? 'タスク化' : 'task'}`,
        detail: `${importance} / ${project.signal || (isJa ? '次の一手を明確化' : 'clarify the next action')}`,
        payload: taskPayload,
        selected: index === 0,
      },
    ];
  });

  return {
    calendarForm,
    taskForm,
    proposals,
    reply: isJa
      ? [
          'プロジェクト文脈から予定案・タスク案を生成しました。',
          '',
          '予定案:',
          ...scheduleLines,
          '',
          'Notionタスク案:',
          ...taskLines,
          '',
          `最優先は「${primary.name}」です。生成案リストから選択して「選択案を承認キューへ」で一括登録できます。`,
        ].join('\n')
      : [
          'Generated schedule and task proposals from the project context.',
          '',
          'Schedule proposals:',
          ...scheduleLines,
          '',
          'Notion task proposals:',
          ...taskLines,
          '',
          `Top priority is "${primary.name}". Select proposals and add them to the approval queue in one batch.`,
        ].join('\n'),
  };
}

function blockProjectLabel(block: ThoughtBlock, projects: Project[]) {
  const project = block.projectId ? projects.find((item) => item.id === block.projectId) : undefined;
  return project ? ` / ${project.name}` : '';
}

function buildDistillContext({
  selectedBlock,
  projects,
  todayBlocks,
  focusProjects,
  totalBlocks,
}: Pick<AiSecretaryPanelProps, 'selectedBlock' | 'projects' | 'todayBlocks' | 'focusProjects' | 'totalBlocks'>) {
  const selected = selectedBlock
    ? `選択中の思考:\n- ${selectedBlock.content}${blockProjectLabel(selectedBlock, projects)}`
    : '選択中の思考: なし';
  const today = todayBlocks.length
    ? todayBlocks.slice(0, 8).map((block) => `- ${block.content}${blockProjectLabel(block, projects)}`).join('\n')
    : '- 今日のDistillブロックはまだありません';
  const focus = focusProjects.length
    ? focusProjects.map((project) => `- ${project.name}: ${project.blocks}件`).join('\n')
    : '- フォーカス中のプロジェクトなし';

  return [
    'Distillで整理した思考コンテキストです。',
    '',
    selected,
    '',
    `Vault内ブロック数: ${totalBlocks}`,
    '',
    '今日の思考:',
    today,
    '',
    'フォーカスプロジェクト:',
    focus,
    '',
    '依頼: この内容を踏まえて、今日の予定・タスク・次の一手に落としてください。',
  ].join('\n');
}

function eventTime(event: SecretaryEvent) {
  if (event.timeRange) return event.timeRange;
  if (!event.start) return '時刻未定';
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : null;
  if (Number.isNaN(start.getTime())) return event.start;
  const startText = start.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  const endText = end && !Number.isNaN(end.getTime()) ? end.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '';
  return endText ? `${startText} - ${endText}` : startText;
}

function taskMeta(task: SecretaryTask) {
  return [task.importance, task.status, task.deadline ? `期限 ${task.deadline}` : null].filter(Boolean).join(' / ');
}

function eventLine(event: SecretaryEvent) {
  return `${eventTime(event)} ${event.title}${event.period ? ` (${event.period})` : ''}`;
}

function buildSecretaryContext(schedule: SecretarySchedule, distillContext: string) {
  const events = schedule.events.length
    ? schedule.events.slice(0, 10).map((event) => `- ${eventLine(event)}`).join('\n')
    : '- 予定なし';
  const tasks = schedule.tasks.length
    ? schedule.tasks.slice(0, 10).map((task) => `- ${task.task}${taskMeta(task) ? ` / ${taskMeta(task)}` : ''}`).join('\n')
    : '- タスクなし';

  return [
    '現在のAI秘書コンテキスト:',
    '',
    `日付: ${schedule.today || new Date().toLocaleDateString('ja-JP')}`,
    '',
    '予定:',
    events,
    '',
    'タスク:',
    tasks,
    '',
    'Distill文脈:',
    distillContext,
  ].join('\n');
}

function looksLikeScheduleSummaryRequest(message: string) {
  return /(予定|スケジュール|今日|明日|次の予定)/.test(message) && /(要約|一言|まとめ|教えて|何|確認)/.test(message);
}

function buildLocalScheduleReply(message: string, schedule: SecretarySchedule) {
  if (!looksLikeScheduleSummaryRequest(message)) return '';
  if (schedule.events.length === 0) {
    return '今見えている予定はありません。空き時間は、重要タスクかDistillでの目標整理に使えます。';
  }

  const nextEvent = schedule.events.find((event) => event.isNow) || schedule.events[0];
  const rest = schedule.events
    .filter((event) => event !== nextEvent)
    .slice(0, 3)
    .map(eventLine)
    .join('、');
  return rest
    ? `直近は「${eventLine(nextEvent)}」。その後は ${rest} が入っています。`
    : `直近は「${eventLine(nextEvent)}」です。`;
}

export function AiSecretaryPanel({
  locale,
  aiSecretaryUrl,
  draftPrompt,
  draftPromptKey,
  selectedBlock,
  store,
  projects,
  todayBlocks,
  focusProjects,
  totalBlocks,
}: AiSecretaryPanelProps) {
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [password, setPassword] = useState('');
  const [schedule, setSchedule] = useState<SecretarySchedule>({ today: '', events: [], tasks: [] });
  const [messages, setMessages] = useState<SecretaryChatRecord[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [queuedApprovals, setQueuedApprovals] = useState<PendingApproval[]>([]);
  const [projectPlanProposals, setProjectPlanProposals] = useState<ProjectPlanProposal[]>([]);
  const [operationHistory, setOperationHistory] = useState<OperationHistoryEntry[]>(() => readOperationHistory());
  const [operationHistoryReady, setOperationHistoryReady] = useState(false);
  const [operationHistoryQuery, setOperationHistoryQuery] = useState('');
  const [operationHistoryStatusFilter, setOperationHistoryStatusFilter] = useState<OperationHistoryStatusFilter>('all');
  const [operationHistoryScopeFilter, setOperationHistoryScopeFilter] = useState<OperationHistoryScopeFilter>('all');
  const [calendarForm, setCalendarForm] = useState<CalendarForm>({
    action: 'create',
    eventId: '',
    title: '移動',
    start: defaultDateTime(14, 30),
    end: defaultDateTime(15, 0),
    location: '',
    description: 'DistillからAI秘書経由で作成',
  });
  const [taskForm, setTaskForm] = useState<TaskForm>({
    action: 'create',
    pageId: '',
    task: '',
    status: '未着手',
    importance: 'Medium',
    category: '生活',
    deadline: '',
  });
  const distillContext = useMemo(
    () => buildDistillContext({ selectedBlock, projects, todayBlocks, focusProjects, totalBlocks }),
    [selectedBlock, projects, todayBlocks, focusProjects, totalBlocks],
  );
  const isJa = locale === 'ja';
  const labels = {
    eyebrow: isJa ? 'AI秘書 Native Integration' : 'AI Secretary Native Integration',
    title: isJa ? 'AI秘書' : 'AI Secretary',
    body: isJa
      ? 'AI秘書アプリを読み込むのではなく、Distillの画面内で予定・タスク・チャットを直接操作します。'
      : 'Use schedule, tasks, and chat directly inside Distill instead of loading the full AI Secretary app.',
    refresh: isJa ? '同期更新' : 'Refresh',
    open: isJa ? 'AI秘書本体を開く' : 'Open full app',
    sendVault: isJa ? '思考をAI秘書へ送る' : 'Send thoughts to AI Secretary',
    login: isJa ? 'AI秘書にログイン' : 'Sign in',
    password: isJa ? 'AI秘書パスワード' : 'AI Secretary password',
    useContext: isJa ? 'Distill文脈を入力へ入れる' : 'Add Distill context',
    send: isJa ? '送信' : 'Send',
    schedule: isJa ? '今日以降の予定' : 'Schedule',
    tasks: isJa ? 'タスク' : 'Tasks',
    operations: isJa ? '予定・タスク操作' : 'Calendar / task operations',
    calendarOperation: isJa ? 'Googleカレンダー操作' : 'Google Calendar action',
    taskOperation: isJa ? 'Notionタスク操作' : 'Notion task action',
    chat: isJa ? '秘書チャット' : 'Secretary chat',
    context: isJa ? 'Distill文脈' : 'Distill context',
    create: isJa ? '追加' : 'Create',
    update: isJa ? '編集' : 'Update',
    delete: isJa ? '削除' : 'Delete',
    requestApproval: isJa ? '承認を作成' : 'Request approval',
    approveAndRun: isJa ? '承認して実行' : 'Approve and run',
    rejectApproval: isJa ? '却下' : 'Reject',
    generatedProposals: isJa ? '生成された予定・タスク案' : 'Generated schedule and task proposals',
    queueSelected: isJa ? '選択案を承認キューへ' : 'Add selected to approval queue',
    noProposalSelected: isJa ? '承認キューへ積む案を選択してください。' : 'Select proposals to add to the approval queue.',
    operationHistory: isJa ? '実行履歴' : 'Execution history',
    operationHistoryHelp: isJa
      ? '承認後に実行した操作、却下した操作、失敗した操作を残します。失敗した操作は同じ承認IDで再試行できます。'
      : 'Track approved, rejected, and failed operations. Failed operations can be retried with the same approval ID.',
    retry: isJa ? '再試行' : 'Retry',
    clearHistory: isJa ? '履歴を消す' : 'Clear history',
    completed: isJa ? '完了' : 'Completed',
    failed: isJa ? '失敗' : 'Failed',
    rejected: isJa ? '却下' : 'Rejected',
    allHistory: isJa ? 'すべて' : 'All',
    searchHistory: isJa ? '履歴を検索' : 'Search history',
    calendarOnly: isJa ? 'カレンダー' : 'Calendar',
    taskOnly: isJa ? 'タスク' : 'Tasks',
    noHistoryMatches: isJa ? '条件に合う履歴がありません。' : 'No history matches the filters.',
    recoverySuggestion: isJa ? '復旧提案' : 'Recovery suggestion',
    regenerateProposal: isJa ? '同じ案を再生成' : 'Regenerate proposal',
    regeneratedFromHistory: isJa ? '履歴から同じ案を再生成しました。承認キューへ積むまで外部には反映されません。' : 'Regenerated the proposal from history. Nothing is applied until it is added to the approval queue.',
    noEvents: isJa ? '表示できる予定がありません。' : 'No visible events.',
    noTasks: isJa ? '表示できるタスクがありません。' : 'No visible tasks.',
    noMessages: isJa ? 'まだ同期済みの会話がありません。' : 'No synced conversation yet.',
  };
  const selectedProjectPlanProposals = useMemo(
    () => projectPlanProposals.filter((proposal) => proposal.selected),
    [projectPlanProposals],
  );
  const visibleOperationHistory = useMemo(() => {
    const query = operationHistoryQuery.trim().toLowerCase();
    return operationHistory.filter((entry) => {
      if (operationHistoryStatusFilter !== 'all' && entry.status !== operationHistoryStatusFilter) return false;
      if (operationHistoryScopeFilter !== 'all' && entry.scope !== operationHistoryScopeFilter) return false;
      return !query || operationHistorySearchText(entry).includes(query);
    });
  }, [operationHistory, operationHistoryQuery, operationHistoryScopeFilter, operationHistoryStatusFilter]);
  const historyStatusLabels: Record<OperationHistoryStatus, string> = {
    completed: labels.completed,
    failed: labels.failed,
    rejected: labels.rejected,
  };

  useEffect(() => {
    const prompt = draftPrompt?.trim();
    if (!prompt) return;

    const projectPlanDraft = buildProjectPlanDraft(prompt, schedule, isJa);
    if (projectPlanDraft) {
      setCalendarForm(projectPlanDraft.calendarForm);
      setTaskForm(projectPlanDraft.taskForm);
      setProjectPlanProposals(projectPlanDraft.proposals);
    }

    setInput(prompt);
    setStatus(
      projectPlanDraft
        ? isJa
          ? 'プロジェクト文脈から予定案・タスク案を生成しました。送信すると提案の詳細を会話に残します。'
          : 'Generated schedule and task proposals from the project context. Send to keep the proposal in chat.'
        : isJa
          ? 'プロジェクト文脈を秘書チャットにセットしました。送信すると予定・タスク提案に変換します。'
          : 'Project context is ready in chat. Send it to convert into schedule and task proposals.',
    );
  }, [draftPrompt, draftPromptKey, isJa, schedule]);

  const loadSecretary = async () => {
    setIsLoading(true);
    setStatus('');
    try {
      const session = await secretaryRequest<{ authenticated?: boolean }>(aiSecretaryUrl, '/api/auth/session', { method: 'GET' }, 8000);
      if (!session.authenticated) {
        setAuthState('unauthorized');
        setOperationHistoryReady(false);
        return;
      }
      setAuthState('authenticated');
      const [nextSchedule, history, serverOperationHistory] = await Promise.all([
        secretaryRequest<Record<string, unknown>>(aiSecretaryUrl, '/api/schedule', { method: 'GET' }),
        secretaryRequest<{ records?: unknown }>(aiSecretaryUrl, '/api/chat-history', { method: 'GET' }),
        secretaryRequest<{ records?: unknown }>(aiSecretaryUrl, '/api/operation-history', { method: 'GET' })
          .catch(() => ({ records: [] })),
      ]);
      setSchedule({
        today: text(nextSchedule.today, new Date().toLocaleDateString('ja-JP')),
        events: normalizeEvents(nextSchedule.events),
        tasks: normalizeTasks(nextSchedule.tasks),
      });
      setMessages(normalizeChatRecords(history.records));
      const mergedOperationHistory = mergeOperationHistoryRecords(
        readOperationHistory(),
        normalizeOperationHistoryRecords(serverOperationHistory.records),
      );
      setOperationHistory(mergedOperationHistory);
      setOperationHistoryReady(true);
      setStatus(isJa ? 'AI秘書データを同期しました。' : 'AI Secretary data synced.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'AI秘書との同期に失敗しました。');
      setAuthState('unauthorized');
      setOperationHistoryReady(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSecretary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiSecretaryUrl]);

  useEffect(() => {
    writeOperationHistory(operationHistory);
    if (authState !== 'authenticated' || !operationHistoryReady) return undefined;
    const timer = window.setTimeout(() => {
      void secretaryRequest(aiSecretaryUrl, '/api/operation-history', {
        method: 'PUT',
        body: JSON.stringify({ records: operationHistory }),
      }).catch(() => {
        // 履歴同期は再読込時に再試行されるため、UI操作は止めない。
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [aiSecretaryUrl, authState, operationHistory, operationHistoryReady]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!password.trim()) return;
    setIsLoading(true);
    setStatus('');
    try {
      await secretaryRequest(aiSecretaryUrl, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password: password.trim() }),
      });
      setPassword('');
      await loadSecretary();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'ログインに失敗しました。');
      setAuthState('unauthorized');
    } finally {
      setIsLoading(false);
    }
  };

  const addDistillContextToInput = () => {
    setInput((current) => (current.trim() ? `${current.trim()}\n\n${distillContext}` : distillContext));
  };

  const openAiSecretaryImport = () => {
    const importUrl = buildAiSecretaryImportUrl(aiSecretaryUrl, store);
    window.open(importUrl, '_blank', 'noopener,noreferrer');
    setStatus(
      isJa
        ? 'AI秘書の思考整理へDistill JSONを送信しました。開いた画面で「JSONを取り込む」を押してください。'
        : 'Distill JSON was sent to AI Secretary Thinking. Click “Import JSON” in the opened screen.',
    );
  };

  const persistMessages = async (records: SecretaryChatRecord[]) => {
    await secretaryRequest(aiSecretaryUrl, '/api/chat-history', {
      method: 'PUT',
      body: JSON.stringify({ records }),
    });
  };

  const selectCalendarEvent = (eventId: string) => {
    const event = schedule.events.find((item) => item.id === eventId);
    setCalendarForm((current) => ({
      ...current,
      eventId,
      title: event?.title || current.title,
      start: toDateTimeLocalValue(event?.start) || current.start,
      end: toDateTimeLocalValue(event?.end) || current.end,
      location: event?.location || current.location,
    }));
  };

  const selectTask = (pageId: string) => {
    const task = schedule.tasks.find((item) => item.id === pageId);
    setTaskForm((current) => ({
      ...current,
      pageId,
      task: task?.task || current.task,
      status: task?.status || current.status,
      importance: task?.importance || current.importance,
      category: task?.category || current.category,
      deadline: task?.deadline || '',
    }));
  };

  const buildCalendarPayload = () => {
    if (calendarForm.action === 'delete') {
      return compactPayload({
        action: calendarForm.action,
        eventId: calendarForm.eventId,
      });
    }

    if (calendarForm.action === 'update') {
      return compactPayload({
        action: calendarForm.action,
        eventId: calendarForm.eventId,
        title: calendarForm.title.trim(),
        start: calendarForm.start,
        end: calendarForm.end,
        location: calendarForm.location.trim(),
        description: calendarForm.description.trim(),
      });
    }

    return compactPayload({
      action: calendarForm.action,
      title: calendarForm.title.trim(),
      start: calendarForm.start,
      end: calendarForm.end,
      location: calendarForm.location.trim(),
      description: calendarForm.description.trim(),
    });
  };

  const buildTaskPayload = () => {
    if (taskForm.action === 'delete') {
      return compactPayload({
        action: taskForm.action,
        pageId: taskForm.pageId,
      });
    }

    return compactPayload({
      action: taskForm.action,
      pageId: taskForm.action === 'update' ? taskForm.pageId : undefined,
      task: taskForm.task.trim(),
      status: taskForm.status,
      importance: taskForm.importance,
      category: taskForm.category.trim(),
      deadline: taskForm.deadline || null,
    });
  };

  const operationLabel = (scope: OperationScope, action: string) => {
    const scopeLabel = scope === 'calendar'
      ? (isJa ? 'Googleカレンダー' : 'Google Calendar')
      : (isJa ? 'Notionタスク' : 'Notion task');
    const actionLabel = action === 'create'
      ? labels.create
      : action === 'update'
        ? labels.update
      : labels.delete;
    return `${scopeLabel} ${actionLabel}`;
  };

  const buildPendingApproval = (
    scope: OperationScope,
    endpoint: PendingApproval['endpoint'],
    payload: Record<string, unknown>,
    result: OperationResponse,
  ): PendingApproval => {
    const label = operationLabel(scope, String(payload.action || 'create'));
    return {
      scope,
      endpoint,
      approvalId: result.approvalId || '',
      label,
      payload,
      message: result.message || `${label}の承認が必要です。`,
      preview: buildApprovalPreview(scope, payload, schedule),
    };
  };

  const queuePendingApproval = (approval: PendingApproval) => {
    if (!approval.approvalId) return;
    setPendingApproval(approval);
    setQueuedApprovals((current) => {
      if (current.some((item) => item.approvalId === approval.approvalId)) return current;
      return [...current, approval];
    });
  };

  const removeQueuedApproval = (approvalId: string) => {
    setQueuedApprovals((current) => current.filter((item) => item.approvalId !== approvalId));
    setPendingApproval((current) => current?.approvalId === approvalId ? null : current);
  };

  const recordOperationHistory = (approval: PendingApproval, historyStatus: OperationHistoryStatus, message: string) => {
    const now = new Date().toISOString();
    setOperationHistory((current) => {
      const id = approval.approvalId || `${approval.scope}-${Date.now()}`;
      const index = current.findIndex((item) => item.id === id || (approval.approvalId && item.approvalId === approval.approvalId));
      const previousAttempts = index >= 0 ? current[index].attempts : 0;
      const nextEntry: OperationHistoryEntry = {
        ...(index >= 0 ? current[index] : { createdAt: now }),
        id,
        scope: approval.scope,
        endpoint: approval.endpoint,
        approvalId: approval.approvalId || undefined,
        label: approval.label,
        payload: approval.payload,
        message,
        status: historyStatus,
        preview: approval.preview,
        attempts: historyStatus === 'rejected' ? previousAttempts : previousAttempts + 1,
        updatedAt: now,
      };
      const next = index >= 0
        ? current.map((item, itemIndex) => (itemIndex === index ? nextEntry : item))
        : [nextEntry, ...current];
      return next.slice(0, OPERATION_HISTORY_LIMIT);
    });
  };

  const toggleProjectPlanProposal = (proposalId: string) => {
    setProjectPlanProposals((current) =>
      current.map((proposal) =>
        proposal.id === proposalId ? { ...proposal, selected: !proposal.selected } : proposal,
      ),
    );
  };

  const requestMutation = async (
    scope: OperationScope,
    endpoint: PendingApproval['endpoint'],
    payload: Record<string, unknown>,
  ) => {
    if (authState !== 'authenticated') return;
    setIsMutating(true);
    setStatus('');
    try {
      const result = await secretaryRequest<OperationResponse>(aiSecretaryUrl, endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const label = operationLabel(scope, String(payload.action || 'create'));
      if (result.approvalRequired && result.approvalId) {
        queuePendingApproval(buildPendingApproval(scope, endpoint, payload, result));
        setStatus(isJa ? `${label}の承認を作成しました。` : `${label} approval requested.`);
        return;
      }

      setPendingApproval(null);
      setStatus(result.message || (isJa ? `${label}を実行しました。` : `${label} completed.`));
      await loadSecretary();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '操作に失敗しました。');
    } finally {
      setIsMutating(false);
    }
  };

  const handleCalendarSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = buildCalendarPayload();
    if (calendarForm.action === 'create' && (!payload.title || !payload.start || !payload.end)) {
      setStatus(isJa ? '予定のタイトル、開始、終了を入力してください。' : 'Enter title, start, and end.');
      return;
    }
    if ((calendarForm.action === 'update' || calendarForm.action === 'delete') && !payload.eventId) {
      setStatus(isJa ? '編集・削除する予定を選択してください。' : 'Select an event to update or delete.');
      return;
    }
    await requestMutation('calendar', '/api/calendar-action', payload);
  };

  const handleTaskSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = buildTaskPayload();
    if ((taskForm.action === 'create' || taskForm.action === 'update') && !payload.task) {
      setStatus(isJa ? 'タスク名を入力してください。' : 'Enter a task name.');
      return;
    }
    if ((taskForm.action === 'update' || taskForm.action === 'delete') && !payload.pageId) {
      setStatus(isJa ? '編集・削除するタスクを選択してください。' : 'Select a task to update or delete.');
      return;
    }
    await requestMutation('task', '/api/task-action', payload);
  };

  const requestSelectedProjectPlanApprovals = async () => {
    if (authState !== 'authenticated') return;
    if (selectedProjectPlanProposals.length === 0) {
      setStatus(labels.noProposalSelected);
      return;
    }

    setIsMutating(true);
    setStatus('');
    try {
      let requestedCount = 0;
      for (const proposal of selectedProjectPlanProposals) {
        const result = await secretaryRequest<OperationResponse>(aiSecretaryUrl, proposal.endpoint, {
          method: 'POST',
          body: JSON.stringify(proposal.payload),
        });
        if (result.approvalRequired && result.approvalId) {
          queuePendingApproval(buildPendingApproval(proposal.scope, proposal.endpoint, proposal.payload, result));
          requestedCount += 1;
        }
      }

      setStatus(
        isJa
          ? `${requestedCount}件の案を承認キューへ追加しました。承認するまでGoogleカレンダー/Notionには反映されません。`
          : `${requestedCount} proposal(s) added to the approval queue. Nothing is applied until approval.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '承認キューへの追加に失敗しました。');
    } finally {
      setIsMutating(false);
    }
  };

  const approveAndRunApproval = async (approval: PendingApproval, options: { tolerateApprovalFailure?: boolean } = {}) => {
    setIsMutating(true);
    setStatus('');
    try {
      let approvalWarning = '';
      try {
        await secretaryRequest<OperationResponse>(aiSecretaryUrl, '/api/approval-queue/approve', {
          method: 'POST',
          body: JSON.stringify({
            approvalId: approval.approvalId,
            reason: 'Approved from Distill native AI Secretary panel.',
          }),
        });
      } catch (error) {
        if (!options.tolerateApprovalFailure) throw error;
        approvalWarning = error instanceof Error ? error.message : 'Approval confirmation failed.';
      }
      const result = await secretaryRequest<OperationResponse>(aiSecretaryUrl, approval.endpoint, {
        method: 'POST',
        body: JSON.stringify({
          ...approval.payload,
          approvalId: approval.approvalId,
        }),
      });
      const message = [
        result.message || (isJa ? `${approval.label}を実行しました。` : `${approval.label} completed.`),
        approvalWarning ? (isJa ? `承認再確認: ${approvalWarning}` : `Approval re-check: ${approvalWarning}`) : '',
      ].filter(Boolean).join(' / ');
      setStatus(message);
      recordOperationHistory(approval, 'completed', message);
      removeQueuedApproval(approval.approvalId);
      await loadSecretary();
    } catch (error) {
      const message = error instanceof Error ? error.message : '承認済み操作の実行に失敗しました。';
      setStatus(message);
      recordOperationHistory(approval, 'failed', message);
    } finally {
      setIsMutating(false);
    }
  };

  const approveAndRunPending = async () => {
    if (!pendingApproval) return;
    await approveAndRunApproval(pendingApproval);
  };

  const rejectApproval = async (approval: PendingApproval) => {
    setIsMutating(true);
    setStatus('');
    try {
      await secretaryRequest<OperationResponse>(aiSecretaryUrl, '/api/approval-queue/reject', {
        method: 'POST',
        body: JSON.stringify({
          approvalId: approval.approvalId,
          reason: 'Rejected from Distill native AI Secretary panel.',
        }),
      });
      const message = isJa ? `${approval.label}を却下しました。` : `${approval.label} rejected.`;
      setStatus(message);
      recordOperationHistory(approval, 'rejected', message);
      removeQueuedApproval(approval.approvalId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '承認却下に失敗しました。');
    } finally {
      setIsMutating(false);
    }
  };

  const rejectPendingApproval = async () => {
    if (!pendingApproval) return;
    await rejectApproval(pendingApproval);
  };

  const retryOperationHistory = async (entry: OperationHistoryEntry) => {
    if (!entry.approvalId) return;
    await approveAndRunApproval({
      scope: entry.scope,
      endpoint: entry.endpoint,
      approvalId: entry.approvalId,
      label: entry.label,
      payload: entry.payload,
      message: entry.message,
      preview: entry.preview,
    }, { tolerateApprovalFailure: true });
  };

  const regenerateOperationProposal = (entry: OperationHistoryEntry) => {
    const payload = payloadWithoutApproval(entry.payload);
    const proposal: ProjectPlanProposal = {
      id: `history-${entry.id}-${Date.now()}`,
      scope: entry.scope,
      endpoint: entry.endpoint,
      title: entry.label,
      detail: `${entry.preview.title} / ${historyTimestamp(entry.updatedAt)}`,
      payload,
      selected: true,
    };

    if (entry.scope === 'calendar') {
      setCalendarForm((current) => ({
        ...current,
        action: calendarActionFromPayload(payload.action),
        eventId: text(payload.eventId),
        title: text(payload.title, current.title),
        start: toDateTimeLocalValue(text(payload.start)) || text(payload.start, current.start),
        end: toDateTimeLocalValue(text(payload.end)) || text(payload.end, current.end),
        location: text(payload.location),
        description: text(payload.description, current.description),
      }));
    } else {
      setTaskForm((current) => ({
        ...current,
        action: taskActionFromPayload(payload.action),
        pageId: text(payload.pageId),
        task: text(payload.task, current.task || entry.label),
        status: text(payload.status, current.status),
        importance: text(payload.importance, current.importance),
        category: text(payload.category, current.category),
        deadline: text(payload.deadline),
      }));
    }

    setProjectPlanProposals((current) => [
      proposal,
      ...current.filter((item) => item.id !== proposal.id).map((item) => ({ ...item, selected: false })),
    ].slice(0, 8));
    setStatus(labels.regeneratedFromHistory);
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || isSending || authState !== 'authenticated') return;
    const userRecord = createChatRecord('user', message);
    const optimistic = [...messages, userRecord].slice(-20);
    setMessages(optimistic);
    setInput('');
    setIsSending(true);
    setStatus('');
    try {
      const projectPlanDraft = buildProjectPlanDraft(message, schedule, isJa);
      if (projectPlanDraft) {
        setCalendarForm(projectPlanDraft.calendarForm);
        setTaskForm(projectPlanDraft.taskForm);
        setProjectPlanProposals(projectPlanDraft.proposals);
        const aiRecord = createChatRecord('ai', projectPlanDraft.reply);
        const nextMessages = [...optimistic, aiRecord].slice(-20);
        setMessages(nextMessages);
        await persistMessages(nextMessages);
        setStatus(isJa ? 'プロジェクト文脈から予定案・タスク案を生成しました。' : 'Generated project schedule and task proposals.');
        return;
      }

      const operationDraft = parseChatOperationDraft(message, schedule);
      if (operationDraft) {
        if (operationDraft.calendarForm) setCalendarForm(operationDraft.calendarForm);
        if (operationDraft.taskForm) setTaskForm(operationDraft.taskForm);
        const aiRecord = createChatRecord('ai', operationDraft.reply);
        const nextMessages = [...optimistic, aiRecord].slice(-20);
        setMessages(nextMessages);
        await requestMutation(operationDraft.scope, operationDraft.endpoint, operationDraft.payload);
        await persistMessages(nextMessages);
        return;
      }

      const localReply = buildLocalScheduleReply(message, schedule);
      if (localReply) {
        const aiRecord = createChatRecord('ai', localReply);
        const nextMessages = [...optimistic, aiRecord].slice(-20);
        setMessages(nextMessages);
        await persistMessages(nextMessages);
        setStatus(isJa ? '予定文脈からローカル要約しました。' : 'Answered from local schedule context.');
        return;
      }

      const contextualMessage = [
        message,
        '',
        buildSecretaryContext(schedule, distillContext),
      ].join('\n');
      const reply = await secretaryRequest<{ reply?: string }>(aiSecretaryUrl, '/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: contextualMessage, sessionId: 'takeshi' }),
      });
      const aiRecord = createChatRecord('ai', text(reply.reply, '返信を取得できませんでした。'));
      const nextMessages = [...optimistic, aiRecord].slice(-20);
      setMessages(nextMessages);
      await persistMessages(nextMessages);
      setStatus(isJa ? '会話をAI秘書へ同期しました。' : 'Conversation synced to AI Secretary.');
    } catch (error) {
      const aiRecord = createChatRecord('ai', error instanceof Error ? error.message : 'AI秘書への送信に失敗しました。');
      setMessages([...optimistic, aiRecord].slice(-20));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="panel aiSecretaryPanel" id="ai-secretary" aria-label={labels.title}>
      <div className="panelHeader aiSecretaryHeader">
        <div>
          <p>{labels.eyebrow}</p>
          <h2>{labels.title}</h2>
          <span>{labels.body}</span>
        </div>
        <div className="panelHeaderActions">
          <button className="secondaryActionButton" type="button" onClick={openAiSecretaryImport}>
            <Send size={16} />
            {labels.sendVault}
          </button>
          <a className="secondaryActionLink" href={aiSecretaryUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={16} />
            {labels.open}
          </a>
          <button className="secondaryActionButton" type="button" onClick={() => void loadSecretary()} disabled={isLoading}>
            <RefreshCcw size={16} />
            {labels.refresh}
          </button>
        </div>
      </div>

      {authState !== 'authenticated' ? (
        <form className="aiSecretaryLoginCard" onSubmit={handleLogin}>
          <KeyRound size={22} />
          <div>
            <strong>{labels.login}</strong>
            <span>DistillからAI秘書APIを直接使うため、AI秘書のセッションを作成します。</span>
          </div>
          <input
            aria-label={labels.password}
            type="password"
            value={password}
            placeholder={labels.password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button className="primaryActionButton" type="submit" disabled={isLoading || !password.trim()}>
            {labels.login}
          </button>
        </form>
      ) : null}

      {status ? <div className="handoffStatus">{status}</div> : null}

      {queuedApprovals.length > 0 ? (
        <div className="aiSecretaryApprovalStack" role="status">
          {queuedApprovals.map((approval) => (
            <div className="aiSecretaryApprovalBanner" key={approval.approvalId}>
              <ShieldCheck size={20} />
              <div>
                <strong>{approval.label} / 承認待ち</strong>
                <span>{approval.message}</span>
                <code>{approval.approvalId}</code>
                <div className="aiSecretaryApprovalPreview">
                  <strong>{approval.preview.title}</strong>
                  <p>{approval.preview.risk}</p>
                  <dl>
                    {approval.preview.rows.map((row) => (
                      <div key={`${row.label}-${row.before || ''}-${row.after}`}>
                        <dt>{row.label}</dt>
                        <dd>
                          {row.before !== undefined ? <span>{row.before}</span> : null}
                          {row.before !== undefined ? <b>→</b> : null}
                          <span>{row.after}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
              <button className="primaryActionButton" type="button" onClick={() => void approveAndRunApproval(approval)} disabled={isMutating}>
                <CheckCircle2 size={16} />
                {labels.approveAndRun}
              </button>
              <button className="secondaryActionButton" type="button" onClick={() => void rejectApproval(approval)} disabled={isMutating}>
                <XCircle size={16} />
                {labels.rejectApproval}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {authState === 'authenticated' && operationHistory.length > 0 ? (
        <section className="aiSecretaryHistoryPanel" aria-label={labels.operationHistory}>
          <div className="aiSecretaryCardHeader">
            <RefreshCcw size={18} />
            <div>
              <strong>{labels.operationHistory}</strong>
              <span>{labels.operationHistoryHelp}</span>
            </div>
            <button className="secondaryActionButton" type="button" onClick={() => setOperationHistory([])} disabled={isMutating}>
              {labels.clearHistory}
            </button>
          </div>
          <div className="aiSecretaryHistoryFilters">
            <input
              type="search"
              value={operationHistoryQuery}
              placeholder={labels.searchHistory}
              aria-label={labels.searchHistory}
              onChange={(event) => setOperationHistoryQuery(event.target.value)}
            />
            <select
              value={operationHistoryStatusFilter}
              aria-label={labels.operationHistory}
              onChange={(event) => setOperationHistoryStatusFilter(event.target.value as OperationHistoryStatusFilter)}
            >
              <option value="all">{labels.allHistory}</option>
              <option value="completed">{labels.completed}</option>
              <option value="failed">{labels.failed}</option>
              <option value="rejected">{labels.rejected}</option>
            </select>
            <select
              value={operationHistoryScopeFilter}
              aria-label={labels.operations}
              onChange={(event) => setOperationHistoryScopeFilter(event.target.value as OperationHistoryScopeFilter)}
            >
              <option value="all">{labels.allHistory}</option>
              <option value="calendar">{labels.calendarOnly}</option>
              <option value="task">{labels.taskOnly}</option>
            </select>
          </div>
          <div className="aiSecretaryHistoryList">
            {visibleOperationHistory.length > 0 ? visibleOperationHistory.map((entry) => {
              const recovery = operationRecoverySuggestion(entry, isJa);
              return (
                <article className={`aiSecretaryHistoryItem ${entry.status}`} key={entry.id}>
                  <div>
                    <b>{historyStatusLabels[entry.status]}</b>
                    <strong>{entry.label}</strong>
                    <span>{historyTimestamp(entry.updatedAt)} / {entry.message}</span>
                    {entry.approvalId ? <code>{entry.approvalId}</code> : null}
                    <small>{entry.preview.title} / {entry.attempts} attempt{entry.attempts === 1 ? '' : 's'}</small>
                    {recovery ? (
                      <p className="aiSecretaryRecoveryHint">
                        <Sparkles size={14} />
                        <span>
                          <strong>{labels.recoverySuggestion}: {recovery.title}</strong>
                          {recovery.detail}
                        </span>
                      </p>
                    ) : null}
                  </div>
                  <div className="aiSecretaryHistoryActions">
                    <button className="secondaryActionButton" type="button" onClick={() => regenerateOperationProposal(entry)} disabled={isMutating}>
                      <Sparkles size={16} />
                      {labels.regenerateProposal}
                    </button>
                    {entry.status === 'failed' && entry.approvalId ? (
                      <button className="secondaryActionButton" type="button" onClick={() => void retryOperationHistory(entry)} disabled={isMutating}>
                        <RefreshCcw size={16} />
                        {labels.retry}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            }) : <div className="emptyState">{labels.noHistoryMatches}</div>}
          </div>
        </section>
      ) : null}

      {authState === 'authenticated' && projectPlanProposals.length > 0 ? (
        <section className="aiSecretaryProposalPanel" aria-label={labels.generatedProposals}>
          <div className="aiSecretaryCardHeader">
            <Sparkles size={18} />
            <div>
              <strong>{labels.generatedProposals}</strong>
              <span>
                {isJa
                  ? `${selectedProjectPlanProposals.length}/${projectPlanProposals.length}件を選択中。承認するまで外部には反映されません。`
                  : `${selectedProjectPlanProposals.length}/${projectPlanProposals.length} selected. Nothing is applied until approval.`}
              </span>
            </div>
          </div>
          <div className="aiSecretaryProposalList">
            {projectPlanProposals.map((proposal) => (
              <label className="aiSecretaryProposalItem" key={proposal.id}>
                <input
                  type="checkbox"
                  checked={proposal.selected}
                  onChange={() => toggleProjectPlanProposal(proposal.id)}
                />
                <div>
                  <strong>{proposal.title}</strong>
                  <span>{proposal.detail}</span>
                </div>
                <b>{proposal.scope === 'calendar' ? 'Calendar' : 'Notion'}</b>
              </label>
            ))}
          </div>
          <button
            className="primaryActionButton"
            type="button"
            onClick={() => void requestSelectedProjectPlanApprovals()}
            disabled={isMutating || selectedProjectPlanProposals.length === 0}
          >
            <ShieldCheck size={16} />
            {labels.queueSelected}
          </button>
        </section>
      ) : null}

      {authState === 'authenticated' ? (
        <div className="aiSecretaryNativeGrid">
          <section className="aiSecretaryCard">
            <div className="aiSecretaryCardHeader">
              <CalendarDays size={18} />
              <div>
                <strong>{labels.schedule}</strong>
                <span>{schedule.today}</span>
              </div>
            </div>
            <div className="aiSecretaryList">
              {schedule.events.length > 0 ? schedule.events.map((event) => (
                <article className={`aiSecretaryListItem ${event.isNow ? 'active' : ''}`} key={`${event.title}-${event.start || event.timeRange}`}>
                  <span>{eventTime(event)}</span>
                  <strong>{event.title}</strong>
                  {event.period ? <small>{event.period}</small> : null}
                </article>
              )) : <div className="emptyState">{labels.noEvents}</div>}
            </div>
          </section>

          <section className="aiSecretaryCard">
            <div className="aiSecretaryCardHeader">
              <ListTodo size={18} />
              <div>
                <strong>{labels.tasks}</strong>
                <span>{schedule.tasks.length}件</span>
              </div>
            </div>
            <div className="aiSecretaryList">
              {schedule.tasks.length > 0 ? schedule.tasks.map((task, index) => (
                <article className="aiSecretaryListItem" key={task.id || `${task.task}-${index}`}>
                  <span>{task.category || 'Task'}</span>
                  <strong>{task.task}</strong>
                  <small>{taskMeta(task)}</small>
                </article>
              )) : <div className="emptyState">{labels.noTasks}</div>}
            </div>
          </section>

          <section className="aiSecretaryCard aiSecretaryOperationCard">
            <div className="aiSecretaryCardHeader">
              <CalendarDays size={18} />
              <div>
                <strong>{labels.calendarOperation}</strong>
                <span>承認ゲート経由でGoogleカレンダーへ反映</span>
              </div>
            </div>
            <form className="aiSecretaryOperationForm" onSubmit={handleCalendarSubmit}>
              <label>
                操作
                <select
                  value={calendarForm.action}
                  onChange={(event) => setCalendarForm((current) => ({ ...current, action: event.target.value as CalendarAction }))}
                >
                  <option value="create">{labels.create}</option>
                  <option value="update">{labels.update}</option>
                  <option value="delete">{labels.delete}</option>
                </select>
              </label>
              {calendarForm.action !== 'create' ? (
                <label>
                  対象予定
                  <select value={calendarForm.eventId} onChange={(event) => selectCalendarEvent(event.target.value)}>
                    <option value="">予定を選択</option>
                    {schedule.events.filter((event) => event.id).map((event) => (
                      <option key={event.id} value={event.id}>
                        {eventLine(event)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {calendarForm.action !== 'delete' ? (
                <>
                  <label>
                    タイトル
                    <input
                      value={calendarForm.title}
                      placeholder="移動"
                      onChange={(event) => setCalendarForm((current) => ({ ...current, title: event.target.value }))}
                    />
                  </label>
                  <div className="aiSecretaryFormRow">
                    <label>
                      開始
                      <input
                        type="datetime-local"
                        value={calendarForm.start}
                        onChange={(event) => setCalendarForm((current) => ({ ...current, start: event.target.value }))}
                      />
                    </label>
                    <label>
                      終了
                      <input
                        type="datetime-local"
                        value={calendarForm.end}
                        onChange={(event) => setCalendarForm((current) => ({ ...current, end: event.target.value }))}
                      />
                    </label>
                  </div>
                  <label>
                    場所
                    <input
                      value={calendarForm.location}
                      placeholder="任意"
                      onChange={(event) => setCalendarForm((current) => ({ ...current, location: event.target.value }))}
                    />
                  </label>
                  <label>
                    メモ
                    <textarea
                      value={calendarForm.description}
                      placeholder="任意"
                      onChange={(event) => setCalendarForm((current) => ({ ...current, description: event.target.value }))}
                    />
                  </label>
                </>
              ) : (
                <p className="aiSecretaryDangerText">削除は承認後にGoogleカレンダーへ反映されます。</p>
              )}
              <button className="primaryActionButton" type="submit" disabled={isMutating}>
                {calendarForm.action === 'delete' ? <Trash2 size={16} /> : <PlusCircle size={16} />}
                {labels.requestApproval}
              </button>
            </form>
          </section>

          <section className="aiSecretaryCard aiSecretaryOperationCard">
            <div className="aiSecretaryCardHeader">
              <ListTodo size={18} />
              <div>
                <strong>{labels.taskOperation}</strong>
                <span>期限なしタスクもNotionへ送信可能</span>
              </div>
            </div>
            <form className="aiSecretaryOperationForm" onSubmit={handleTaskSubmit}>
              <label>
                操作
                <select
                  value={taskForm.action}
                  onChange={(event) => setTaskForm((current) => ({ ...current, action: event.target.value as TaskAction }))}
                >
                  <option value="create">{labels.create}</option>
                  <option value="update">{labels.update}</option>
                  <option value="delete">{labels.delete}</option>
                </select>
              </label>
              {taskForm.action !== 'create' ? (
                <label>
                  対象タスク
                  <select value={taskForm.pageId} onChange={(event) => selectTask(event.target.value)}>
                    <option value="">タスクを選択</option>
                    {schedule.tasks.filter((task) => task.id).map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.task}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {taskForm.action !== 'delete' ? (
                <>
                  <label>
                    タスク名
                    <input
                      value={taskForm.task}
                      placeholder="食事の買い出し"
                      onChange={(event) => setTaskForm((current) => ({ ...current, task: event.target.value }))}
                    />
                  </label>
                  <div className="aiSecretaryFormRow">
                    <label>
                      状態
                      <select value={taskForm.status} onChange={(event) => setTaskForm((current) => ({ ...current, status: event.target.value }))}>
                        <option value="未着手">未着手</option>
                        <option value="進行中">進行中</option>
                        <option value="完了">完了</option>
                      </select>
                    </label>
                    <label>
                      重要度
                      <select value={taskForm.importance} onChange={(event) => setTaskForm((current) => ({ ...current, importance: event.target.value }))}>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </label>
                  </div>
                  <div className="aiSecretaryFormRow">
                    <label>
                      カテゴリ
                      <input
                        value={taskForm.category}
                        placeholder="生活"
                        onChange={(event) => setTaskForm((current) => ({ ...current, category: event.target.value }))}
                      />
                    </label>
                    <label>
                      期限
                      <input
                        type="date"
                        value={taskForm.deadline}
                        onChange={(event) => setTaskForm((current) => ({ ...current, deadline: event.target.value }))}
                      />
                    </label>
                  </div>
                </>
              ) : (
                <p className="aiSecretaryDangerText">削除はNotionタスクのアーカイブとして処理されます。</p>
              )}
              <button className="primaryActionButton" type="submit" disabled={isMutating}>
                {taskForm.action === 'delete' ? <Trash2 size={16} /> : <PlusCircle size={16} />}
                {labels.requestApproval}
              </button>
            </form>
          </section>

          <section className="aiSecretaryCard aiSecretaryContextCard">
            <div className="aiSecretaryCardHeader">
              <Target size={18} />
              <div>
                <strong>{labels.context}</strong>
                <span>{selectedBlock ? '選択中メモあり' : `${todayBlocks.length}件の今日メモ`}</span>
              </div>
            </div>
            <pre>{distillContext}</pre>
            <button className="secondaryActionButton" type="button" onClick={addDistillContextToInput}>
              <Sparkles size={16} />
              {labels.useContext}
            </button>
          </section>

          <section className="aiSecretaryCard aiSecretaryChatCard">
            <div className="aiSecretaryCardHeader">
              <Bot size={18} />
              <div>
                <strong>{labels.chat}</strong>
                <span>AI Secretary API</span>
              </div>
            </div>
            <div className="aiSecretaryChatLog">
              {messages.length > 0 ? messages.map((message) => (
                <article className={`aiSecretaryChatBubble ${message.role}`} key={message.id}>
                  <span>{message.role === 'user' ? 'You' : 'AI Secretary'}</span>
                  <p>{message.content}</p>
                </article>
              )) : <div className="emptyState">{labels.noMessages}</div>}
            </div>
            <form className="aiSecretaryChatForm" onSubmit={handleSend}>
              <textarea
                value={input}
                placeholder="Distillで整理した内容から、今日の次の一手を提案して"
                onChange={(event) => setInput(event.target.value)}
              />
              <button className="primaryActionButton" type="submit" disabled={isSending || !input.trim()}>
                <Send size={16} />
                {isSending ? '送信中...' : labels.send}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
