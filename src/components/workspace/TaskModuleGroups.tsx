import type { ReactNode } from 'react';
import type { Task } from '../../types/models';

export function TaskModuleGroups({ tasks, progressTasks = tasks, renderTask }: { tasks: Task[]; progressTasks?: Task[]; renderTask: (task: Task) => ReactNode }) {
  const groups = new Map<string, { name: string; tasks: Task[] }>();
  for (const task of tasks) {
    const name = task.module?.trim() || 'ไม่ได้ระบุ Module';
    const key = task.module?.trim().toLocaleLowerCase() || '';
    const group = groups.get(key) ?? { name, tasks: [] };
    group.tasks.push(task);
    groups.set(key, group);
  }
  return <div className="space-y-3">{[...groups.entries()].map(([key, group]) => {
    const moduleTasks = progressTasks.filter((task) => (task.module?.trim().toLocaleLowerCase() || '') === key);
    const completed = moduleTasks.filter((task) => task.status === 'completed').length;
    const progress = Math.round(completed * 100 / moduleTasks.length);
    return <section key={key} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-2 border-b border-slate-100 px-3.5 py-3">
        <div className="flex items-start justify-between gap-2 text-xs font-bold"><span className="min-w-0 break-words leading-relaxed text-slate-700">{group.name}</span><span className="shrink-0 text-indigo-600">{progress}%</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${progress}%` }} /></div>
        <p className="text-[10px] text-slate-400">{group.tasks.length} งานในคอลัมน์นี้ · เสร็จแล้ว {completed}/{moduleTasks.length}</p>
      </div>
      <div className="divide-y divide-slate-100">{group.tasks.map(renderTask)}</div>
    </section>;
  })}</div>;
}
