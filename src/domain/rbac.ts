import type { Milestone, Project, Task, TaskStatus, User } from '../types/models';

export function canViewProject(user: User, project: Project): boolean {
  if (user.role === 'admin' || user.role === 'executive') return true;
  if (user.role === 'supervisor') {
    return project.supervisorId === user.id || project.memberIds.includes(user.id);
  }
  return project.memberIds.includes(user.id);
}

export function getVisibleProjects(user: User, projects: Project[]): Project[] {
  return projects.filter((project) => canViewProject(user, project));
}

export function canCreateProject(user: User): boolean {
  return user.role === 'admin' || user.role === 'supervisor' || user.role === 'executive';
}

export function canManageProject(user: User, project: Project): boolean {
  if (user.role === 'admin' || user.role === 'executive') return true;
  if (user.role === 'supervisor') return project.supervisorId === user.id;
  return false;
}

export function getVisibleTasks(user: User, projects: Project[], tasks: Task[]): Task[] {
  const visibleProjectIds = new Set(getVisibleProjects(user, projects).map((p) => p.id));
  return tasks.filter((task) => visibleProjectIds.has(task.projectId) && canSeeTaskAssignment(user, task));
}

function canSeeTaskAssignment(user: User, task: Task): boolean {
  return user.role !== 'staff' || task.status === 'completed' || participatesInTask(task, user.id);
}

export function participatesInTask(task: Task, userId: string): boolean {
  return task.assigneeId === userId || !!task.collaboratorIds?.includes(userId);
}

export function canCreateTask(user: User): boolean {
  return user.role === 'admin' || user.role === 'supervisor' || user.role === 'executive';
}

export function canCreateTaskInProject(user: User, project: Project): boolean {
  return canCreateTask(user) && canViewProject(user, project);
}

export function getAssignableMembers(user: User, project: Project, allUsers: User[]): User[] {
  if (!canViewProject(user, project)) return [];
  if (user.role === 'staff') {
    const self = allUsers.find((u) => u.id === user.id);
    return self ? [self] : [];
  }
  const memberSet = new Set([...project.memberIds, project.supervisorId]);
  return allUsers.filter((u) => memberSet.has(u.id));
}

export function canSetTaskPriority(user: User): boolean {
  return user.role === 'supervisor' || user.role === 'executive' || user.role === 'admin';
}

export function canEditTask(user: User, task: Task, project?: Project): boolean {
  if (project && !canViewProject(user, project)) return false;
  if (user.role === 'admin' || user.role === 'supervisor' || user.role === 'executive') return true;
  if (task.status === 'completed') return false;
  return task.assigneeId === user.id;
}

export function validateTaskStatusTransition(
  user: User,
  task: Task,
  newStatus: TaskStatus,
  project?: Project,
): { allowed: boolean; reason?: string } {
  if (project && !canViewProject(user, project)) {
    return { allowed: false, reason: 'คุณไม่มีสิทธิ์เข้าถึงโปรเจคนี้' };
  }

  if (user.role === 'admin' || user.role === 'supervisor') {
    return { allowed: true };
  }

  if (user.role === 'executive') {
    return { allowed: false, reason: 'ผู้บริหารไม่มีสิทธิ์เปลี่ยนสถานะงาน' };
  }

  if (task.assigneeId !== user.id) {
    return {
      allowed: false,
      reason: 'ไม่อนุญาต: คุณสามารถอัปเดตสถานะงานที่ได้รับมอบหมายให้ตนเองเท่านั้น',
    };
  }

  if (task.status === 'completed') {
    return {
      allowed: false,
      reason: 'งานนี้ได้รับการอนุมัติเสร็จสิ้นแล้ว หากต้องแก้ไขโปรดแจ้งหัวหน้างานหรือ Admin เพื่อเปิดงานใหม่',
    };
  }

  if (newStatus === 'completed') {
    return {
      allowed: false,
      reason: 'เจ้าหน้าที่ไม่สามารถย้ายงานไป "เสร็จสิ้น" ได้โดยตรง โปรดย้ายไป "รอตรวจสอบ" เพื่อให้หัวหน้าอนุมัติ',
    };
  }

  return { allowed: true };
}

export function canApproveOrRejectTask(user: User, task: Task, project?: Project): boolean {
  if (project && !canViewProject(user, project)) return false;
  if (user.role !== 'admin' && user.role !== 'supervisor') return false;
  return task.status === 'review';
}

export function canDeleteTask(user: User, _task: Task, project?: Project): boolean {
  if (project && !canViewProject(user, project)) return false;
  return user.role === 'admin' || user.role === 'supervisor' || user.role === 'executive';
}

export function canCommentOnTask(user: User, task: Task, project?: Project): boolean {
  if (project && (project.id !== task.projectId || !canViewProject(user, project))) return false;
  if (!project && user.role === 'staff') return participatesInTask(task, user.id);
  return canSeeTaskAssignment(user, task);
}

export function getVisibleTeamUsers(user: User, projects: Project[], allUsers: User[]): User[] {
  if (user.role === 'admin' || user.role === 'executive') return allUsers;
  const visibleProjects = getVisibleProjects(user, projects);
  const visibleUserIds = new Set<string>();
  for (const project of visibleProjects) {
    visibleUserIds.add(project.supervisorId);
    for (const memberId of project.memberIds) {
      visibleUserIds.add(memberId);
    }
  }
  return allUsers.filter((u) => visibleUserIds.has(u.id));
}

export function canAccessAdmin(user: User): boolean {
  return user.role === 'admin';
}

export function canManageUsers(user: User): boolean {
  return user.role === 'admin' || user.role === 'executive';
}

export function canModifyUserRole(actingUser: User, targetUserId: string): boolean {
  return actingUser.role === 'admin' && actingUser.id !== targetUserId;
}

export function canDeleteUser(actingUser: User, targetUserId: string): boolean {
  return canManageUsers(actingUser) && actingUser.id !== targetUserId;
}

export function getVisibleMilestones(
  user: User,
  projects: Project[],
  milestones: Milestone[],
): Milestone[] {
  const visibleProjectIds = new Set(getVisibleProjects(user, projects).map((p) => p.id));
  return milestones.filter((m) => visibleProjectIds.has(m.projectId));
}

export function canManageMilestones(user: User, project: Project): boolean {
  if (user.role === 'admin' || user.role === 'executive') return true;
  return canViewProject(user, project);
}
