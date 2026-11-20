export const ENABLE_DEMO_AUTH = true;

export const PROJECT_COLORS = [
  '#4f46e5',
  '#10b981',
  '#f43f5e',
  '#8b5cf6',
  '#06b6d4',
  '#f59e0b',
] as const;

export const STORAGE_KEYS = {
  users: 'taskflow_v2_users',
  projects: 'taskflow_v2_projects',
  tasks: 'taskflow_v2_tasks',
  milestones: 'taskflow_v2_milestones',
  session: 'taskflow_v2_session',
} as const;
