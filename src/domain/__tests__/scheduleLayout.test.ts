import { describe, it, expect } from 'vitest';
import type { Task } from '../../types/models';
import {
  buildCalendarWeeks,
  packWeekLanes,
  buildGanttDays,
  computeGanttBarBounds,
} from '../scheduleLayout';

const makeTask = (id: string, startDate: string, dueDate: string): Task => ({
  id,
  projectId: 'p1',
  title: `Task ${id}`,
  description: '',
  assigneeId: 'u3',
  status: 'in_progress',
  priority: 'medium',
  startDate,
  dueDate,
  createdAt: startDate,
  comments: [],
});

describe('scheduleLayout', () => {
  it('packs non-overlapping tasks within the same week horizontally into a single lane (Review Focus #3)', () => {
    const weeks = buildCalendarWeeks('2026-11', '2026-11-20');
    // Nov 1, 2026 is Sunday -> week[0] is 2026-11-01..2026-11-07
    const week0 = weeks[0];
    expect(week0[0].dateStr).toBe('2026-11-01');
    expect(week0[6].dateStr).toBe('2026-11-07');

    const t1 = makeTask('t1', '2026-11-02', '2026-11-03');
    const t2 = makeTask('t2', '2026-11-05', '2026-11-06');

    const lanes = packWeekLanes(week0, [t1, t2]);
    expect(lanes).toHaveLength(1);
    expect(lanes[0]).toHaveLength(2);
    expect(lanes[0][0]).toMatchObject({ startCol: 1, endCol: 2, spanCols: 2, isStartInWeek: true, isEndInWeek: true });
    expect(lanes[0][1]).toMatchObject({ startCol: 4, endCol: 5, spanCols: 2, isStartInWeek: true, isEndInWeek: true });
  });

  it('stacks overlapping tasks in separate lanes', () => {
    const weeks = buildCalendarWeeks('2026-11', '2026-11-20');
    const t1 = makeTask('t1', '2026-11-02', '2026-11-05');
    const t2 = makeTask('t2', '2026-11-04', '2026-11-06');

    const lanes = packWeekLanes(weeks[0], [t1, t2]);
    expect(lanes).toHaveLength(2);
  });

  it('clamps cross-month tasks cleanly on both Calendar and Gantt while preserving visibility (Review Focus #3)', () => {
    const weeks = buildCalendarWeeks('2026-11', '2026-11-20');
    const days = buildGanttDays('2026-11', '2026-11-20');
    expect(days).toHaveLength(30);

    const crossMonth = makeTask('cm', '2026-10-28', '2026-12-05');
    const interiorLanes = packWeekLanes(weeks[1], [crossMonth]);
    expect(interiorLanes[0][0]).toMatchObject({
      startCol: 0,
      endCol: 6,
      spanCols: 7,
      isStartInWeek: false,
      isEndInWeek: false,
    });

    const ganttBounds = computeGanttBarBounds(crossMonth, days, 46);
    expect(ganttBounds).toEqual({
      startIdx: 0,
      endIdx: 29,
      leftPx: 0,
      widthPx: 30 * 46,
      isVisible: true,
    });
  });

  it('marks tasks completely outside the viewed month as not visible on Gantt', () => {
    const days = buildGanttDays('2026-11', '2026-11-20');
    const pastTask = makeTask('old', '2026-10-01', '2026-10-15');
    const futureTask = makeTask('new', '2026-12-01', '2026-12-05');

    expect(computeGanttBarBounds(pastTask, days, 46).isVisible).toBe(false);
    expect(computeGanttBarBounds(futureTask, days, 46).isVisible).toBe(false);
  });
});
