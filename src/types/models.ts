export type UserRole = 'admin' | 'supervisor' | 'executive' | 'staff';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  avatar: string;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  supervisorId: string;
  memberIds: string[];
}

export interface TaskComment {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  milestoneId?: string;
  title: string;
  description: string;
  assigneeId: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string;
  dueDate: string;
  createdAt: string;
  comments: TaskComment[];
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description: string;
  assigneeId: string;
  priority: TaskPriority;
  startDate: string;
  dueDate: string;
}

export interface UpdateTaskInput {
  milestoneId?: string | null;
  title?: string;
  description?: string;
  assigneeId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  startDate?: string;
  dueDate?: string;
}

export interface CreateProjectInput {
  name: string;
  description: string;
  color: string;
  supervisorId: string;
  memberIds: string[];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  color?: string;
  supervisorId?: string;
  memberIds?: string[];
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: UserRole;
  password?: string;
}

export type MilestoneStatus = 'completed' | 'in_progress' | 'delayed' | 'not_started';

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  ownerId: string;
  startDate: string;
  endDate: string;
  progress: number;
  /** 1-based phase within the project; several milestones may share one. Null means unassigned. */
  phase: number | null;
  createdAt: string;
}

export interface CreateMilestoneInput {
  projectId: string;
  title: string;
  ownerId: string;
  startDate: string;
  endDate: string;
  progress: number;
  /** Omit to open a new last phase. */
  phase?: number | null;
}

export interface UpdateMilestoneInput {
  title?: string;
  ownerId?: string;
  startDate?: string;
  endDate?: string;
  progress?: number;
  phase?: number | null;
}
