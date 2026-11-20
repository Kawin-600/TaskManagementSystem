import { describe, it, expect } from 'vitest';
import type { Project, Task, User } from '../../types/models';
import {
  getVisibleProjects,
  canViewProject,
  canCreateProject,
  canManageProject,
  getVisibleTasks,
  canCreateTaskInProject,
  getAssignableMembers,
  canEditTask,
  validateTaskStatusTransition,
  canApproveOrRejectTask,
  canDeleteTask,
  canCommentOnTask,
  getVisibleTeamUsers,
  canAccessAdmin,
  canModifyUserRole,
  canDeleteUser,
} from '../rbac';

const admin: User = { id: 'u1', name: 'นพดล', email: 'a@t.local', role: 'admin', avatar: 'นพ', color: 'purple' };
const supervisor: User = { id: 'u2', name: 'วิภาวดี', email: 's@t.local', role: 'supervisor', avatar: 'วิ', color: 'indigo' };
const staffA: User = { id: 'u3', name: 'กิตติพงษ์', email: 'k@t.local', role: 'staff', avatar: 'กต', color: 'emerald' };
const staffB: User = { id: 'u4', name: 'สมชาย', email: 'c@t.local', role: 'staff', avatar: 'สช', color: 'amber' };
const allUsers = [admin, supervisor, staffA, staffB];

const projSupervisedByU2: Project = {
  id: 'p1',
  name: 'Mobile Banking',
  description: '',
  color: '#4f46e5',
  supervisorId: 'u2',
  memberIds: ['u2', 'u3'],
};
const projSupervisedByAdminWithU2Member: Project = {
  id: 'p2',
  name: 'AI Chatbot',
  description: '',
  color: '#10b981',
  supervisorId: 'u1',
  memberIds: ['u1', 'u2', 'u4'],
};
const projHiddenFromU2AndU3: Project = {
  id: 'p3',
  name: 'Confidential HR',
  description: '',
  color: '#f43f5e',
  supervisorId: 'u1',
  memberIds: ['u1', 'u4'],
};
const allProjects = [projSupervisedByU2, projSupervisedByAdminWithU2Member, projHiddenFromU2AndU3];

const makeTask = (overrides: Partial<Task>): Task => ({
  id: 't1',
  projectId: 'p1',
  title: 'งานทดสอบ',
  description: '',
  assigneeId: 'u3',
  status: 'in_progress',
  priority: 'medium',
  startDate: '2026-11-10',
  dueDate: '2026-11-22',
  createdAt: '2026-11-10',
  comments: [],
  ...overrides,
});

