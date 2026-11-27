import type { Project, Task, User } from '../types/models';

const EXPORT_HEADERS = ['ประเภท', 'Module', 'Feature', 'Task', 'Owner', 'Status', 'Start', 'End', 'เพิ่มเติม'] as const;

export type ProjectExportRow = Record<(typeof EXPORT_HEADERS)[number], string>;

const STATUS_LABELS: Record<Task['status'], string> = {
  todo: 'Todo',
  in_progress: 'Doing',
  review: 'Review',
  completed: 'Done',
};

export function buildProjectExportRows(
  projects: Project[],
  tasks: Task[],
  users: User[],
): ProjectExportRow[] {
  const userNames = new Map(users.map((user) => [user.id, user.name]));
  return projects.flatMap((project) => {
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    if (projectTasks.length === 0) {
      return [{
        ประเภท: project.name,
        Module: '',
        Feature: '',
        Task: '',
        Owner: userNames.get(project.supervisorId) ?? '',
        Status: '',
        Start: '',
        End: '',
        เพิ่มเติม: project.description,
      }];
    }
    return projectTasks.map((task) => ({
      ประเภท: project.name,
      Module: task.module ?? '',
      Feature: task.feature ?? '',
      Task: task.title,
      Owner: userNames.get(task.assigneeId) ?? '',
      Status: STATUS_LABELS[task.status],
      Start: task.startDate,
      End: task.dueDate,
      เพิ่มเติม: task.description,
    }));
  });
}

export async function exportProjectsToExcel(
  projects: Project[],
  tasks: Task[],
  users: User[],
  fileName: string,
): Promise<void> {
  const XLSX = await import('xlsx');
  const rows = buildProjectExportRows(projects, tasks, users);
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...EXPORT_HEADERS] });
  worksheet['!cols'] = [
    { wch: 32 },
    { wch: 28 },
    { wch: 18 },
    { wch: 55 },
    { wch: 22 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 40 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Task-Work');
  XLSX.writeFile(workbook, fileName, { compression: true });
}
