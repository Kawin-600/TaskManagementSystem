import { describe, it, expect } from 'vitest';
import {
  addDays,
  calculateDaysBetween,
  isTaskOverdue,
  formatThaiDateShort,
  formatThaiDateFull,
  getThaiMonthYearString,
  getMonthYearStr,
  shiftMonth,
  getTodayStr,
} from '../dates';

describe('dates domain', () => {
  it('calculates inclusive days between dates', () => {
    expect(calculateDaysBetween('2026-11-20', '2026-11-20')).toBe(1);
    expect(calculateDaysBetween('2026-11-20', '2026-11-24')).toBe(5);
  });

  it('adds days and shifts months across year boundaries', () => {
    expect(addDays('2026-11-29', 3)).toBe('2026-12-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(getMonthYearStr('2026-11-20')).toBe('2026-11');
  });

  it('formats current date as YYYY-MM-DD', () => {
    expect(getTodayStr(new Date(2026, 10, 5))).toBe('2026-11-05');
  });

  it('formats Thai Buddhist Era short, full, and month-year strings', () => {
    expect(formatThaiDateShort('2026-11-20')).toBe('20 พ.ย. 69');
    expect(formatThaiDateFull('2026-11-20')).toBe('20 พฤศจิกายน 2569');
    expect(getThaiMonthYearString('2026-11')).toBe('พฤศจิกายน 2569');
  });

  it('marks non-completed tasks with dueDate < today as overdue', () => {
    expect(isTaskOverdue({ dueDate: '2026-11-19', status: 'in_progress' }, '2026-11-20')).toBe(true);
    expect(isTaskOverdue({ dueDate: '2026-11-19', status: 'completed' }, '2026-11-20')).toBe(false);
    expect(isTaskOverdue({ dueDate: '2026-11-20', status: 'todo' }, '2026-11-20')).toBe(false);
  });
});
