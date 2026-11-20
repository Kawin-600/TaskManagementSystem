import { STORAGE_KEYS } from '../config/appConfig';
import { getTodayStr } from '../domain/dates';
import type {
  CreateProjectInput,
  CreateTaskInput,
  CreateUserInput,
  Project,
  Task,
  UpdateProjectInput,
  UpdateTaskInput,
  User,
  UserRole,
} from '../types/models';
import { createSeedData } from './seedData';

export interface WorkspaceSnapshot {
  users: User[];
  projects: Project[];
  tasks: Task[];
}

export interface WorkspaceRepository {
  loadAll(): Promise<WorkspaceSnapshot>;
  createProject(input: CreateProjectInput): Promise<Project>;
  updateProject(projectId: string, input: UpdateProjectInput): Promise<Project>;
  updateProjectMembers(
    projectId: string,
    memberIds: string[],
  ): Promise<{ project: Project; reassignedTaskCount: number }>;
  deleteProject(projectId: string): Promise<void>;
  createTask(input: CreateTaskInput): Promise<Task>;
  updateTask(taskId: string, input: UpdateTaskInput): Promise<Task>;
  deleteTask(taskId: string): Promise<void>;
  addComment(taskId: string, userId: string, text: string): Promise<Task>;
  createUser(input: CreateUserInput): Promise<User>;
  updateUserRole(
    userId: string,
    newRole: UserRole,
    actingAdminId: string,
  ): Promise<{ user: User; transferredProjectIds: string[] }>;
  deleteUser(
    userId: string,
    actingAdminId: string,
  ): Promise<{ transferredProjectIds: string[]; reassignedTaskCount: number }>;
  resetSampleData?(): Promise<WorkspaceSnapshot>;
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'purple',
  supervisor: 'indigo',
  staff: 'emerald',
};

function dedupe(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const VALID_ROLES = new Set<string>(['admin', 'supervisor', 'staff']);
const VALID_STATUSES = new Set<string>(['todo', 'in_progress', 'review', 'completed']);
const VALID_PRIORITIES = new Set<string>(['low', 'medium', 'high', 'urgent']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isValidUser(v: unknown): v is User {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.email === 'string' &&
    typeof v.role === 'string' &&
    VALID_ROLES.has(v.role) &&
    typeof v.avatar === 'string' &&
    typeof v.color === 'string'
  );
}

function isValidProject(v: unknown): v is Project {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.description === 'string' &&
    typeof v.color === 'string' &&
    typeof v.supervisorId === 'string' &&
    Array.isArray(v.memberIds) &&
    v.memberIds.every((id) => typeof id === 'string')
  );
}

function isValidTask(v: unknown): v is Task {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.projectId === 'string' &&
    typeof v.title === 'string' &&
    typeof v.description === 'string' &&
    typeof v.assigneeId === 'string' &&
    typeof v.status === 'string' &&
    VALID_STATUSES.has(v.status) &&
    typeof v.priority === 'string' &&
    VALID_PRIORITIES.has(v.priority) &&
    typeof v.startDate === 'string' &&
    v.startDate.length > 0 &&
    typeof v.dueDate === 'string' &&
    v.dueDate.length > 0 &&
    typeof v.createdAt === 'string' &&
    Array.isArray(v.comments)
  );
}

function safeParseArray<T>(raw: string | null, guard: (item: unknown) => item is T): T[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.every(guard) ? parsed : null;
  } catch {
    return null;
  }
}

export class LocalStorageRepository implements WorkspaceRepository {
  private readonly getToday: () => string;

  constructor(getToday: () => string = getTodayStr) {
    this.getToday = getToday;
  }

  private readSnapshot(): WorkspaceSnapshot {
    const users = safeParseArray<User>(localStorage.getItem(STORAGE_KEYS.users), isValidUser);
    const projects = safeParseArray<Project>(
      localStorage.getItem(STORAGE_KEYS.projects),
      isValidProject,
    );
    const tasks = safeParseArray<Task>(localStorage.getItem(STORAGE_KEYS.tasks), isValidTask);

    if (!users || users.length === 0 || !projects || !tasks) {
      const seed = createSeedData(this.getToday());
      this.writeSnapshot(seed);
      return seed;
    }

    return { users, projects, tasks };
  }

