import { formatDateObj } from './dates';
import type { Task } from '../types/models';

export interface CalendarDayCell {
  dateStr: string;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

export interface CalendarBarPlacement {
  task: Task;
  startCol: number;
  endCol: number;
  spanCols: number;
  isStartInWeek: boolean;
  isEndInWeek: boolean;
}

export interface CalendarWeekRow {
  days: CalendarDayCell[];
  lanes: CalendarBarPlacement[][];
}

export interface GanttDayColumn {
  dayNum: number;
  dateStr: string;
  dayOfWeekName: string;
  isWeekend: boolean;
  isToday: boolean;
}

export interface GanttBarBounds {
  startIdx: number;
  endIdx: number;
  leftPx: number;
  widthPx: number;
  isVisible: boolean;
}

const THAI_WEEKDAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const;

export function buildCalendarWeeks(yearMonth: string, todayStr: string): CalendarDayCell[][] {
  const [year, month] = yearMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const startDayOfWeek = firstDay.getDay();

  const weeks: CalendarDayCell[][] = [];
  let cursor = 1 - startDayOfWeek;

  for (let w = 0; w < 6; w++) {
    const week: CalendarDayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const dateObj = new Date(year, month - 1, cursor);
      const dateStr = formatDateObj(dateObj);
      week.push({
        dateStr,
        dayNum: dateObj.getDate(),
        isCurrentMonth: dateObj.getMonth() === month - 1,
        isToday: dateStr === todayStr,
        isWeekend: d === 0 || d === 6,
      });
      cursor += 1;
    }
    weeks.push(week);
    if (cursor > totalDaysInMonth && w >= 4) break;
  }

  return weeks;
}

export function packWeekLanes(
  weekDays: CalendarDayCell[],
  tasks: Task[],
): CalendarBarPlacement[][] {
  const weekStart = weekDays[0].dateStr;
  const weekEnd = weekDays[6].dateStr;

  const placements: CalendarBarPlacement[] = tasks
    .filter((t) => t.startDate <= weekEnd && t.dueDate >= weekStart)
    .map((task) => {
      const isStartInWeek = task.startDate >= weekStart;
      const isEndInWeek = task.dueDate <= weekEnd;

      let startCol = 0;
      let endCol = 6;
      if (isStartInWeek) {
        const idx = weekDays.findIndex((d) => d.dateStr === task.startDate);
        if (idx !== -1) startCol = idx;
      }
      if (isEndInWeek) {
        const idx = weekDays.findIndex((d) => d.dateStr === task.dueDate);
        if (idx !== -1) endCol = idx;
      }

      return {
        task,
        startCol,
        endCol,
        spanCols: endCol - startCol + 1,
        isStartInWeek,
        isEndInWeek,
      };
    });

  placements.sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol;
    if (a.spanCols !== b.spanCols) return b.spanCols - a.spanCols;
    return a.task.id.localeCompare(b.task.id);
  });

  const lanes: CalendarBarPlacement[][] = [];
  for (const bar of placements) {
    let placed = false;
    for (const lane of lanes) {
      const last = lane[lane.length - 1];
      if (bar.startCol > last.endCol) {
        lane.push(bar);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([bar]);
    }
  }

  return lanes;
}

export function buildGanttDays(yearMonth: string, todayStr: string): GanttDayColumn[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const totalDays = new Date(year, month, 0).getDate();
  const cols: GanttDayColumn[] = [];

  for (let d = 1; d <= totalDays; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dateStr = formatDateObj(dateObj);
    const dow = dateObj.getDay();
    cols.push({
      dayNum: d,
      dateStr,
      dayOfWeekName: THAI_WEEKDAYS_SHORT[dow],
      isWeekend: dow === 0 || dow === 6,
      isToday: dateStr === todayStr,
    });
  }

  return cols;
}

export function computeGanttBarBounds(
  task: Pick<Task, 'startDate' | 'dueDate'>,
  dayColumns: GanttDayColumn[],
  colWidth: number,
): GanttBarBounds {
  if (dayColumns.length === 0) {
    return { startIdx: -1, endIdx: -1, leftPx: 0, widthPx: 0, isVisible: false };
  }
  const monthStart = dayColumns[0].dateStr;
  const monthEnd = dayColumns[dayColumns.length - 1].dateStr;

  if (task.dueDate < monthStart || task.startDate > monthEnd) {
    return { startIdx: -1, endIdx: -1, leftPx: 0, widthPx: 0, isVisible: false };
  }

  let startIdx = dayColumns.findIndex((d) => d.dateStr === task.startDate);
  let endIdx = dayColumns.findIndex((d) => d.dateStr === task.dueDate);

  if (startIdx === -1) startIdx = 0;
  if (endIdx === -1) endIdx = dayColumns.length - 1;

  return {
    startIdx,
    endIdx,
    leftPx: startIdx * colWidth,
    widthPx: (endIdx - startIdx + 1) * colWidth,
    isVisible: true,
  };
}
