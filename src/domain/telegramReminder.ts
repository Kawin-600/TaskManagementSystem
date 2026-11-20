import { addDays, formatDateObj } from './dates';
import type { Task } from '../types/models';

export interface TelegramReminder {
  enabled: boolean;
  time: string;
  daysBefore: number;
}

export const defaultTelegramReminder: TelegramReminder = { enabled: false, time: '09:00', daysBefore: 1 };

export function selectDueReminders(tasks: Task[], userId: string, rule: TelegramReminder, now: Date) {
  const today = formatDateObj(now);
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (!rule.enabled || time < rule.time) return [];
  const dueDate = addDays(today, rule.daysBefore);
  return tasks.filter((task) => task.assigneeId === userId && task.status !== 'completed' && task.dueDate === dueDate);
}
