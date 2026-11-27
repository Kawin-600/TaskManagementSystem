import { participatesInTask } from './rbac';
import { formatDateObj, formatThaiDateShort } from './dates';
import type { Task, TaskPriority, TaskStatus } from '../types/models';

export const telegramPriorities: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];
export const telegramPriorityLabels: Record<TaskPriority, string> = {
  urgent: 'เร่งด่วน', high: 'สูง', medium: 'ปานกลาง', low: 'ต่ำ',
};
export const telegramDigestKinds = ['pending', 'newTasks'] as const;
export type TelegramDigestKind = typeof telegramDigestKinds[number];
export const telegramDigestLimit = 15;
export const telegramTopics = ['created', 'assigned', 'dueDateChanged', 'priorityChanged', 'statusChanged'] as const;
export type TelegramTopic = typeof telegramTopics[number];

export interface TelegramPreferences {
  digests: TelegramDigestKind[];
  priorities: TaskPriority[];
  topics: TelegramTopic[];
}

export const defaultTelegramPreferences: TelegramPreferences = {
  digests: [], priorities: telegramPriorities, topics: [...telegramTopics],
};

export const telegramDigestLabels: Record<TelegramDigestKind, string> = {
  pending: '08:00 · งานที่ยังไม่เสร็จ',
  newTasks: '17:00 · งานที่เพิ่มวันนี้',
};

export function getTelegramDigestKind(now: Date): TelegramDigestKind | undefined {
  const hour = now.getHours();
  return hour >= 17 ? 'newTasks' : hour >= 8 ? 'pending' : undefined;
}

export function selectTelegramDigestTasks(
  tasks: Task[], userId: string, priorities: TaskPriority[], kind: TelegramDigestKind, now: Date,
) {
  const today = formatDateObj(now);
  return tasks.filter((task) => {
    if (!participatesInTask(task, userId) || !priorities.includes(task.priority)) return false;
    if (kind === 'pending') return task.status !== 'completed';
    const createdDate = task.createdAt.length === 10 ? task.createdAt : formatDateObj(new Date(task.createdAt));
    return createdDate === today;
  }).sort((a, b) =>
    telegramPriorities.indexOf(a.priority) - telegramPriorities.indexOf(b.priority) ||
    (a.dueDate || '9999').localeCompare(b.dueDate || '9999') ||
    a.title.localeCompare(b.title),
  );
}

export function buildTelegramDigest(
  kind: TelegramDigestKind,
  tasks: Task[],
  statusLabel: (status: TaskStatus) => string,
) {
  return {
    kind,
    total: tasks.length,
    items: tasks.slice(0, telegramDigestLimit).map((task) => ({
      title: task.title.slice(0, 95),
      priority: telegramPriorityLabels[task.priority],
      status: statusLabel(task.status),
      dueDate: task.dueDate ? formatThaiDateShort(task.dueDate) : undefined,
    })),
  };
}
