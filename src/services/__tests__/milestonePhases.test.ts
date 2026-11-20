import { describe, it, expect, beforeEach } from 'vitest';
import { STORAGE_KEYS } from '../../config/appConfig';
import { compactPhases, groupMilestonesByPhase, sortMilestones } from '../../domain/roadmap';
import type { Milestone } from '../../types/models';
import { LocalStorageRepository } from '../workspaceRepository';

const TODAY = '2026-11-20';
const newRepo = () => new LocalStorageRepository(() => TODAY);

function ms(id: string, phase: number, startDate: string, projectId = 'p1'): Milestone {
  return {
    id,
    projectId,
    title: id,
    ownerId: 'u2',
    startDate,
    endDate: startDate,
    progress: 0,
    phase,
    createdAt: '2026-11-01',
  };
}

const phaseOf = (list: Milestone[], id: string) => list.find((m) => m.id === id)?.phase;

describe('phase rules', () => {
  it('sorts by phase before start date', () => {
    const sorted = sortMilestones([
      ms('late-phase1', 1, '2026-12-20'),
      ms('early-phase2', 2, '2026-11-01'),
      ms('early-phase1', 1, '2026-11-05'),
    ]);
    expect(sorted.map((m) => m.id)).toEqual(['early-phase1', 'late-phase1', 'early-phase2']);
  });

  it('closes gaps per project so phases are always 1..n', () => {
    const compacted = compactPhases([
      ms('a', 2, '2026-11-01'),
      ms('b', 5, '2026-11-02'),
      ms('c', 5, '2026-11-03'),
      ms('x', 7, '2026-11-01', 'p2'),
    ]);
    expect(compacted.map((m) => [m.id, m.phase])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 2],
      ['x', 1],
    ]);
  });

  it('groups a project into one column per phase', () => {
    const groups = groupMilestonesByPhase([
      ms('a', 1, '2026-11-01'),
      ms('b', 2, '2026-11-02'),
      ms('c', 1, '2026-11-03'),
    ]);
    expect(groups.map((g) => [g.phase, g.milestones.map((m) => m.id)])).toEqual([
      [1, ['a', 'c']],
      [2, ['b']],
    ]);
  });
});

describe('LocalStorageRepository phases', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('seeds explicit phases', async () => {
    const { milestones } = await newRepo().loadAll();
    expect(['m101', 'm102', 'm103'].map((id) => phaseOf(milestones, id))).toEqual([1, 2, 3]);
    expect(['m301', 'm302'].map((id) => phaseOf(milestones, id))).toEqual([1, 2]);
  });

  it('gives milestones saved before phases existed a phase by start-date order', async () => {
    const repo = newRepo();
    const snap = await repo.loadAll();
    await repo.updateMilestone('m102', { progress: 80 });
    const legacy = (await repo.loadAll()).milestones.map(({ phase: _phase, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEYS.milestones, JSON.stringify(legacy));

    const reloaded = await newRepo().loadAll();
    expect(reloaded.milestones).toHaveLength(snap.milestones.length);
    expect(['m101', 'm102', 'm103'].map((id) => phaseOf(reloaded.milestones, id))).toEqual([
      1, 2, 3,
    ]);
    expect(reloaded.milestones.find((m) => m.id === 'm102')?.progress).toBe(80);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.milestones) ?? '[]');
    expect(stored.every((m: Milestone) => typeof m.phase === 'number')).toBe(true);
  });

  it('lets several milestones share a phase and closes the gap left behind', async () => {
    const repo = newRepo();
    await repo.loadAll();
    const moved = await repo.updateMilestone('m102', { phase: 1 });
    expect(moved.phase).toBe(1);

    const { milestones } = await repo.loadAll();
    expect(phaseOf(milestones, 'm101')).toBe(1);
    expect(phaseOf(milestones, 'm102')).toBe(1);
    expect(phaseOf(milestones, 'm103')).toBe(2);
    // other projects are untouched
    expect(phaseOf(milestones, 'm203')).toBe(3);
  });

  it('puts new milestones in a new last phase unless a phase is given', async () => {
    const repo = newRepo();
    const base = {
      projectId: 'p1',
      title: 'เฟสใหม่',
      ownerId: 'u2',
      startDate: '2026-12-01',
      endDate: '2026-12-10',
      progress: 0,
    };
    expect((await repo.createMilestone(base)).phase).toBe(4);
    expect((await repo.createMilestone({ ...base, phase: 2 })).phase).toBe(2);
    // far beyond the last phase collapses to the next free one
    expect((await repo.createMilestone({ ...base, phase: 99 })).phase).toBe(5);
    expect((await repo.createMilestone({ ...base, phase: 0 })).phase).toBe(6);
  });

  it('renumbers later phases when a phase becomes empty by deletion', async () => {
    const repo = newRepo();
    await repo.loadAll();
    await repo.deleteMilestone('m101');
    const { milestones } = await repo.loadAll();
    expect(phaseOf(milestones, 'm102')).toBe(1);
    expect(phaseOf(milestones, 'm103')).toBe(2);
  });
});
