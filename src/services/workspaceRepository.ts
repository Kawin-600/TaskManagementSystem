import { PROJECT_COLORS, STORAGE_KEYS } from '../config/appConfig';
import { getTodayStr } from '../domain/dates';
import { compactPhases, getPhaseCount, getPhaseNumbers } from '../domain/roadmap';
import type {
  CreateMilestoneInput,
  CreateProjectInput,
  CreateTaskInput,
  CreateUserInput,
  ImportProjectsInput,
  ImportProjectsResult,
  Milestone,
  Project,
  Task,
  UpdateMilestoneInput,
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
  milestones: Milestone[];
}

export interface WorkspaceRepository {
  loadAll(): Promise<WorkspaceSnapshot>;
  updateExcelAlias?(userId: string, alias: string): Promise<void>;
  createProject(input: CreateProjectInput): Promise<Project>;
  updateProject(projectId: string, input: UpdateProjectInput): Promise<Project>;
  updateProjectMembers(
    projectId: string,
    memberIds: string[],
  ): Promise<{ project: Project; reassignedTaskCount: number }>;
  deleteProject(projectId: string): Promise<void>;
  importProjects(input: ImportProjectsInput): Promise<ImportProjectsResult>;
  createTask(input: CreateTaskInput): Promise<Task>;
  updateTask(taskId: string, input: UpdateTaskInput): Promise<Task>;
  deleteTask(taskId: string): Promise<void>;
  addComment(taskId: string, userId: string, text: string): Promise<Task>;
  submitTask(taskId: string, userId: string, text: string, image?: string): Promise<Task>;
  returnTask(taskId: string, userId: string, reason: string, image?: string): Promise<Task>;
  saveCollaboratorDetail(taskId: string, userId: string, text: string): Promise<void>;
  createMilestone(input: CreateMilestoneInput): Promise<Milestone>;
  updateMilestone(milestoneId: string, input: UpdateMilestoneInput): Promise<Milestone>;
  deleteMilestone(milestoneId: string): Promise<void>;
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
  executive: 'sky',
  staff: 'emerald',
};

function dedupe(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

const VALID_ROLES = new Set<string>(['admin', 'supervisor', 'executive', 'staff']);
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
    (v.feature === undefined || typeof v.feature === 'string') &&
    typeof v.description === 'string' &&
    typeof v.assigneeId === 'string' &&
    (v.collaboratorIds === undefined || (Array.isArray(v.collaboratorIds) && v.collaboratorIds.every(id => typeof id === 'string'))) &&
    typeof v.status === 'string' &&
    VALID_STATUSES.has(v.status) &&
    typeof v.priority === 'string' &&
    VALID_PRIORITIES.has(v.priority) &&
    typeof v.startDate === 'string' &&
    v.startDate.length > 0 &&
    typeof v.dueDate === 'string' &&
    v.dueDate.length > 0 &&
    typeof v.createdAt === 'string' &&
    (v.milestoneId === undefined || typeof v.milestoneId === 'string') &&
    Array.isArray(v.comments)
  );
}

function assertTaskMilestone(
  projectId: string,
  milestoneId: string | null | undefined,
  milestones: Milestone[],
): void {
  if (milestoneId == null || milestoneId === '') return;
  const milestone = milestones.find((item) => item.id === milestoneId);
  if (!milestone) throw new Error('ไม่พบ Milestone ที่เลือก');
  if (milestone.projectId !== projectId) throw new Error('Milestone ต้องอยู่ในโปรเจคเดียวกับงาน');
}

type StoredMilestone = Omit<Milestone, 'phase'> & { phase?: number | null };

function isValidPhase(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function isValidMilestone(v: unknown): v is StoredMilestone {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.projectId === 'string' &&
    typeof v.title === 'string' &&
    typeof v.ownerId === 'string' &&
    typeof v.startDate === 'string' &&
    v.startDate.length > 0 &&
    typeof v.endDate === 'string' &&
    v.endDate.length > 0 &&
    typeof v.progress === 'number' &&
    Number.isFinite(v.progress) &&
    (v.phase === undefined || v.phase === null || typeof v.phase === 'number') &&
    typeof v.createdAt === 'string'
  );
}

function normalizeProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function isProjectPerson(project: Project, userId: string): boolean {
  return project.supervisorId === userId || project.memberIds.includes(userId);
}

function assertValidMilestone(milestone: Milestone, project: Project | undefined): void {
  if (!milestone.title) throw new Error('กรุณาระบุชื่อ Milestone');
  if (!project) throw new Error('ไม่พบโปรเจค');
  if (!isProjectPerson(project, milestone.ownerId)) {
    throw new Error('ผู้ดูแลต้องเป็นสมาชิกของโปรเจค');
  }
  if (!milestone.startDate || !milestone.endDate) {
    throw new Error('กรุณาระบุวันเริ่มต้นและวันสิ้นสุด');
  }
  if (milestone.endDate < milestone.startDate) {
    throw new Error('วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น');
  }
}

/** Hands milestones whose owner is no longer part of the project to its supervisor. */
function reassignOrphanMilestones(milestones: Milestone[], projects: Project[]): Milestone[] {
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  return milestones.map((m) => {
    const project = projectMap.get(m.projectId);
    if (!project || isProjectPerson(project, m.ownerId)) return m;
    return { ...m, ownerId: project.supervisorId };
  });
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

function syncMilestoneDates(snapshot: WorkspaceSnapshot): void {
  const ranges = new Map<string, { startDate: string; endDate: string }>();
  for (const task of snapshot.tasks) {
    if (!task.milestoneId) continue;
    const range = ranges.get(task.milestoneId);
    if (!range) ranges.set(task.milestoneId, { startDate: task.startDate, endDate: task.dueDate });
    else {
      if (task.startDate < range.startDate) range.startDate = task.startDate;
      if (task.dueDate > range.endDate) range.endDate = task.dueDate;
    }
  }
  snapshot.milestones = snapshot.milestones.map((milestone) => {
    const range = ranges.get(milestone.id);
    return range ? { ...milestone, ...range } : milestone;
  });
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

    const storedMilestones = safeParseArray<StoredMilestone>(
      localStorage.getItem(STORAGE_KEYS.milestones),
      isValidMilestone,
    );
    let milestones: Milestone[];
    if (storedMilestones) {
      // Milestones saved before phases were stored get one from their start-date order.
      const needsLegacyPhases = storedMilestones.some(
        (m) => m.phase !== null && !isValidPhase(m.phase),
      );
      const fallback = needsLegacyPhases
        ? getPhaseNumbers(storedMilestones.filter((m) => m.phase !== null && !isValidPhase(m.phase)))
        : null;
      milestones = compactPhases(
        storedMilestones.map((m) => ({
          ...m,
          phase:
            m.phase === null
              ? null
              : isValidPhase(m.phase)
                ? m.phase
                : fallback?.get(m.id) ?? 1,
        })),
      );
      if (needsLegacyPhases) {
        localStorage.setItem(STORAGE_KEYS.milestones, JSON.stringify(milestones));
      }
    } else {
      // Data saved before milestones existed (or a damaged key): add samples, keep everything else.
      const projectMap = new Map(projects.map((p) => [p.id, p]));
      milestones = compactPhases(
        createSeedData(this.getToday()).milestones.filter((m) => {
          const project = projectMap.get(m.projectId);
          return Boolean(project && isProjectPerson(project, m.ownerId));
        }),
      );
      localStorage.setItem(STORAGE_KEYS.milestones, JSON.stringify(milestones));
    }

    const snapshot = { users, projects, tasks, milestones };
    syncMilestoneDates(snapshot);
    return snapshot;
  }

  private writeSnapshot(snapshot: WorkspaceSnapshot): void {
    syncMilestoneDates(snapshot);
    for (const task of snapshot.tasks) {
      if (!task.collaboratorIds?.length) continue;
      const project = snapshot.projects.find(p => p.id === task.projectId);
      task.collaboratorIds = project && task.assigneeId
        ? dedupe(task.collaboratorIds.filter(id => id !== task.assigneeId && isProjectPerson(project, id)))
        : [];
    }
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(snapshot.users));
    localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(snapshot.projects));
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(snapshot.tasks));
    localStorage.setItem(STORAGE_KEYS.milestones, JSON.stringify(snapshot.milestones));
  }

  async loadAll(): Promise<WorkspaceSnapshot> {
    return this.readSnapshot();
  }

  async updateExcelAlias(userId: string, alias: string): Promise<void> {
    const snap = this.readSnapshot();
    if (!snap.users.some((user) => user.id === userId)) throw new Error('ไม่พบผู้ใช้');
    snap.users = snap.users.map((user) => user.id === userId ? { ...user, excelAlias: alias.trim() } : user);
    this.writeSnapshot(snap);
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

  async importProjects(input: ImportProjectsInput): Promise<ImportProjectsResult> {
    const snap = this.readSnapshot();
    const existingNames = new Set(snap.projects.map((project) => project.name.trim().toLowerCase()));
    const skippedProjectNames: string[] = [];
    let projectCount = 0;
    let taskCount = 0;

    input.projects.forEach((importedProject, projectIndex) => {
      const name = importedProject.name.trim();
      if (!name || existingNames.has(name.toLowerCase())) {
        if (name) skippedProjectNames.push(name);
        return;
      }
      const project: Project = {
        id: generateId('p'),
        name,
        description: `นำเข้าจาก Excel: ${input.sourceName}`,
        color: PROJECT_COLORS[projectIndex % PROJECT_COLORS.length],
        supervisorId: input.supervisorId,
        memberIds: dedupe([input.supervisorId, ...importedProject.tasks.flatMap((task) => [task.assigneeId, ...(task.collaboratorIds ?? [])]).filter((id): id is string => Boolean(id && snap.users.some((user) => user.id === id)))]),
      };
      snap.projects.push(project);
      existingNames.add(name.toLowerCase());
      projectCount += 1;

      importedProject.tasks.forEach((importedTask) => {
        const normalizedTitle = normalizeName(importedTask.module || importedTask.title);
        const existingMilestone = snap.milestones.find(
          (milestone) => milestone.projectId === project.id && normalizeName(milestone.title) === normalizedTitle,
        );
        if (!normalizedTitle) return;
        const milestoneId = existingMilestone?.id ?? generateId('m');
        const taskId = generateId('t');
        if (!existingMilestone) {
          snap.milestones.push({
            id: milestoneId,
            projectId: project.id,
            title: (importedTask.module || importedTask.title).trim(),
            ownerId: input.supervisorId,
            startDate: importedTask.startDate,
            endDate: importedTask.dueDate,
            progress: importedTask.status === 'completed' ? 100 : 0,
            phase: null,
            createdAt: this.getToday(),
          });
        }
        snap.tasks.push({
          id: taskId,
          projectId: project.id,
          milestoneId,
          title: importedTask.title.trim(),
          module: importedTask.module?.trim() ?? '',
          feature: importedTask.feature.trim(),
          description: importedTask.description.trim(),
          assigneeId: project.memberIds.includes(importedTask.assigneeId ?? '') ? importedTask.assigneeId! : input.supervisorId,
          collaboratorIds: dedupe(importedTask.collaboratorIds ?? []).filter((id) => project.memberIds.includes(id) && id !== (project.memberIds.includes(importedTask.assigneeId ?? '') ? importedTask.assigneeId : input.supervisorId)),
          status: importedTask.status,
          priority: 'medium',
          startDate: importedTask.startDate,
          dueDate: importedTask.dueDate,
          createdAt: this.getToday(),
          comments: [],
        });
        taskCount += 1;
      });
      snap.milestones = snap.milestones.map((milestone) => {
        if (milestone.projectId !== project.id) return milestone;
        const linkedTasks = snap.tasks.filter((task) => task.milestoneId === milestone.id);
        if (linkedTasks.length === 0) return milestone;
        const completedTasks = linkedTasks.filter((task) => task.status === 'completed').length;
        return { ...milestone, progress: Math.round((completedTasks / linkedTasks.length) * 100) };
      });
    });

    this.writeSnapshot(snap);
    return { projectCount, taskCount, skippedProjectNames };
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
      description:
        input.description !== undefined ? input.description.trim() : existing.description,
      color: input.color ?? existing.color,
      supervisorId: nextSupervisorId,
      memberIds: nextMemberIds,
    };

    const memberSet = new Set(nextMemberIds);
    snap.tasks = snap.tasks.map((task) =>
      task.projectId === projectId && task.assigneeId && !memberSet.has(task.assigneeId)
        ? { ...task, assigneeId: nextSupervisorId }
        : task,
    );
    snap.projects = snap.projects.map((p) => (p.id === projectId ? updated : p));
    snap.milestones = reassignOrphanMilestones(snap.milestones, snap.projects);
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
      if (task.projectId === projectId && task.assigneeId && !memberSet.has(task.assigneeId)) {
        reassignedTaskCount += 1;
        return { ...task, assigneeId: existing.supervisorId };
      }
      return task;
    });

    const updated: Project = { ...existing, memberIds: nextMemberIds };
    snap.projects = snap.projects.map((p) => (p.id === projectId ? updated : p));
    snap.milestones = reassignOrphanMilestones(snap.milestones, snap.projects);
    this.writeSnapshot(snap);
    return { project: updated, reassignedTaskCount };
  }

  async deleteProject(projectId: string): Promise<void> {
    const snap = this.readSnapshot();
    snap.projects = snap.projects.filter((p) => p.id !== projectId);
    snap.tasks = snap.tasks.filter((t) => t.projectId !== projectId);
    snap.milestones = snap.milestones.filter((m) => m.projectId !== projectId);
    this.writeSnapshot(snap);
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const snap = this.readSnapshot();
    const project = snap.projects.find((item) => item.id === input.projectId);
    const normalizedTitle = normalizeName(input.module?.trim() || input.title);
    const existingMilestone = snap.milestones.find(
      (milestone) =>
        milestone.projectId === input.projectId && normalizeName(milestone.title) === normalizedTitle,
    );
    const milestone: Milestone = existingMilestone ?? {
      id: generateId('m'),
      projectId: input.projectId,
      title: (input.module?.trim() || input.title).trim(),
      ownerId: input.assigneeId || project?.supervisorId || '',
      startDate: input.startDate,
      endDate: input.dueDate,
      progress: 0,
      phase: null,
      createdAt: this.getToday(),
    };
    if (!existingMilestone) assertValidMilestone(milestone, project);
    const task: Task = {
      id: generateId('t'),
      projectId: input.projectId,
      milestoneId: milestone.id,
      title: input.title.trim(),
      module: input.module?.trim() ?? '',
      feature: input.feature?.trim() ?? '',
      description: input.description.trim(),
      assigneeId: input.assigneeId,
      collaboratorIds: input.collaboratorIds ?? [],
      status: 'todo',
      priority: input.priority,
      startDate: input.startDate,
      dueDate: input.dueDate,
      createdAt: this.getToday(),
      comments: [],
    };
    snap.tasks = [...snap.tasks, task];
    if (!existingMilestone) snap.milestones = [...snap.milestones, milestone];
    else {
      const linkedTasks = snap.tasks.filter((linkedTask) => linkedTask.milestoneId === milestone.id);
      const completedTasks = linkedTasks.filter((linkedTask) => linkedTask.status === 'completed').length;
      const progress = Math.round((completedTasks / linkedTasks.length) * 100);
      snap.milestones = snap.milestones.map((item) =>
        item.id === milestone.id ? { ...item, progress } : item,
      );
    }
    this.writeSnapshot(snap);
    return task;
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<Task> {
    const snap = this.readSnapshot();
    const existing = snap.tasks.find((t) => t.id === taskId);
    if (!existing) throw new Error('ไม่พบงานที่ต้องการแก้ไข');

    if (input.milestoneId !== undefined) {
      assertTaskMilestone(existing.projectId, input.milestoneId, snap.milestones);
    }

    const updated: Task = {
      ...existing,
      ...(input.milestoneId !== undefined
        ? input.milestoneId
          ? { milestoneId: input.milestoneId }
          : { milestoneId: undefined }
        : {}),
      title: input.title !== undefined ? input.title.trim() : existing.title,
      module: input.module !== undefined ? input.module.trim() : existing.module,
      feature: input.feature !== undefined ? input.feature.trim() : existing.feature,
      description: input.description !== undefined ? input.description.trim() : existing.description,
      assigneeId: input.assigneeId ?? existing.assigneeId,
      collaboratorIds: input.collaboratorIds ?? existing.collaboratorIds,
      status: input.status ?? existing.status,
      priority: input.priority ?? existing.priority,
      startDate: input.startDate ?? existing.startDate,
      dueDate: input.dueDate ?? existing.dueDate,
    };

    if (existing.milestoneId && updated.assigneeId !== existing.assigneeId) {
      const milestone = snap.milestones.find((item) => item.id === existing.milestoneId);
      const project = snap.projects.find((item) => item.id === existing.projectId);
      if (milestone && project) {
        const updatedMilestone = {
          ...milestone,
          ownerId: updated.assigneeId || project.supervisorId,
        };
        assertValidMilestone(updatedMilestone, project);
        snap.milestones = snap.milestones.map((item) =>
          item.id === milestone.id ? updatedMilestone : item,
        );
      }
    }

    snap.tasks = snap.tasks.map((t) => (t.id === taskId ? updated : t));

    if (updated.status !== existing.status && updated.milestoneId) {
      const updatedMilestone = snap.milestones.find(
        (milestone) => milestone.id === updated.milestoneId,
      );
      const milestoneIdsInPhase = new Set(
        updatedMilestone?.phase == null
          ? [updated.milestoneId]
          : snap.milestones
              .filter(
                (milestone) =>
                  milestone.projectId === updatedMilestone.projectId &&
                  milestone.phase === updatedMilestone.phase,
              )
              .map((milestone) => milestone.id),
      );
      const linkedTasks = snap.tasks.filter(
        (task) => task.milestoneId && milestoneIdsInPhase.has(task.milestoneId),
      );
      const completedTasks = linkedTasks.filter((task) => task.status === 'completed').length;
      const progress = linkedTasks.length === 0
        ? 0
        : Math.round((completedTasks / linkedTasks.length) * 100);

      snap.milestones = snap.milestones.map((milestone) =>
        milestoneIdsInPhase.has(milestone.id) ? { ...milestone, progress } : milestone,
      );
    }

    this.writeSnapshot(snap);
    return updated;
  }

  async deleteTask(taskId: string): Promise<void> {
    const snap = this.readSnapshot();
    const task = snap.tasks.find((item) => item.id === taskId);
    snap.tasks = snap.tasks.filter((t) => t.id !== taskId);
    if (task?.milestoneId) {
      const linkedTasks = snap.tasks.filter(
        (remainingTask) => remainingTask.milestoneId === task.milestoneId,
      );
      if (linkedTasks.length === 0) {
        snap.milestones = compactPhases(
          snap.milestones.filter((milestone) => milestone.id !== task.milestoneId),
        );
      } else {
        const completedTasks = linkedTasks.filter(
          (remainingTask) => remainingTask.status === 'completed',
        ).length;
        const progress = Math.round((completedTasks / linkedTasks.length) * 100);
        snap.milestones = snap.milestones.map((milestone) =>
          milestone.id === task.milestoneId ? { ...milestone, progress } : milestone,
        );
      }
    }
    this.writeSnapshot(snap);
  }

  async saveCollaboratorDetail(taskId: string, userId: string, text: string): Promise<void> {
    const snapshot = this.readSnapshot();
    const task = snapshot.tasks.find(item => item.id === taskId);
    if (!task?.collaboratorIds?.includes(userId) || task.status === 'completed') {
      throw new Error('ไม่สามารถแก้ไขรายละเอียดผู้ร่วมงานในงานนี้ได้');
    }
    task.collaboratorDetails = { ...task.collaboratorDetails, [userId]: text.trim() };
    this.writeSnapshot(snapshot);
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

  async submitTask(taskId: string, userId: string, text: string, image?: string): Promise<Task> {
    const snap = this.readSnapshot();
    const task = snap.tasks.find((item) => item.id === taskId);
    if (!task || task.status !== 'in_progress') throw new Error('งานนี้ไม่ได้อยู่ในสถานะกำลังทำ');
    const comment = { id: generateId('c'), userId, text, createdAt: new Date().toISOString(), ...(image && { image }) };
    const updated: Task = { ...task, status: 'review', comments: [...task.comments, comment] };
    snap.tasks = snap.tasks.map((item) => item.id === taskId ? updated : item);
    this.writeSnapshot(snap);
    return updated;
  }

  async returnTask(taskId: string, userId: string, reason: string, image?: string): Promise<Task> {
    const snap = this.readSnapshot();
    const task = snap.tasks.find((item) => item.id === taskId);
    if (!task || task.status !== 'review') throw new Error('งานนี้ไม่ได้อยู่ระหว่างรอตรวจสอบ');
    if (!reason.trim()) throw new Error('กรุณาระบุสิ่งที่ต้องแก้ไข');
    const comment = { id: generateId('c'), userId, text: `ส่งกลับแก้ไข\n${reason.trim()}`, createdAt: new Date().toISOString(), ...(image && { image }) };
    const updated: Task = { ...task, status: 'in_progress', comments: [...task.comments, comment] };
    snap.tasks = snap.tasks.map((item) => item.id === taskId ? updated : item);
    this.writeSnapshot(snap);
    return updated;
  }

  async createMilestone(input: CreateMilestoneInput): Promise<Milestone> {
    const snap = this.readSnapshot();
    if (
      snap.milestones.some(
        (milestone) =>
          milestone.projectId === input.projectId &&
          normalizeName(milestone.title) === normalizeName(input.title),
      )
    ) {
      throw new Error('มี Milestone ชื่อนี้อยู่ในโปรเจคแล้ว');
    }
    const milestone: Milestone = {
      id: generateId('m'),
      projectId: input.projectId,
      title: input.title.trim(),
      ownerId: input.ownerId,
      startDate: input.startDate,
      endDate: input.endDate,
      progress: normalizeProgress(input.progress),
      phase:
        input.phase === null
          ? null
          : isValidPhase(input.phase)
            ? input.phase
            : getPhaseCount(snap.milestones.filter((m) => m.projectId === input.projectId)) + 1,
      createdAt: this.getToday(),
    };
    assertValidMilestone(
      milestone,
      snap.projects.find((p) => p.id === milestone.projectId),
    );
    snap.milestones = compactPhases([...snap.milestones, milestone]);
    this.writeSnapshot(snap);
    return snap.milestones.find((m) => m.id === milestone.id) ?? milestone;
  }

  async updateMilestone(milestoneId: string, input: UpdateMilestoneInput): Promise<Milestone> {
    const snap = this.readSnapshot();
    const existing = snap.milestones.find((m) => m.id === milestoneId);
    if (!existing) throw new Error('ไม่พบ Milestone ที่ต้องการแก้ไข');
    if (
      input.title !== undefined &&
      snap.milestones.some(
        (milestone) =>
          milestone.id !== milestoneId &&
          milestone.projectId === existing.projectId &&
          normalizeName(milestone.title) === normalizeName(input.title!),
      )
    ) {
      throw new Error('มี Milestone ชื่อนี้อยู่ในโปรเจคแล้ว');
    }

    const updated: Milestone = {
      ...existing,
      title: input.title !== undefined ? input.title.trim() : existing.title,
      ownerId: input.ownerId ?? existing.ownerId,
      startDate: input.startDate ?? existing.startDate,
      endDate: input.endDate ?? existing.endDate,
      progress:
        input.progress !== undefined ? normalizeProgress(input.progress) : existing.progress,
      phase:
        input.phase === null
          ? null
          : isValidPhase(input.phase)
            ? input.phase
            : existing.phase,
    };
    assertValidMilestone(
      updated,
      snap.projects.find((p) => p.id === updated.projectId),
    );
    snap.milestones = compactPhases(
      snap.milestones.map((m) => (m.id === milestoneId ? updated : m)),
    );
    this.writeSnapshot(snap);
    return snap.milestones.find((m) => m.id === milestoneId) ?? updated;
  }

  async deleteMilestone(milestoneId: string): Promise<void> {
    const snap = this.readSnapshot();
    snap.milestones = compactPhases(snap.milestones.filter((m) => m.id !== milestoneId));
    snap.tasks = snap.tasks.filter((task) => task.milestoneId !== milestoneId);
    this.writeSnapshot(snap);
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

    snap.milestones = reassignOrphanMilestones(snap.milestones, snap.projects);
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
