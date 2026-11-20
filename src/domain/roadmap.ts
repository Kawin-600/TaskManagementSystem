import type { Milestone, MilestoneStatus } from '../types/models';
import { getThaiMonthFull, getThaiMonthShort, shiftMonth } from './dates';

export interface RoadmapWeek {
  key: string;
  startDate: string;
  endDate: string;
  label: string;
  rangeLabel: string;
}

export interface MilestoneStats {
  total: number;
  completed: number;
  inProgress: number;
  delayed: number;
  notStarted: number;
}

export function getMilestoneStatus(
  milestone: Pick<Milestone, 'progress' | 'endDate'>,
  todayStr: string,
): MilestoneStatus {
  if (milestone.progress >= 100) return 'completed';
  if (milestone.endDate < todayStr) return 'delayed';
  if (milestone.progress > 0) return 'in_progress';
  return 'not_started';
}

function sortByStartDate<T extends Pick<Milestone, 'id' | 'startDate' | 'createdAt'>>(
  milestones: T[],
): T[] {
  return [...milestones].sort(
    (a, b) =>
      a.startDate.localeCompare(b.startDate) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

export function sortMilestones(milestones: Milestone[]): Milestone[] {
  return [...milestones].sort(
    (a, b) =>
      a.phase - b.phase ||
      a.startDate.localeCompare(b.startDate) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

/** Phase by start-date order within each project; used for data saved before phases were stored. */
export function getPhaseNumbers(
  milestones: Pick<Milestone, 'id' | 'projectId' | 'startDate' | 'createdAt'>[],
): Map<string, number> {
  const counters = new Map<string, number>();
  const phases = new Map<string, number>();
  for (const m of sortByStartDate(milestones)) {
    const next = (counters.get(m.projectId) ?? 0) + 1;
    counters.set(m.projectId, next);
    phases.set(m.id, next);
  }
  return phases;
}

export function getProjectProgress(milestones: Milestone[]): number {
  if (milestones.length === 0) return 0;
  const sum = milestones.reduce((acc, m) => acc + m.progress, 0);
  return Math.round(sum / milestones.length);
}

export function countMilestoneStats(milestones: Milestone[], todayStr: string): MilestoneStats {
  const stats: MilestoneStats = {
    total: milestones.length,
    completed: 0,
    inProgress: 0,
    delayed: 0,
    notStarted: 0,
  };
  for (const m of milestones) {
    const status = getMilestoneStatus(m, todayStr);
    if (status === 'completed') stats.completed += 1;
    else if (status === 'in_progress') stats.inProgress += 1;
    else if (status === 'delayed') stats.delayed += 1;
    else stats.notStarted += 1;
  }
  return stats;
}

const WEEK_START_DAYS = [1, 8, 16, 24] as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function getRoadmapWeeks(yearMonth: string): RoadmapWeek[] {
  const weeks: RoadmapWeek[] = [];
  for (const ym of [yearMonth, shiftMonth(yearMonth, 1)]) {
    const [y, m] = ym.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const monthShort = getThaiMonthShort(m);
    WEEK_START_DAYS.forEach((startDay, i) => {
      const endDay = i < WEEK_START_DAYS.length - 1 ? WEEK_START_DAYS[i + 1] - 1 : lastDay;
      weeks.push({
        key: `${ym}-w${i + 1}`,
        startDate: `${ym}-${pad(startDay)}`,
        endDate: `${ym}-${pad(endDay)}`,
        label: `${monthShort} สัปดาห์ ${i + 1}`,
        rangeLabel: `${startDay}-${endDay} ${monthShort}`,
      });
    });
  }
  return weeks;
}

function dayOf(dateStr: string): number {
  return Number(dateStr.slice(8, 10));
}

/** Fraction (0..1) across the week grid for the left ('start') or right ('end') edge of a day. */
export function getRoadmapOffset(
  dateStr: string,
  weeks: RoadmapWeek[],
  edge: 'start' | 'end',
): number {
  if (weeks.length === 0) return 0;
  if (dateStr < weeks[0].startDate) return 0;
  if (dateStr > weeks[weeks.length - 1].endDate) return 1;
  const index = weeks.findIndex((w) => dateStr >= w.startDate && dateStr <= w.endDate);
  if (index < 0) return 0;
  const week = weeks[index];
  const daysInWeek = dayOf(week.endDate) - dayOf(week.startDate) + 1;
  const dayIndex = dayOf(dateStr) - dayOf(week.startDate) + (edge === 'end' ? 1 : 0);
  return (index + dayIndex / daysInWeek) / weeks.length;
}

export function getMilestoneBar(
  milestone: Pick<Milestone, 'startDate' | 'endDate'>,
  weeks: RoadmapWeek[],
): { leftPct: number; widthPct: number } | null {
  if (weeks.length === 0) return null;
  if (milestone.endDate < weeks[0].startDate) return null;
  if (milestone.startDate > weeks[weeks.length - 1].endDate) return null;
  if (milestone.endDate < milestone.startDate) return null;
  const left = getRoadmapOffset(milestone.startDate, weeks, 'start');
  const right = getRoadmapOffset(milestone.endDate, weeks, 'end');
  return { leftPct: left * 100, widthPct: (right - left) * 100 };
}

export function getTodayLinePct(todayStr: string, weeks: RoadmapWeek[]): number | null {
  if (weeks.length === 0) return null;
  if (todayStr < weeks[0].startDate || todayStr > weeks[weeks.length - 1].endDate) return null;
  const left = getRoadmapOffset(todayStr, weeks, 'start');
  const right = getRoadmapOffset(todayStr, weeks, 'end');
  return ((left + right) / 2) * 100;
}

export function getRoadmapRangeLabel(yearMonth: string): string {
  const [y1, m1] = yearMonth.split('-').map(Number);
  const [y2, m2] = shiftMonth(yearMonth, 1).split('-').map(Number);
  if (y1 === y2) {
    return `${getThaiMonthFull(m1)} – ${getThaiMonthFull(m2)} ${y1 + 543}`;
  }
  return `${getThaiMonthFull(m1)} ${y1 + 543} – ${getThaiMonthFull(m2)} ${y2 + 543}`;
}

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  completed: 'เสร็จสิ้น',
  in_progress: 'กำลังทำ',
  delayed: 'ล่าช้า',
  not_started: 'รอเริ่ม',
};

export function groupMilestonesByProject<P extends { id: string }>(
  projects: P[],
  milestones: Milestone[],
): { project: P; milestones: Milestone[] }[] {
  const sorted = sortMilestones(milestones);
  return projects
    .map((project) => ({ project, milestones: sorted.filter((m) => m.projectId === project.id) }))
    .filter((group) => group.milestones.length > 0);
}

/** Renumbers phases per project to 1..n with no gaps, keeping their relative order. */
export function compactPhases(milestones: Milestone[]): Milestone[] {
  const phasesByProject = new Map<string, Set<number>>();
  for (const m of milestones) {
    const set = phasesByProject.get(m.projectId) ?? new Set<number>();
    set.add(m.phase);
    phasesByProject.set(m.projectId, set);
  }
  const remap = new Map<string, Map<number, number>>();
  for (const [projectId, set] of phasesByProject) {
    const ordered = [...set].sort((a, b) => a - b);
    remap.set(projectId, new Map(ordered.map((phase, index) => [phase, index + 1])));
  }
  return milestones.map((m) => {
    const next = remap.get(m.projectId)?.get(m.phase) ?? m.phase;
    return next === m.phase ? m : { ...m, phase: next };
  });
}

/** Highest phase used by a project's milestones (0 when it has none). */
export function getPhaseCount(milestones: Milestone[]): number {
  return milestones.reduce((max, m) => Math.max(max, m.phase), 0);
}

/** One entry per phase from 1 to the highest phase, for a single project's milestones. */
export function groupMilestonesByPhase(
  milestones: Milestone[],
): { phase: number; milestones: Milestone[] }[] {
  const sorted = sortMilestones(milestones);
  const count = getPhaseCount(milestones);
  return Array.from({ length: count }, (_unused, index) => ({
    phase: index + 1,
    milestones: sorted.filter((m) => m.phase === index + 1),
  }));
}