describe('Member-Scoped RBAC', () => {
  it('scopes visible projects, tasks, and team users per role', () => {
    expect(getVisibleProjects(admin, allProjects).map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(getVisibleProjects(supervisor, allProjects).map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(getVisibleProjects(staffA, allProjects).map((p) => p.id)).toEqual(['p1']);
    expect(canViewProject(supervisor, projHiddenFromU2AndU3)).toBe(false);
    expect(canViewProject(staffA, projHiddenFromU2AndU3)).toBe(false);

    const tasks = [
      makeTask({ id: 't1', projectId: 'p1', assigneeId: 'u3' }),
      makeTask({ id: 't2', projectId: 'p2', assigneeId: 'u4' }),
      makeTask({ id: 't3', projectId: 'p3', assigneeId: 'u4' }),
    ];
    expect(getVisibleTasks(admin, allProjects, tasks).map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    expect(getVisibleTasks(supervisor, allProjects, tasks).map((t) => t.id)).toEqual(['t1', 't2']);
    expect(getVisibleTasks(staffA, allProjects, tasks).map((t) => t.id)).toEqual(['t1']);

    expect(getVisibleTeamUsers(admin, allProjects, allUsers).map((u) => u.id)).toEqual(['u1', 'u2', 'u3', 'u4']);
    expect(getVisibleTeamUsers(staffA, allProjects, allUsers).map((u) => u.id)).toEqual(['u2', 'u3']);
  });

  it('allows project creation for Admin/Supervisor and management only for Admin or owning supervisor', () => {
    expect(canCreateProject(admin)).toBe(true);
    expect(canCreateProject(supervisor)).toBe(true);
    expect(canCreateProject(staffA)).toBe(false);

    expect(canManageProject(admin, projHiddenFromU2AndU3)).toBe(true);
    expect(canManageProject(supervisor, projSupervisedByU2)).toBe(true);
    expect(canManageProject(supervisor, projSupervisedByAdminWithU2Member)).toBe(false);
    expect(canManageProject(staffA, projSupervisedByU2)).toBe(false);
  });

  it('restricts Staff task creation to member projects and self-only assignment', () => {
    expect(canCreateTaskInProject(staffA, projSupervisedByU2)).toBe(true);
    expect(canCreateTaskInProject(staffA, projHiddenFromU2AndU3)).toBe(false);
    expect(getAssignableMembers(staffA, projSupervisedByU2, allUsers).map((u) => u.id)).toEqual(['u3']);
    expect(getAssignableMembers(supervisor, projSupervisedByU2, allUsers).map((u) => u.id)).toEqual(['u2', 'u3']);
    expect(getAssignableMembers(admin, projSupervisedByU2, allUsers).map((u) => u.id)).toEqual(['u2', 'u3']);
  });

  it('locks completed tasks for Staff while allowing non-completed own edits and blocking direct completion', () => {
    const ownInProgress = makeTask({ id: 't1', projectId: 'p1', assigneeId: 'u3', status: 'in_progress' });
    const ownCompleted = makeTask({ id: 't2', projectId: 'p1', assigneeId: 'u3', status: 'completed' });
    const otherTask = makeTask({ id: 't3', projectId: 'p1', assigneeId: 'u2', status: 'in_progress' });

    expect(canEditTask(staffA, ownInProgress, projSupervisedByU2)).toBe(true);
    expect(validateTaskStatusTransition(staffA, ownInProgress, 'review', projSupervisedByU2)).toEqual({ allowed: true });

    const directComplete = validateTaskStatusTransition(staffA, ownInProgress, 'completed', projSupervisedByU2);
    expect(directComplete.allowed).toBe(false);
    expect(directComplete.reason).toContain('รอตรวจสอบ');

    // Completed task lock for Staff (User Decision)
    expect(canEditTask(staffA, ownCompleted, projSupervisedByU2)).toBe(false);
    const reopenByStaff = validateTaskStatusTransition(staffA, ownCompleted, 'in_progress', projSupervisedByU2);
    expect(reopenByStaff.allowed).toBe(false);

    // Other colleague's task
    expect(canEditTask(staffA, otherTask, projSupervisedByU2)).toBe(false);
    expect(validateTaskStatusTransition(staffA, otherTask, 'review', projSupervisedByU2).allowed).toBe(false);
  });

  it('allows Supervisor/Admin to approve, reject, reopen, and delete tasks in visible projects only', () => {
    const reviewVisible = makeTask({ id: 't1', projectId: 'p1', assigneeId: 'u3', status: 'review' });
    const completedVisible = makeTask({ id: 't2', projectId: 'p1', assigneeId: 'u3', status: 'completed' });
    const reviewHidden = makeTask({ id: 't3', projectId: 'p3', assigneeId: 'u4', status: 'review' });

    expect(canApproveOrRejectTask(supervisor, reviewVisible, projSupervisedByU2)).toBe(true);
    expect(validateTaskStatusTransition(supervisor, completedVisible, 'in_progress', projSupervisedByU2)).toEqual({ allowed: true });
    expect(canDeleteTask(supervisor, reviewVisible, projSupervisedByU2)).toBe(true);

    expect(canApproveOrRejectTask(supervisor, reviewHidden, projHiddenFromU2AndU3)).toBe(false);
    expect(canDeleteTask(supervisor, reviewHidden, projHiddenFromU2AndU3)).toBe(false);
    expect(canApproveOrRejectTask(admin, reviewHidden, projHiddenFromU2AndU3)).toBe(true);
    expect(canApproveOrRejectTask(staffA, reviewVisible, projSupervisedByU2)).toBe(false);
    expect(canDeleteTask(staffA, reviewVisible, projSupervisedByU2)).toBe(false);
  });

  it('allows Staff to comment on any task in member projects including completed tasks, never hidden projects', () => {
    const completedInP1 = makeTask({ id: 't1', projectId: 'p1', assigneeId: 'u2', status: 'completed' });
    const taskInHiddenP3 = makeTask({ id: 't2', projectId: 'p3', assigneeId: 'u4', status: 'todo' });

    expect(canCommentOnTask(staffA, completedInP1, projSupervisedByU2)).toBe(true);
    expect(canCommentOnTask(staffA, taskInHiddenP3, projHiddenFromU2AndU3)).toBe(false);
  });

  it('guards admin access and prevents Admin from demoting or deleting themselves', () => {
    expect(canAccessAdmin(admin)).toBe(true);
    expect(canAccessAdmin(supervisor)).toBe(false);
    expect(canAccessAdmin(staffA)).toBe(false);

    expect(canModifyUserRole(admin, admin.id)).toBe(false);
    expect(canDeleteUser(admin, admin.id)).toBe(false);
    expect(canModifyUserRole(admin, supervisor.id)).toBe(true);
    expect(canDeleteUser(admin, supervisor.id)).toBe(true);
    expect(canModifyUserRole(supervisor, staffA.id)).toBe(false);
  });
});
