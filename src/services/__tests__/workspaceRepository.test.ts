import { describe, it, expect, beforeEach } from 'vitest';
import { STORAGE_KEYS } from '../../config/appConfig';
import { isTaskOverdue } from '../../domain/dates';
import { LocalStorageRepository } from '../workspaceRepository';

describe('LocalStorageRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('seeds 4 Thai users, 3 member-scoped projects, and 12 dynamic-date tasks anchored around today', async () => {
    const repo = new LocalStorageRepository(() => '2026-11-20');
    const snap = await repo.loadAll();

    expect(snap.users).toHaveLength(4);
    expect(snap.users.map((u) => u.role)).toEqual(['admin', 'supervisor', 'staff', 'staff']);
    expect(snap.projects).toHaveLength(3);
    expect(snap.tasks).toHaveLength(12);

    // Distinct member sets: Project 3 excludes supervisor u2
    const p3 = snap.projects.find((p) => p.id === 'p3');
    expect(p3?.memberIds).not.toContain('u2');
    expect(p3?.supervisorId).not.toBe('u2');

    // Dynamic dates yield active overdue, review, in_progress, and completed tasks
    expect(snap.tasks.some((t) => isTaskOverdue(t, '2026-11-20'))).toBe(true);
    expect(snap.tasks.some((t) => t.status === 'review')).toBe(true);
    expect(snap.tasks.some((t) => t.status === 'in_progress')).toBe(true);
    expect(snap.tasks.some((t) => t.status === 'completed')).toBe(true);
  });

  it('falls back cleanly to seed data when localStorage contains malformed JSON or non-array data (Review Focus #1)', async () => {
    localStorage.setItem(STORAGE_KEYS.users, '{broken');
    localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify({ not: 'an array' }));
    localStorage.setItem(STORAGE_KEYS.tasks, 'null');

    const repo = new LocalStorageRepository(() => '2026-11-20');
    const snap = await repo.loadAll();

    expect(snap.users).toHaveLength(4);
    expect(snap.projects).toHaveLength(3);
    expect(snap.tasks).toHaveLength(12);
  });

  it('always includes supervisorId in memberIds without duplicates on createProject', async () => {
    const repo = new LocalStorageRepository(() => '2026-11-20');
    await repo.loadAll();

    const created = await repo.createProject({
      name: 'ERP คลังสินค้า',
      description: 'จัดการสต็อก',
      color: '#4f46e5',
      supervisorId: 'u2',
      memberIds: ['u3', 'u3'],
    });

    expect(created.memberIds).toEqual(['u2', 'u3']);
  });

  it('keeps supervisor in memberIds and reassigns removed members tasks to supervisor (Review Focus #4)', async () => {
    const repo = new LocalStorageRepository(() => '2026-11-20');
    const initial = await repo.loadAll();
    const p1TasksOwnedByU3 = initial.tasks.filter((t) => t.projectId === 'p1' && t.assigneeId === 'u3');
    expect(p1TasksOwnedByU3.length).toBeGreaterThan(0);

    // Attempt to remove both supervisor u2 and staff u3
    const result = await repo.updateProjectMembers('p1', ['u4']);
    expect(result.project.memberIds).toContain('u2');
    expect(result.project.memberIds).not.toContain('u3');
    expect(result.reassignedTaskCount).toBe(p1TasksOwnedByU3.length);

    const after = await repo.loadAll();
    expect(after.tasks.filter((t) => t.projectId === 'p1' && t.assigneeId === 'u3')).toHaveLength(0);
    for (const moved of p1TasksOwnedByU3) {
      const updated = after.tasks.find((t) => t.id === moved.id);
      expect(updated?.assigneeId).toBe('u2');
    }
  });

  it('atomically transfers supervised projects to acting Admin on demotion and keeps demoted user in memberIds (Review Focus #4)', async () => {
    const repo = new LocalStorageRepository(() => '2026-11-20');
    await repo.loadAll();

    // Self-demotion blocked
    await expect(repo.updateUserRole('u1', 'staff', 'u1')).rejects.toThrow();

    const res = await repo.updateUserRole('u2', 'staff', 'u1');
    expect(res.user.role).toBe('staff');
    expect(res.transferredProjectIds).toEqual(['p1', 'p2']);

    const after = await repo.loadAll();
    for (const pid of ['p1', 'p2']) {
      const proj = after.projects.find((p) => p.id === pid)!;
      expect(proj.supervisorId).toBe('u1');
      expect(proj.memberIds).toContain('u1');
      expect(proj.memberIds).toContain('u2');
      expect(new Set(proj.memberIds).size).toBe(proj.memberIds.length);
    }
  });

  it('cascades user deletion cleanly across supervised projects, memberIds, and assigned tasks (Review Focus #4)', async () => {
    const repo = new LocalStorageRepository(() => '2026-11-20');
    await repo.loadAll();

    // Self-delete blocked
    await expect(repo.deleteUser('u1', 'u1')).rejects.toThrow();

    const res = await repo.deleteUser('u2', 'u1');
    expect(res.transferredProjectIds).toEqual(['p1', 'p2']);

    const after = await repo.loadAll();
    expect(after.users.some((u) => u.id === 'u2')).toBe(false);
    expect(after.projects.every((p) => p.supervisorId !== 'u2' && !p.memberIds.includes('u2'))).toBe(true);
    expect(after.tasks.every((t) => t.assigneeId !== 'u2')).toBe(true);
  });

  it('falls back to seed data when stored arrays contain null or partial malformed records (Important #2 / Review Focus #1)', async () => {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([null, { id: 'u1' }]));
    localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify([{ id: 'p1', name: 'Broken' }]));
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify([{ id: 't1', title: 'Missing dates' }]));

    const repo = new LocalStorageRepository(() => '2026-11-20');
    const snap = await repo.loadAll();

    expect(snap.users).toHaveLength(4);
    expect(snap.users.every((u) => typeof u.email === 'string' && typeof u.role === 'string')).toBe(true);
    expect(snap.projects.every((p) => Array.isArray(p.memberIds))).toBe(true);
    expect(snap.tasks.every((t) => Array.isArray(t.comments) && Boolean(t.startDate && t.dueDate))).toBe(true);
  });

  it('updateProject reassigns tasks of removed members and addComment appends comments (Important #8)', async () => {
    const repo = new LocalStorageRepository(() => '2026-11-20');
    await repo.loadAll();

    await repo.updateProject('p1', { memberIds: ['u2', 'u4'] });
    const afterProject = await repo.loadAll();
    expect(afterProject.tasks.filter((t) => t.projectId === 'p1' && t.assigneeId === 'u3')).toHaveLength(0);

    const commented = await repo.addComment('t104', 'u2', 'ตรวจแล้วผ่านครับ');
    expect(commented.comments.some((c) => c.text === 'ตรวจแล้วผ่านครับ' && c.userId === 'u2')).toBe(true);
  });
});
