import type { Task } from '../types/models';

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
] as const;

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
] as const;

export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateObj(dateObj: Date): string {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayStr(now: Date = new Date()): string {
  return formatDateObj(now);
}

export function addDays(dateStr: string, delta: number): string {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + delta);
  return formatDateObj(d);
}

export function calculateDaysBetween(startDateStr: string, dueDateStr: string): number {
  if (!startDateStr || !dueDateStr) return 1;
  const start = parseDateStr(startDateStr);
  const due = parseDateStr(dueDateStr);
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round(Math.abs(dueUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
  return diffDays || 1;
}

export function isTaskOverdue(
  task: Pick<Task, 'dueDate' | 'status'>,
  todayStr: string = getTodayStr(),
): boolean {
  return Boolean(task.dueDate) && task.dueDate < todayStr && task.status !== 'completed';
}

export function formatThaiDateShort(dateStr: string): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-').map(Number);
  const thaiYear = String(y + 543).slice(-2);
  return `${d} ${THAI_MONTHS_SHORT[m - 1] ?? ''} ${thaiYear}`;
}

export function formatThaiDateFull(dateStr: string): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-').map(Number);
  const thaiYear = y + 543;
  return `${d} ${THAI_MONTHS_FULL[m - 1] ?? ''} ${thaiYear}`;
}

export function getThaiMonthYearString(yearMonthStr: string): string {
  const [y, m] = yearMonthStr.split('-').map(Number);
  return `${THAI_MONTHS_FULL[m - 1] ?? ''} ${y + 543}`;
}

export function getMonthYearStr(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function shiftMonth(yearMonthStr: string, delta: number): string {
  const [y, m] = yearMonthStr.split('-').map(Number);
  const next = new Date(y, m - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}
