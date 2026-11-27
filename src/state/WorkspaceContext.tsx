import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  canManageMilestones,
  canManageUsers,
  getVisibleMilestones,
  canAccessAdmin,
  canApproveOrRejectTask,
  canCommentOnTask,
  canCreateProject,
  canCreateTaskInProject,
  canDeleteTask,
  canDeleteUser,
  canEditTask,
  canSetTaskPriority,
  canManageProject,
  canModifyUserRole,
  getVisibleProjects,
  getVisibleTasks,
  getVisibleTeamUsers,
  validateTaskStatusTransition,
} from '../domain/rbac';
import { defaultRepository, type WorkspaceRepository } from '../services/workspaceRepository';
import type {
  CreateMilestoneInput,
  Milestone,
  UpdateMilestoneInput,
  CreateProjectInput,
  CreateTaskInput,
  CreateUserInput,
  ImportProjectsInput,
  ImportProjectsResult,
  Project,
  Task,
  TaskStatus,
  UpdateProjectInput,
  UpdateTaskInput,
  User,
  UserRole,
} from '../types/models';
import { getThaiRoleName, getThaiStatusName } from '../components/ui/Badges';
import type { TaskNotificationEvent } from '../domain/taskNotifications';
import { formatDateObj, formatThaiDateShort } from '../domain/dates';
import { readTelegramPreferences, requestTelegramSettings, requestLineSettings, readNotificationChannel, telegramHeaders } from '../services/telegramSettings';
import {
  buildTelegramDigest,
  getTelegramDigestKind,
  selectTelegramDigestTasks,
  telegramPriorityLabels,
} from '../domain/telegramDigest';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface WorkspaceContextValue {
  users: User[];
  projects: Project[];
  tasks: Task[];
  milestones: Milestone[];
  visibleProjects: Project[];
  visibleTasks: Task[];
  visibleMilestones: Milestone[];
  visibleTeamUsers: User[];
  isLoading: boolean;
  createProject: (input: CreateProjectInput) => Promise<Project | null>;
  updateProject: (projectId: string, input: UpdateProjectInput) => Promise<Project | null>;
  updateProjectMembers: (projectId: string, memberIds: string[]) => Promise<boolean>;
  deleteProject: (projectId: string) => Promise<boolean>;
  importProjects: (input: ImportProjectsInput) => Promise<ImportProjectsResult | null>;
  createTask: (input: CreateTaskInput) => Promise<Task | null>;
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<Task | null>;
  moveTaskStatus: (taskId: string, newStatus: TaskStatus) => Promise<boolean>;
  approveTask: (taskId: string) => Promise<boolean>;
  rejectTask: (taskId: string) => Promise<boolean>;
  deleteTask: (taskId: string) => Promise<boolean>;
  addComment: (taskId: string, text: string) => Promise<boolean>;
  saveCollaboratorDetail: (taskId: string, text: string) => Promise<void>;
  createMilestone: (input: CreateMilestoneInput) => Promise<Milestone | null>;
  updateMilestone: (milestoneId: string, input: UpdateMilestoneInput) => Promise<Milestone | null>;
  deleteMilestone: (milestoneId: string) => Promise<boolean>;
  createUser: (input: CreateUserInput) => Promise<User | null>;
  updateUserRole: (userId: string, newRole: UserRole) => Promise<boolean>;
  deleteUser: (userId: string) => Promise<boolean>;
  resetSampleData: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function formatRepoError(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function WorkspaceProvider({
  repository = defaultRepository,
  children,
}: {
  repository?: WorkspaceRepository;
  children: ReactNode;
}) {
  const { currentUser, refreshSession } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const notifyTask = useCallback(async (task: Task, ...events: TaskNotificationEvent[]) => {
    if (!events.length) return false;
    try {
      const preferences = readTelegramPreferences(task.assigneeId);
      const telegramEvents = preferences.priorities.includes(task.priority) ? events.filter((event) =>
        preferences.topics.includes(
          event === 'created' || event === 'assigned' || event === 'dueDateChanged' || event === 'priorityChanged'
            ? event
            : 'statusChanged',
        ),
      ) : [];
      const response = await fetch('/api/task-notifications', {
        method: 'POST',
        headers: telegramHeaders(),
        body: JSON.stringify({
          events,
          telegramEvents,
          channel: readNotificationChannel(task.assigneeId),
          assigneeId: task.assigneeId,
          task: {
            title: task.title.slice(0, 180),
            assignee: users.find((user) => user.id === task.assigneeId)?.name.slice(0, 180),
          priority: telegramPriorityLabels[task.priority],
            dueDate: task.dueDate ? formatThaiDateShort(task.dueDate) : undefined,
          },
        }),
        keepalive: true,
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 204 || response.status === 404) return false;
      if (!response.ok) throw new Error('Task notification request failed');
      const result = await response.json();
      const failed = [result.telegram === 'failed' && 'Telegram', result.line === 'failed' && 'LINE'].filter(Boolean);
      if (failed.length) showToast(`บันทึกงานแล้ว แต่ส่งแจ้งเตือนผ่าน ${failed.join(' และ ')} ไม่สำเร็จ`, 'warning');
    } catch {
      showToast('บันทึกงานแล้ว แต่ระบบแจ้งเตือนติดต่อไม่ได้', 'warning');
    }
  }, [showToast, users]);

  const reload = useCallback(async () => {
    const snap = await repository.loadAll();
    setUsers(snap.users);
    setProjects(snap.projects);
    setTasks(snap.tasks);
    setMilestones(snap.milestones);
  }, [repository]);

  useEffect(() => {
    let active = true;
    repository
      .loadAll()
      .then((snap) => {
        if (!active) return;
        setUsers(snap.users);
        setProjects(snap.projects);
        setTasks(snap.tasks);
        setMilestones(snap.milestones);
      })
      .catch((err) => {
        if (!active) return;
        showToast(formatRepoError(err, 'ไม่สามารถโหลดข้อมูลระบบได้'), 'error');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repository, showToast]);

  const visibleProjects = useMemo(
    () => (currentUser ? getVisibleProjects(currentUser, projects) : []),
    [currentUser, projects],
  );

  const visibleTasks = useMemo(
    () => (currentUser ? getVisibleTasks(currentUser, projects, tasks) : []),
    [currentUser, projects, tasks],
  );

  useEffect(() => {
    if (!currentUser || isLoading) return;
    const userId = currentUser.id;
    const lockKey = `taskflow.telegramDigest.${userId}`;
    let active = true;
    let checking = false;

    async function check() {
      if (!active || checking) return;
      checking = true;
      try {
        const sendDigest = async () => {
          if (!active) return;
          const now = new Date();
          const today = formatDateObj(now);
          const kind = getTelegramDigestKind(now);
          const preferences = readTelegramPreferences(userId);
          if (!kind || !preferences.digests.includes(kind) || !preferences.priorities.length) return;
          const channel = readNotificationChannel(userId);
          const historyKey = `${lockKey}.${channel}.${kind}`;
          if (localStorage.getItem(historyKey) === today) return;
          const eligible = selectTelegramDigestTasks(visibleTasks, userId, preferences.priorities, kind, now);
          const result = await (channel === 'line' ? requestLineSettings : requestTelegramSettings)(userId, 'digest', buildTelegramDigest(kind, eligible, getThaiStatusName));
          if (result.result === 'accepted') localStorage.setItem(historyKey, today);
        };
        if (navigator.locks) await navigator.locks.request(lockKey, sendDigest);
        else await sendDigest();
      } catch {
        // Try again on the next check if browser storage is unavailable.
      } finally {
        checking = false;
      }
    }

    void check();
    const timer = window.setInterval(() => void check(), 60000);
    const onChange = () => void check();
    window.addEventListener('taskflow:telegram-preferences', onChange);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('taskflow:telegram-preferences', onChange);
    };
  }, [currentUser, isLoading, visibleTasks]);

  const visibleMilestones = useMemo(
    () => (currentUser ? getVisibleMilestones(currentUser, projects, milestones) : []),
    [currentUser, projects, milestones],
  );

  const visibleTeamUsers = useMemo(
    () => (currentUser ? getVisibleTeamUsers(currentUser, projects, users) : []),
    [currentUser, projects, users],
  );

  const createProject = useCallback(
    async (input: CreateProjectInput): Promise<Project | null> => {
      if (!currentUser || !canCreateProject(currentUser)) {
        showToast('คุณไม่มีสิทธิ์สร้างโปรเจคใหม่', 'error');
        return null;
      }
      try {
        const created = await repository.createProject(input);
        await reload();
        showToast('สร้างโปรเจคใหม่สำเร็จแล้ว', 'success');
        return created;
      } catch (err) {
        showToast(formatRepoError(err, 'สร้างโปรเจคไม่สำเร็จ'), 'error');
        return null;
      }
    },
    [currentUser, repository, reload, showToast],
  );

  const updateProject = useCallback(
    async (projectId: string, input: UpdateProjectInput): Promise<Project | null> => {
      const project = projects.find((p) => p.id === projectId);
      if (!currentUser || !project || !canManageProject(currentUser, project)) {
        showToast('คุณไม่มีสิทธิ์แก้ไขโปรเจคนี้', 'error');
        return null;
      }
      try {
        const updated = await repository.updateProject(projectId, input);
        await reload();
        showToast('อัปเดตข้อมูลโปรเจคเรียบร้อยแล้ว', 'success');
        return updated;
      } catch (err) {
        showToast(formatRepoError(err, 'อัปเดตข้อมูลโปรเจคไม่สำเร็จ'), 'error');
        return null;
      }
    },
    [currentUser, projects, repository, reload, showToast],
  );

  const updateProjectMembers = useCallback(
    async (projectId: string, memberIds: string[]): Promise<boolean> => {
      const project = projects.find((p) => p.id === projectId);
      if (!currentUser || !project || !canManageProject(currentUser, project)) {
        showToast('คุณไม่มีสิทธิ์จัดการสมาชิกในโปรเจคนี้', 'error');
        return false;
      }
      try {
        const res = await repository.updateProjectMembers(projectId, memberIds);
        await reload();
        if (res.reassignedTaskCount > 0) {
          showToast(
            `อัปเดตสมาชิกแล้ว และโอนงานค้าง ${res.reassignedTaskCount} งานให้หัวหน้าโปรเจค`,
            'info',
          );
        } else {
          showToast('อัปเดตรายชื่อสมาชิกโปรเจคเรียบร้อยแล้ว', 'success');
        }
        return true;
      } catch (err) {
        showToast(formatRepoError(err, 'อัปเดตสมาชิกโปรเจคไม่สำเร็จ'), 'error');
        return false;
      }
    },
    [currentUser, projects, repository, reload, showToast],
  );

  const deleteProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      const project = projects.find((p) => p.id === projectId);
      if (!currentUser || !project || !canManageProject(currentUser, project)) {
        showToast('คุณไม่มีสิทธิ์ลบโปรเจคนี้', 'error');
        return false;
      }
      try {
        await repository.deleteProject(projectId);
        await reload();
        showToast('ลบโปรเจคเรียบร้อยแล้ว', 'info');
        return true;
      } catch (err) {
        showToast(formatRepoError(err, 'ลบโปรเจคไม่สำเร็จ'), 'error');
        return false;
      }
    },
    [currentUser, projects, repository, reload, showToast],
  );

  const importProjects = useCallback(
    async (input: ImportProjectsInput): Promise<ImportProjectsResult | null> => {
      if (!currentUser || !canCreateProject(currentUser) || input.supervisorId !== currentUser.id) {
        showToast('คุณไม่มีสิทธิ์นำเข้าโปรเจค', 'error');
        return null;
      }
      try {
        const result = await repository.importProjects(input);
        await reload();
        const skipped = result.skippedProjectNames.length
          ? ` (ข้ามโปรเจคชื่อซ้ำ ${result.skippedProjectNames.length} รายการ)`
          : '';
        showToast(`นำเข้า ${result.projectCount} โปรเจค และ ${result.taskCount} งานสำเร็จ${skipped}`, 'success');
        return result;
      } catch (err) {
        showToast(formatRepoError(err, 'นำเข้า Excel ไม่สำเร็จ'), 'error');
        return null;
      }
    },
    [currentUser, repository, reload, showToast],
  );

  const createTask = useCallback(
    async (input: CreateTaskInput): Promise<Task | null> => {
      const project = projects.find((p) => p.id === input.projectId);
      if (!currentUser || !project || !canCreateTaskInProject(currentUser, project)) {
        showToast('คุณไม่มีสิทธิ์สร้างงานในโปรเจคนี้', 'error');
        return null;
      }
      try {
        const assigneeId = currentUser.role === 'staff' ? currentUser.id : input.assigneeId;
        const priority = canSetTaskPriority(currentUser) ? input.priority : 'medium';
        const created = await repository.createTask({ ...input, assigneeId, priority });
        await reload();
        showToast('สร้างงานใหม่สำเร็จเรียบร้อยแล้ว', 'success');
        notifyTask(created, 'created');
        return created;
      } catch (err) {
        showToast(formatRepoError(err, 'สร้างงานไม่สำเร็จ'), 'error');
        return null;
      }
    },
    [currentUser, projects, repository, reload, showToast, notifyTask],
  );

  const updateTask = useCallback(
    async (taskId: string, input: UpdateTaskInput): Promise<Task | null> => {
      const task = tasks.find((t) => t.id === taskId);
      const project = projects.find((p) => p.id === task?.projectId);
      if (!currentUser || !task || !project) return null;

      if (!canEditTask(currentUser, task, project) || (currentUser.role === 'staff' && input.collaboratorIds !== undefined)) {
        showToast('คุณไม่มีสิทธิ์แก้ไขงานนี้', 'error');
        return null;
      }

      if (currentUser.role === 'staff' && (
        (input.startDate !== undefined && input.startDate !== task.startDate) ||
        (input.dueDate !== undefined && input.dueDate !== task.dueDate)
      )) {
        showToast('เจ้าหน้าที่ไม่มีสิทธิ์เปลี่ยนวันเริ่มต้นหรือวันกำหนดส่ง', 'error');
        return null;
      }

      if (!canSetTaskPriority(currentUser) && input.priority !== undefined && input.priority !== task.priority) {
        showToast('คุณไม่มีสิทธิ์เปลี่ยนระดับความสำคัญของงาน', 'error');
        return null;
      }

      if (input.status && input.status !== task.status) {
        const check = validateTaskStatusTransition(currentUser, task, input.status, project);
        if (!check.allowed) {
          showToast(check.reason ?? 'ไม่สามารถเปลี่ยนสถานะงานได้', 'warning');
          return null;
        }
      }

      try {
        const safeInput: UpdateTaskInput =
          currentUser.role === 'staff' ? { ...input, assigneeId: task.assigneeId } : input;
        const updated = await repository.updateTask(taskId, safeInput);
        await reload();
        showToast('อัปเดตข้อมูลงานสำเร็จ', 'success');
        const events: TaskNotificationEvent[] = [];
        if (updated.assigneeId !== task.assigneeId) events.push('assigned');
        if (updated.dueDate !== task.dueDate) events.push('dueDateChanged');
        if (updated.priority !== task.priority) events.push('priorityChanged');
        if (updated.status !== task.status) events.push(updated.status);
        notifyTask(updated, ...events);
        return updated;
      } catch (err) {
        showToast(formatRepoError(err, 'อัปเดตข้อมูลงานไม่สำเร็จ'), 'error');
        return null;
      }
    },
    [currentUser, tasks, projects, repository, reload, showToast, notifyTask],
  );

  const moveTaskStatus = useCallback(
    async (taskId: string, newStatus: TaskStatus): Promise<boolean> => {
      const task = tasks.find((t) => t.id === taskId);
      const project = projects.find((p) => p.id === task?.projectId);
      if (!currentUser || !task || !project) return false;
      if (task.status === newStatus) return true;

      const check = validateTaskStatusTransition(currentUser, task, newStatus, project);
      if (!check.allowed) {
        showToast(
          check.reason ?? 'ไม่สามารถเปลี่ยนสถานะงานได้',
          newStatus === 'completed' ? 'warning' : 'error',
        );
        return false;
      }

      try {
        await repository.updateTask(taskId, { status: newStatus });
        await reload();
        showToast(`อัปเดตสถานะงานเป็น: ${getThaiStatusName(newStatus)}`, 'success');
        notifyTask(task, newStatus);
        return true;
      } catch (err) {
        showToast(formatRepoError(err, 'เปลี่ยนสถานะงานไม่สำเร็จ'), 'error');
        return false;
      }
    },
    [currentUser, tasks, projects, repository, reload, showToast, notifyTask],
  );

  const approveTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      const task = tasks.find((t) => t.id === taskId);
      const project = projects.find((p) => p.id === task?.projectId);
      if (!currentUser || !task || !project || !canApproveOrRejectTask(currentUser, task, project)) {
        showToast('คุณไม่มีสิทธิ์อนุมัติงานนี้', 'error');
        return false;
      }
      try {
        await repository.updateTask(taskId, { status: 'completed' });
        await reload();
        showToast(`อนุมัติงาน "${task.title}" สำเร็จแล้ว`, 'success');
        if (task.status !== 'completed') notifyTask(task, 'completed');
        return true;
      } catch (err) {
        showToast(formatRepoError(err, 'อนุมัติงานไม่สำเร็จ'), 'error');
        return false;
      }
    },
    [currentUser, tasks, projects, repository, reload, showToast, notifyTask],
  );

  const rejectTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      const task = tasks.find((t) => t.id === taskId);
      const project = projects.find((p) => p.id === task?.projectId);
      if (!currentUser || !task || !project || !canApproveOrRejectTask(currentUser, task, project)) {
        showToast('คุณไม่มีสิทธิ์ส่งกลับแก้ไขงานนี้', 'error');
        return false;
      }
      try {
        await repository.updateTask(taskId, { status: 'in_progress' });
        await reload();
        showToast(`ส่งงาน "${task.title}" กลับไปแก้ไขเพิ่มเติม`, 'warning');
        if (task.status !== 'in_progress') notifyTask(task, 'in_progress');
        return true;
      } catch (err) {
        showToast(formatRepoError(err, 'ส่งกลับแก้ไขไม่สำเร็จ'), 'error');
        return false;
      }
    },
    [currentUser, tasks, projects, repository, reload, showToast, notifyTask],
  );

  const deleteTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      const task = tasks.find((t) => t.id === taskId);
      const project = projects.find((p) => p.id === task?.projectId);
      if (!currentUser || !task || !project || !canDeleteTask(currentUser, task, project)) {
        showToast('คุณไม่มีสิทธิ์ลบงานนี้', 'error');
        return false;
      }
      try {
        await repository.deleteTask(taskId);
        await reload();
        showToast('ลบงานเรียบร้อยแล้ว', 'info');
        return true;
      } catch (err) {
        showToast(formatRepoError(err, 'ลบงานไม่สำเร็จ'), 'error');
        return false;
      }
    },
    [currentUser, tasks, projects, repository, reload, showToast],
  );

  const saveCollaboratorDetail = async (taskId: string, text: string) => {
    if (!currentUser || !visibleTasks.some(task => task.id === taskId)) return;
    try {
      await repository.saveCollaboratorDetail(taskId, currentUser.id, text);
      await reload();
      showToast('บันทึกรายละเอียดของคุณแล้ว', 'success');
    } catch (err) {
      showToast(formatRepoError(err, 'บันทึกรายละเอียดไม่สำเร็จ'), 'error');
    }
  };

  const addComment = useCallback(
    async (taskId: string, text: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      const task = tasks.find((t) => t.id === taskId);
      const project = projects.find((p) => p.id === task?.projectId);
      if (!currentUser || !task || !project || !canCommentOnTask(currentUser, task, project)) {
        showToast('คุณไม่มีสิทธิ์แสดงความคิดเห็นในงานนี้', 'error');
        return false;
      }
      try {
        await repository.addComment(taskId, currentUser.id, trimmed);
        await reload();
        showToast('ส่งข้อความความคิดเห็นเรียบร้อยแล้ว', 'success');
        return true;
      } catch (err) {
        showToast(formatRepoError(err, 'ส่งความคิดเห็นไม่สำเร็จ'), 'error');
        return false;
      }
    },
    [currentUser, tasks, projects, repository, reload, showToast],
  );

  const createUser = useCallback(
    async (input: CreateUserInput): Promise<User | null> => {
      if (!currentUser || !canManageUsers(currentUser)) {
        showToast('คุณไม่มีสิทธิ์เพิ่มผู้ใช้งาน', 'error');
        return null;
      }
      try {
        const safeInput: CreateUserInput =
          currentUser.role === 'executive' ? { ...input, role: 'staff' } : input;
        const created = await repository.createUser(safeInput);
        await reload();
        showToast('เพิ่มผู้ใช้งานใหม่เรียบร้อยแล้ว', 'success');
        return created;
      } catch (err) {
        showToast(formatRepoError(err, 'เพิ่มผู้ใช้งานไม่สำเร็จ'), 'error');
        return null;
      }
    },
    [currentUser, repository, reload, showToast],
  );

  const updateUserRole = useCallback(
    async (userId: string, newRole: UserRole): Promise<boolean> => {
      if (!currentUser || !canModifyUserRole(currentUser, userId)) {
        showToast('ไม่สามารถเปลี่ยนบทบาทของผู้ใช้งานนี้ได้', 'error');
        return false;
      }
      try {
        const res = await repository.updateUserRole(userId, newRole, currentUser.id);
        await reload();
        await refreshSession();
        if (res.transferredProjectIds.length > 0) {
          showToast(
            `อัปเดตสิทธิ์เป็น ${getThaiRoleName(newRole)} และโอนโปรเจคที่ดูแล ${res.transferredProjectIds.length} โปรเจคให้คุณแล้ว`,
            'info',
          );
        } else {
          showToast(`อัปเดตสิทธิ์ของ ${res.user.name} เป็น ${getThaiRoleName(newRole)}`, 'success');
        }
        return true;
      } catch (err) {
        showToast(formatRepoError(err, 'อัปเดตบทบาทผู้ใช้งานไม่สำเร็จ'), 'error');
        return false;
      }
    },
    [currentUser, repository, reload, refreshSession, showToast],
  );

  const deleteUser = useCallback(
    async (userId: string): Promise<boolean> => {
      if (!currentUser || !canDeleteUser(currentUser, userId)) {
        showToast('ไม่สามารถลบผู้ใช้งานนี้ได้', 'error');
        return false;
      }
      try {
        await repository.deleteUser(userId, currentUser.id);
        await reload();
        showToast('ลบผู้ใช้งานเรียบร้อยแล้ว', 'info');
        return true;
      } catch (err) {
        showToast(formatRepoError(err, 'ลบผู้ใช้งานไม่สำเร็จ'), 'error');
        return false;
      }
    },
    [currentUser, repository, reload, showToast],
  );

  const createMilestone = useCallback(
    async (input: CreateMilestoneInput): Promise<Milestone | null> => {
      const project = projects.find((p) => p.id === input.projectId);
      if (!currentUser || !project || !canManageMilestones(currentUser, project)) {
        showToast('คุณไม่มีสิทธิ์จัดการ Milestone ของโปรเจคนี้', 'error');
        return null;
      }
      try {
        const created = await repository.createMilestone(input);
        await reload();
        showToast('เพิ่ม Milestone ใหม่เรียบร้อยแล้ว', 'success');
        return created;
      } catch (err) {
        showToast(formatRepoError(err, 'เพิ่ม Milestone ไม่สำเร็จ'), 'error');
        return null;
      }
    },
    [currentUser, projects, repository, reload, showToast],
  );

  const updateMilestone = useCallback(
    async (milestoneId: string, input: UpdateMilestoneInput): Promise<Milestone | null> => {
      const milestone = milestones.find((m) => m.id === milestoneId);
      const project = projects.find((p) => p.id === milestone?.projectId);
      if (!currentUser || !milestone || !project || !canManageMilestones(currentUser, project)) {
        showToast('คุณไม่มีสิทธิ์จัดการ Milestone ของโปรเจคนี้', 'error');
        return null;
      }
      try {
        const updated = await repository.updateMilestone(milestoneId, input);
        await reload();
        showToast('อัปเดต Milestone เรียบร้อยแล้ว', 'success');
        return updated;
      } catch (err) {
        showToast(formatRepoError(err, 'อัปเดต Milestone ไม่สำเร็จ'), 'error');
        return null;
      }
    },
    [currentUser, milestones, projects, repository, reload, showToast],
  );

  const deleteMilestone = useCallback(
    async (milestoneId: string): Promise<boolean> => {
      const milestone = milestones.find((m) => m.id === milestoneId);
      const project = projects.find((p) => p.id === milestone?.projectId);
      if (!currentUser || !milestone || !project || !canManageMilestones(currentUser, project)) {
        showToast('คุณไม่มีสิทธิ์จัดการ Milestone ของโปรเจคนี้', 'error');
        return false;
      }
      try {
        await repository.deleteMilestone(milestoneId);
        await reload();
        showToast('ลบ Milestone เรียบร้อยแล้ว', 'info');
        return true;
      } catch (err) {
        showToast(formatRepoError(err, 'ลบ Milestone ไม่สำเร็จ'), 'error');
        return false;
      }
    },
    [currentUser, milestones, projects, repository, reload, showToast],
  );

  const resetSampleData = useCallback(async () => {
    if (!currentUser || !canAccessAdmin(currentUser) || !repository.resetSampleData) {
      return;
    }
    try {
      const snap = await repository.resetSampleData();
      setUsers(snap.users);
      setProjects(snap.projects);
      setTasks(snap.tasks);
      setMilestones(snap.milestones);
      await refreshSession();
      showToast('รีเซ็ตข้อมูลตัวอย่างเรียบร้อยแล้ว', 'success');
    } catch (err) {
      showToast(formatRepoError(err, 'รีเซ็ตข้อมูลตัวอย่างไม่สำเร็จ'), 'error');
    }
  }, [currentUser, repository, refreshSession, showToast]);

  return (
    <WorkspaceContext.Provider
      value={{
        users,
        projects,
        tasks: currentUser && currentUser.role !== 'staff' ? tasks : visibleTasks,
        milestones,
        visibleProjects,
        visibleTasks,
        visibleMilestones,
        visibleTeamUsers,
        isLoading,
        createProject,
        updateProject,
        updateProjectMembers,
        deleteProject,
        importProjects,
        createTask,
        updateTask,
        moveTaskStatus,
        approveTask,
        rejectTask,
        deleteTask,
        addComment,
        saveCollaboratorDetail,
        createMilestone,
        updateMilestone,
        deleteMilestone,
        createUser,
        updateUserRole,
        deleteUser,
        resetSampleData,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
