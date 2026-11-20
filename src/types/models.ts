export type UserRole = 'admin' | 'supervisor' | 'staff';
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
