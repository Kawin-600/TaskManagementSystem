import { describe, it, expect, beforeEach } from 'vitest';
import { STORAGE_KEYS } from '../../config/appConfig';
import { isTaskOverdue } from '../../domain/dates';
import { LocalStorageRepository } from '../workspaceRepository';

describe('LocalStorageRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps milestone dates covering linked tasks as dates and links change', async () => {
    const repo = new LocalStorageRepository(() => '2026-11-20');
    await repo.loadAll();
    const input = { projectId: 'p1', module: 'Date range module', feature: '', description: '', assigneeId: 'u2', priority: 'medium' as const };
    const first = await repo.createTask({ ...input, title: 'First', startDate: '2026-11-05', dueDate: '2026-11-10' });
    const second = await repo.createTask({ ...input, title: 'Second', startDate: '2026-11-01', dueDate: '2026-11-15' });
    expect(second.milestoneId).toBe(first.milestoneId);
    const range = async () => (await repo.loadAll()).milestones.find((m) => m.id === first.milestoneId);
    expect(await range()).toMatchObject({ startDate: '2026-11-01', endDate: '2026-11-15' });
    await repo.updateTask(second.id, { startDate: '2026-11-06', dueDate: '2026-11-12' });
    expect(await range()).toMatchObject({ startDate: '2026-11-05', endDate: '2026-11-12' });
    await repo.deleteTask(second.id);
    expect(await range()).toMatchObject({ startDate: '2026-11-05', endDate: '2026-11-10' });
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

  it('syncs linked milestone progress when a task is completed or reopened', async () => {
    const repo = new LocalStorageRepository(() => '2026-11-20');
    const created = await repo.createTask({
      projectId: 'p1',
      title: 'งานที่ผูกกับ Phase',
      description: '',
      assigneeId: 'u3',
      collaboratorIds: [],
      priority: 'medium',
      startDate: '2026-11-20',
      dueDate: '2026-11-30',
    });

    await repo.updateTask(created.id, { status: 'completed' });
    let snapshot = await repo.loadAll();
    expect(snapshot.milestones.find((milestone) => milestone.id === created.milestoneId)?.progress).toBe(100);

    await repo.updateTask(created.id, { status: 'in_progress' });
    snapshot = await repo.loadAll();
    expect(snapshot.milestones.find((milestone) => milestone.id === created.milestoneId)?.progress).toBe(0);
  });

  it('calculates progress from every task in the same phase', async () => {
    const repo = new LocalStorageRepository(() => '2026-11-20');
    const first = await repo.createTask({
      projectId: 'p1',
      title: 'งานแรกใน Phase',
      description: '',
      assigneeId: 'u3',
      collaboratorIds: [],
      priority: 'medium',
      startDate: '2026-11-20',
      dueDate: '2026-11-30',
    });
    const second = await repo.createTask({
      projectId: 'p1',
      title: 'งานที่สองใน Phase',
      description: '',
      assigneeId: 'u3',
      collaboratorIds: [],
      priority: 'medium',
      startDate: '2026-11-20',
      dueDate: '2026-11-30',
    });

    await repo.updateMilestone(first.milestoneId!, { phase: 1 });
    await repo.updateMilestone(second.milestoneId!, { phase: 1 });
    await repo.updateTask(first.id, { status: 'completed' });

    let snapshot = await repo.loadAll();
    expect(snapshot.milestones.find((milestone) => milestone.id === first.milestoneId)?.progress).toBe(50);
    expect(snapshot.milestones.find((milestone) => milestone.id === second.milestoneId)?.progress).toBe(50);

    await repo.updateTask(second.id, { status: 'completed' });
    snapshot = await repo.loadAll();
    expect(snapshot.milestones.find((milestone) => milestone.id === first.milestoneId)?.progress).toBe(100);
    expect(snapshot.milestones.find((milestone) => milestone.id === second.milestoneId)?.progress).toBe(100);
  });

  it('imports projects and tasks atomically and skips duplicate project names', async () => {
    const repo = new LocalStorageRepository(() => '2026-11-20');
    const result = await repo.importProjects({
      supervisorId: 'u2',
      sourceName: 'work-plan.xlsx',
      projects: [
        {
          name: 'โปรเจคนำเข้า',
          tasks: [
            {
              title: 'Module A',
              feature: 'Feature A',
              description: 'รายละเอียดงาน',
              status: 'completed',
              startDate: '2026-11-01',
              dueDate: '2026-11-10',
            },
          ],
        },
        { name: 'ปรับปรุงระบบ Mobile Banking 3.0', tasks: [] },
      ],
    });

    expect(result).toMatchObject({ projectCount: 1, taskCount: 1 });
    expect(result.skippedProjectNames).toContain('ปรับปรุงระบบ Mobile Banking 3.0');
    const snapshot = await repo.loadAll();
    const project = snapshot.projects.find((item) => item.name === 'โปรเจคนำเข้า');
    const task = snapshot.tasks.find((item) => item.projectId === project?.id);
    expect(project).toMatchObject({ supervisorId: 'u2', description: 'นำเข้าจาก Excel: work-plan.xlsx' });
    expect(task).toMatchObject({ title: 'Module A', feature: 'Feature A', description: 'รายละเอียดงาน', status: 'completed' });
    expect(snapshot.milestones.find((item) => item.id === task?.milestoneId)?.progress).toBe(100);
  });

  it('allows duplicate task names but reuses one milestone in the roadmap', async () => {
    const repo = new LocalStorageRepository(() => '2026-11-20');
    const created = await repo.createTask({
      projectId: 'p1',
      title: 'งานชื่อไม่ซ้ำ',
      feature: '',
      description: '',
      assigneeId: 'u3',
      collaboratorIds: [],
      priority: 'medium',
      startDate: '2026-11-20',
      dueDate: '2026-11-30',
    });
    const duplicate = await repo.createTask({
      projectId: 'p1',
      title: '  งานชื่อไม่ซ้ำ  ',
      feature: '',
      description: 'รายการซ้ำ',
      assigneeId: 'u3',
      collaboratorIds: [],
      priority: 'medium',
      startDate: '2026-11-20',
      dueDate: '2026-11-30',
    });
    expect(duplicate.milestoneId).toBe(created.milestoneId);
    await expect(repo.createMilestone({
      projectId: 'p1',
      title: 'งานชื่อไม่ซ้ำ',
      ownerId: 'u3',
      startDate: '2026-11-20',
      endDate: '2026-11-30',
      progress: 0,
    })).rejects.toThrow('มี Milestone ชื่อนี้');
    const snapshot = await repo.loadAll();
    expect(snapshot.tasks.filter((task) => task.title.trim() === 'งานชื่อไม่ซ้ำ')).toHaveLength(2);
    expect(snapshot.milestones.filter((milestone) => milestone.title === 'งานชื่อไม่ซ้ำ')).toHaveLength(1);

    await repo.deleteTask(created.id);
    const afterDelete = await repo.loadAll();
    expect(afterDelete.tasks.some((task) => task.id === duplicate.id)).toBe(true);
    expect(afterDelete.milestones.some((milestone) => milestone.id === duplicate.milestoneId)).toBe(true);
  });
});
