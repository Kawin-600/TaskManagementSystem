import { describe, it, expect, beforeEach } from 'vitest';
import { STORAGE_KEYS } from '../../config/appConfig';
import { countMilestoneStats } from '../../domain/roadmap';
import { LocalStorageRepository } from '../workspaceRepository';

const TODAY = '2026-11-20';
const newRepo = () => new LocalStorageRepository(() => TODAY);

const baseInput = {
  projectId: 'p1',
  title: 'เฟสใหม่',
  ownerId: 'u3',
  startDate: '2026-12-01',
  endDate: '2026-12-10',
  progress: 20,
};

describe('LocalStorageRepository milestones', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('seeds 8 milestones covering every status', async () => {
    const snap = await newRepo().loadAll();
    expect(snap.milestones).toHaveLength(8);
    expect(countMilestoneStats(snap.milestones, TODAY)).toEqual({
      total: 8,
      completed: 2,
      inProgress: 2,
      delayed: 1,
      notStarted: 3,
    });
  });

  it('adds seed milestones to existing data without resetting it (Review Focus #1)', async () => {
    const repo = newRepo();
    await repo.loadAll();
    const created = await repo.createProject({
      name: 'ERP คลังสินค้า',
      description: '',
      color: '#4f46e5',
      supervisorId: 'u2',
      memberIds: ['u3'],
    });
    localStorage.removeItem(STORAGE_KEYS.milestones);

    const snap = await newRepo().loadAll();
    expect(snap.projects.some((p) => p.id === created.id)).toBe(true);
    expect(snap.milestones).toHaveLength(8);

    localStorage.setItem(STORAGE_KEYS.milestones, '[]');
    expect((await newRepo().loadAll()).milestones).toHaveLength(0);

    localStorage.setItem(STORAGE_KEYS.milestones, '{broken');
    const recovered = await newRepo().loadAll();
    expect(recovered.milestones).toHaveLength(8);
    expect(recovered.projects.some((p) => p.id === created.id)).toBe(true);
  });

  it('skips seed milestones whose project no longer exists', async () => {
    const repo = newRepo();
    await repo.loadAll();
    await repo.deleteProject('p3');
    localStorage.removeItem(STORAGE_KEYS.milestones);
    const snap = await newRepo().loadAll();
    expect(snap.milestones).toHaveLength(6);
    expect(snap.milestones.every((m) => m.projectId !== 'p3')).toBe(true);
  });

  it('creates, updates, and deletes milestones persistently', async () => {
    const repo = newRepo();
    const created = await repo.createMilestone({ ...baseInput, title: '  เฟสใหม่  ' });
    expect(created.title).toBe('เฟสใหม่');
    expect(created.createdAt).toBe(TODAY);

    const updated = await repo.updateMilestone(created.id, { progress: 80, ownerId: 'u4' });
    expect(updated).toMatchObject({ progress: 80, ownerId: 'u4', title: 'เฟสใหม่' });

    let snap = await newRepo().loadAll();
    expect(snap.milestones).toHaveLength(9);
    expect(snap.milestones.find((m) => m.id === created.id)?.progress).toBe(80);

    await repo.deleteMilestone(created.id);
    snap = await newRepo().loadAll();
    expect(snap.milestones).toHaveLength(8);
  });

  it('rejects invalid milestones with Thai messages', async () => {
    const repo = newRepo();
    await expect(repo.createMilestone({ ...baseInput, title: '   ' })).rejects.toThrow(
      'กรุณาระบุชื่อ Milestone',
    );
    await expect(repo.createMilestone({ ...baseInput, projectId: 'nope' })).rejects.toThrow(
      'ไม่พบโปรเจค',
    );
    await expect(repo.createMilestone({ ...baseInput, ownerId: 'u1' })).rejects.toThrow(
      'ผู้ดูแลต้องเป็นสมาชิกของโปรเจค',
    );
    await expect(
      repo.createMilestone({ ...baseInput, startDate: '2026-12-10', endDate: '2026-12-01' }),
    ).rejects.toThrow('วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น');
    await expect(repo.updateMilestone('nope', { progress: 1 })).rejects.toThrow(
      'ไม่พบ Milestone ที่ต้องการแก้ไข',
    );
    await expect(repo.updateMilestone('m101', { endDate: '2020-01-01' })).rejects.toThrow(
      'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น',
    );
    expect((await repo.loadAll()).milestones).toHaveLength(8);
  });

  it('stores progress as an integer clamped to 0-100 (Review Focus #5)', async () => {
    const repo = newRepo();
    expect((await repo.createMilestone({ ...baseInput, progress: 150 })).progress).toBe(100);
    expect((await repo.createMilestone({ ...baseInput, progress: -5 })).progress).toBe(0);
    expect((await repo.createMilestone({ ...baseInput, progress: 33.6 })).progress).toBe(34);
    expect((await repo.createMilestone({ ...baseInput, progress: Number.NaN })).progress).toBe(0);
    expect((await repo.updateMilestone('m102', { progress: 999 })).progress).toBe(100);
  });

  it('moves ownership to the project supervisor when the owner leaves (Review Focus #4)', async () => {
    const repo = newRepo();
    await repo.loadAll();
    await repo.updateProjectMembers('p1', ['u2', 'u4']);
    let snap = await repo.loadAll();
    expect(snap.milestones.find((m) => m.id === 'm102')?.ownerId).toBe('u2');

    await repo.deleteUser('u4', 'u1');
    snap = await repo.loadAll();
    for (const id of ['m103', 'm201', 'm203']) {
      expect(snap.milestones.find((m) => m.id === id)?.ownerId).toBe('u2');
    }

    await repo.deleteUser('u2', 'u1');
    snap = await repo.loadAll();
    for (const id of ['m101', 'm202']) {
      expect(snap.milestones.find((m) => m.id === id)?.ownerId).toBe('u1');
    }
    const userIds = new Set(snap.users.map((u) => u.id));
    expect(snap.milestones.every((m) => userIds.has(m.ownerId))).toBe(true);
  });

  it('reassigns owners on updateProject member changes and cascades project deletion', async () => {
    const repo = newRepo();
    await repo.loadAll();
    await repo.updateProject('p3', { memberIds: ['u4'] });
    let snap = await repo.loadAll();
    expect(snap.milestones.find((m) => m.id === 'm301')?.ownerId).toBe('u1');

    await repo.deleteProject('p1');
    snap = await repo.loadAll();
    expect(snap.milestones).toHaveLength(5);
  });

  it('restores seed milestones on reset', async () => {
    const repo = newRepo();
    await repo.deleteMilestone('m101');
    const snap = await repo.resetSampleData();
    expect(snap.milestones).toHaveLength(8);
  });
});