  private writeSnapshot(snapshot: WorkspaceSnapshot): void {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(snapshot.users));
    localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(snapshot.projects));
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(snapshot.tasks));
  }

  async loadAll(): Promise<WorkspaceSnapshot> {
    return this.readSnapshot();
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const snap = this.readSnapshot();
    const project: Project = {
      id: generateId('p'),
      name: input.name.trim(),
      description: input.description.trim(),
      color: input.color,
      supervisorId: input.supervisorId,
      memberIds: dedupe([input.supervisorId, ...input.memberIds]),
    };
    snap.projects = [...snap.projects, project];
    this.writeSnapshot(snap);
    return project;
  }

  async updateProject(projectId: string, input: UpdateProjectInput): Promise<Project> {
    const snap = this.readSnapshot();
    const existing = snap.projects.find((p) => p.id === projectId);
    if (!existing) throw new Error('ไม่พบโปรเจคที่ต้องการแก้ไข');

    const nextSupervisorId = input.supervisorId ?? existing.supervisorId;
    const baseMembers = input.memberIds ?? existing.memberIds;
    const nextMemberIds = dedupe([nextSupervisorId, ...baseMembers]);

    const updated: Project = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      description: input.description !== undefined ? input.description.trim() : existing.description,
      color: input.color ?? existing.color,
      supervisorId: nextSupervisorId,
      memberIds: nextMemberIds,
    };

    const memberSet = new Set(nextMemberIds);
    snap.tasks = snap.tasks.map((task) =>
      task.projectId === projectId && !memberSet.has(task.assigneeId)
        ? { ...task, assigneeId: nextSupervisorId }
        : task,
    );
    snap.projects = snap.projects.map((p) => (p.id === projectId ? updated : p));
    this.writeSnapshot(snap);
    return updated;
  }

  async updateProjectMembers(
    projectId: string,
    memberIds: string[],
  ): Promise<{ project: Project; reassignedTaskCount: number }> {
    const snap = this.readSnapshot();
    const existing = snap.projects.find((p) => p.id === projectId);
    if (!existing) throw new Error('ไม่พบโปรเจค');

    const nextMemberIds = dedupe([existing.supervisorId, ...memberIds]);
    const memberSet = new Set(nextMemberIds);
    let reassignedTaskCount = 0;

    snap.tasks = snap.tasks.map((task) => {
      if (task.projectId === projectId && !memberSet.has(task.assigneeId)) {
        reassignedTaskCount += 1;
        return { ...task, assigneeId: existing.supervisorId };
      }
      return task;
    });

    const updated: Project = { ...existing, memberIds: nextMemberIds };
    snap.projects = snap.projects.map((p) => (p.id === projectId ? updated : p));
    this.writeSnapshot(snap);
    return { project: updated, reassignedTaskCount };
  }

  async deleteProject(projectId: string): Promise<void> {
    const snap = this.readSnapshot();
    snap.projects = snap.projects.filter((p) => p.id !== projectId);
    snap.tasks = snap.tasks.filter((t) => t.projectId !== projectId);
    this.writeSnapshot(snap);
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const snap = this.readSnapshot();
    const task: Task = {
      id: generateId('t'),
      projectId: input.projectId,
      title: input.title.trim(),
      description: input.description.trim(),
      assigneeId: input.assigneeId,
      status: 'todo',
      priority: input.priority,
      startDate: input.startDate,
      dueDate: input.dueDate,
      createdAt: this.getToday(),
      comments: [],
    };
    snap.tasks = [...snap.tasks, task];
    this.writeSnapshot(snap);
    return task;
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<Task> {
    const snap = this.readSnapshot();
    const existing = snap.tasks.find((t) => t.id === taskId);
    if (!existing) throw new Error('ไม่พบงานที่ต้องการแก้ไข');

    const updated: Task = {
      ...existing,
      title: input.title !== undefined ? input.title.trim() : existing.title,
      description: input.description !== undefined ? input.description.trim() : existing.description,
      assigneeId: input.assigneeId ?? existing.assigneeId,
      status: input.status ?? existing.status,
      priority: input.priority ?? existing.priority,
      startDate: input.startDate ?? existing.startDate,
      dueDate: input.dueDate ?? existing.dueDate,
    };

    snap.tasks = snap.tasks.map((t) => (t.id === taskId ? updated : t));
    this.writeSnapshot(snap);
    return updated;
  }

  async deleteTask(taskId: string): Promise<void> {
    const snap = this.readSnapshot();
    snap.tasks = snap.tasks.filter((t) => t.id !== taskId);
    this.writeSnapshot(snap);
  }

  async addComment(taskId: string, userId: string, text: string): Promise<Task> {
    const snap = this.readSnapshot();
    const existing = snap.tasks.find((t) => t.id === taskId);
    if (!existing) throw new Error('ไม่พบงาน');

    const comment = {
      id: generateId('c'),
      userId,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    const updated: Task = { ...existing, comments: [...existing.comments, comment] };
    snap.tasks = snap.tasks.map((t) => (t.id === taskId ? updated : t));
    this.writeSnapshot(snap);
    return updated;
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const snap = this.readSnapshot();
    const normalizedEmail = input.email.trim().toLowerCase();
    if (snap.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      throw new Error('อีเมลนี้มีอยู่ในระบบแล้ว');
    }

    const trimmedName = input.name.trim();
    const avatar = trimmedName.replace(/\s+/g, '').slice(0, 2) || 'ผช';
    const user: User = {
      id: generateId('u'),
      name: trimmedName,
      email: normalizedEmail,
      password: input.password?.trim() || '1234',
      role: input.role,
      avatar,
      color: ROLE_COLORS[input.role],
    };

    snap.users = [...snap.users, user];
    this.writeSnapshot(snap);
    return user;
  }

  async updateUserRole(
    userId: string,
    newRole: UserRole,
    actingAdminId: string,
  ): Promise<{ user: User; transferredProjectIds: string[] }> {
    if (userId === actingAdminId) {
      throw new Error('ไม่สามารถเปลี่ยนบทบาทของบัญชีที่กำลังใช้งานอยู่ได้');
    }
    const snap = this.readSnapshot();
    const existing = snap.users.find((u) => u.id === userId);
    if (!existing) throw new Error('ไม่พบผู้ใช้งาน');

    const updatedUser: User = { ...existing, role: newRole, color: ROLE_COLORS[newRole] };
    const transferredProjectIds: string[] = [];

    if (newRole === 'staff') {
      snap.projects = snap.projects.map((project) => {
        if (project.supervisorId === userId) {
          transferredProjectIds.push(project.id);
          return {
            ...project,
            supervisorId: actingAdminId,
            memberIds: dedupe([actingAdminId, ...project.memberIds, userId]),
          };
        }
        return project;
      });
    }

    snap.users = snap.users.map((u) => (u.id === userId ? updatedUser : u));
    this.writeSnapshot(snap);
    return { user: updatedUser, transferredProjectIds };
  }

  async deleteUser(
    userId: string,
    actingAdminId: string,
  ): Promise<{ transferredProjectIds: string[]; reassignedTaskCount: number }> {
    if (userId === actingAdminId) {
      throw new Error('ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้');
    }
    const snap = this.readSnapshot();
    const transferredProjectIds: string[] = [];
    const projectSupervisorMap = new Map<string, string>();

    snap.projects = snap.projects.map((project) => {
      const nextSupervisorId = project.supervisorId === userId ? actingAdminId : project.supervisorId;
      if (project.supervisorId === userId) {
        transferredProjectIds.push(project.id);
      }
      const nextMemberIds = dedupe([
        nextSupervisorId,
        ...project.memberIds.filter((id) => id !== userId),
      ]);
      projectSupervisorMap.set(project.id, nextSupervisorId);
      return { ...project, supervisorId: nextSupervisorId, memberIds: nextMemberIds };
    });

    let reassignedTaskCount = 0;
    snap.tasks = snap.tasks.map((task) => {
      if (task.assigneeId === userId) {
        reassignedTaskCount += 1;
        return { ...task, assigneeId: projectSupervisorMap.get(task.projectId) ?? actingAdminId };
      }
      return task;
    });

    snap.users = snap.users.filter((u) => u.id !== userId);
    this.writeSnapshot(snap);
    return { transferredProjectIds, reassignedTaskCount };
  }

  async resetSampleData(): Promise<WorkspaceSnapshot> {
    const seed = createSeedData(this.getToday());
    this.writeSnapshot(seed);
    return seed;
  }
}

export const defaultRepository = new LocalStorageRepository();
