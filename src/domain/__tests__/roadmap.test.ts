import { describe, it, expect } from 'vitest';
import type { Milestone, Project, User } from '../../types/models';
import {
  countMilestoneStats,
  getMilestoneBar,
  getMilestoneStatus,
  getPhaseNumbers,
  getProjectProgress,
  getRoadmapRangeLabel,
  getRoadmapWeeks,
  getTodayLinePct,
} from '../roadmap';
import { canManageMilestones, getVisibleMilestones } from '../rbac';

const TODAY = '2026-11-20';

function ms(partial: Partial<Milestone> & { id: string }): Milestone {
  return {
    projectId: 'p1',
    title: 'เฟสทดสอบ',
    ownerId: 'u2',
    startDate: '2026-11-01',
    endDate: '2026-11-10',
    progress: 0,
    phase: 1,
    createdAt: '2026-11-01',
    ...partial,
  };
}

describe('getMilestoneStatus', () => {
  it('derives status from progress and end date, first match wins', () => {
    expect(getMilestoneStatus({ progress: 100, endDate: '2026-11-01' }, TODAY)).toBe('completed');
    expect(getMilestoneStatus({ progress: 55, endDate: '2026-11-19' }, TODAY)).toBe('delayed');
    expect(getMilestoneStatus({ progress: 0, endDate: '2026-11-19' }, TODAY)).toBe('delayed');
    expect(getMilestoneStatus({ progress: 0, endDate: '2026-12-01' }, TODAY)).toBe('not_started');
  });

  it('does not mark a milestone ending today as delayed (Review Focus #3)', () => {
    expect(getMilestoneStatus({ progress: 55, endDate: TODAY }, TODAY)).toBe('in_progress');
  });
});

describe('phase numbers and progress', () => {
  it('numbers phases per project by start date', () => {
    const list = [
      ms({ id: 'c', startDate: '2026-12-01' }),
      ms({ id: 'a', startDate: '2026-11-01' }),
      ms({ id: 'x', projectId: 'p2', startDate: '2026-12-15' }),
      ms({ id: 'b', startDate: '2026-11-15' }),
    ];
    const phases = getPhaseNumbers(list);
    expect(phases.get('a')).toBe(1);
    expect(phases.get('b')).toBe(2);
    expect(phases.get('c')).toBe(3);
    expect(phases.get('x')).toBe(1);
  });

  it('averages project progress and rounds', () => {
    expect(
      getProjectProgress([
        ms({ id: 'a', progress: 100 }),
        ms({ id: 'b', progress: 65 }),
        ms({ id: 'c', progress: 10 }),
      ]),
    ).toBe(58);
    expect(getProjectProgress([])).toBe(0);
  });

  it('counts each status once', () => {
    const stats = countMilestoneStats(
      [
        ms({ id: 'a', progress: 100 }),
        ms({ id: 'b', progress: 40, endDate: '2026-11-30' }),
        ms({ id: 'c', progress: 40, endDate: '2026-11-10' }),
        ms({ id: 'd', progress: 0, endDate: '2026-12-10' }),
        ms({ id: 'e', progress: 0, endDate: '2026-12-20' }),
      ],
      TODAY,
    );
    expect(stats).toEqual({ total: 5, completed: 1, inProgress: 1, delayed: 1, notStarted: 2 });
  });
});

describe('roadmap window', () => {
  const weeks = getRoadmapWeeks('2026-11');

  it('builds 8 week columns across two months', () => {
    expect(weeks).toHaveLength(8);
    expect(weeks[0]).toMatchObject({
      startDate: '2026-11-01',
      endDate: '2026-11-07',
      label: 'พ.ย. สัปดาห์ 1',
      rangeLabel: '1-7 พ.ย.',
    });
    expect(weeks[3].endDate).toBe('2026-11-30');
    expect(weeks[7]).toMatchObject({ startDate: '2026-12-24', endDate: '2026-12-31' });
    expect(getRoadmapWeeks('2027-02')[3].endDate).toBe('2027-02-28');
  });

  it('positions bars and clips them to the window (Review Focus #2)', () => {
    expect(getMilestoneBar({ startDate: '2026-11-01', endDate: '2026-11-07' }, weeks)).toEqual({
      leftPct: 0,
      widthPct: 12.5,
    });
    expect(getMilestoneBar({ startDate: '2026-10-01', endDate: '2027-03-01' }, weeks)).toEqual({
      leftPct: 0,
      widthPct: 100,
    });
    expect(getMilestoneBar({ startDate: '2026-09-01', endDate: '2026-10-15' }, weeks)).toBeNull();
    expect(getMilestoneBar({ startDate: '2027-01-05', endDate: '2027-01-09' }, weeks)).toBeNull();
    const oneDay = getMilestoneBar({ startDate: '2026-11-20', endDate: '2026-11-20' }, weeks);
    expect(oneDay?.widthPct).toBeGreaterThan(0);
  });

  it('places the today line inside its week, or nowhere when outside the window', () => {
    const pct = getTodayLinePct('2026-11-20', weeks);
    expect(pct).not.toBeNull();
    expect(pct as number).toBeGreaterThan(25);
    expect(pct as number).toBeLessThan(37.5);
    expect(getTodayLinePct('2026-10-31', weeks)).toBeNull();
  });

  it('labels the two-month range in Thai Buddhist-era form', () => {
    expect(getRoadmapRangeLabel('2026-11')).toBe('พฤศจิกายน – ธันวาคม 2569');
    expect(getRoadmapRangeLabel('2026-12')).toBe('ธันวาคม 2569 – มกราคม 2570');
  });
});

describe('milestone permissions', () => {
  const admin: User = { id: 'u1', name: 'a', email: 'a@t', role: 'admin', avatar: 'a', color: 'purple' };
  const sup: User = { id: 'u2', name: 's', email: 's@t', role: 'supervisor', avatar: 's', color: 'indigo' };
  const staff: User = { id: 'u3', name: 'k', email: 'k@t', role: 'staff', avatar: 'k', color: 'emerald' };
  const p1: Project = { id: 'p1', name: 'P1', description: '', color: '#000', supervisorId: 'u2', memberIds: ['u2', 'u3'] };
  const p2: Project = { id: 'p2', name: 'P2', description: '', color: '#000', supervisorId: 'u1', memberIds: ['u1', 'u2'] };
  const list = [ms({ id: 'a', projectId: 'p1' }), ms({ id: 'b', projectId: 'p2' })];

  it('scopes visible milestones to viewable projects', () => {
    expect(getVisibleMilestones(staff, [p1, p2], list).map((m) => m.id)).toEqual(['a']);
    expect(getVisibleMilestones(admin, [p1, p2], list)).toHaveLength(2);
  });

  it('lets only admin and the owning supervisor manage milestones', () => {
    expect(canManageMilestones(admin, p1)).toBe(true);
    expect(canManageMilestones(sup, p1)).toBe(true);
    expect(canManageMilestones(sup, p2)).toBe(false);
    expect(canManageMilestones(staff, p1)).toBe(false);
  });
});
