import { useMemo, useState } from 'react';
import { Search, Trash2, X } from 'lucide-react';
import {
  calculateDaysBetween,
  formatThaiDateShort,
  getTodayStr,
  isTaskOverdue,
} from '../../domain/dates';
import { canDeleteTask } from '../../domain/rbac';
import { useAuth } from '../../state/AuthContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import type { Project, Task } from '../../types/models';
import { AvatarCircle, PriorityBadge, StatusBadge } from '../ui/Badges';
import { Modal } from '../ui/Modal';

interface TaskListTableProps {
  project: Project;
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
}

export function TaskListTable({ project, tasks, onTaskClick }: TaskListTableProps) {
  const { currentUser } = useAuth();
  const { users, visibleMilestones, deleteTask } = useWorkspace();
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return tasks;
    return tasks.filter((task) => {
      const assignee = users.find((user) => user.id === task.assigneeId);
      const milestone = visibleMilestones.find((item) => item.id === task.milestoneId);
      return [task.title, task.module, task.feature, task.description, assignee?.name, milestone?.title]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(query));
    });
  }, [searchQuery, tasks, users, visibleMilestones]);

  const groupedTasks = useMemo(() => {
    const groups = new Map<string, Task[]>();
    filteredTasks.forEach((task) => {
      const key = (task.module?.trim() || '').toLocaleLowerCase();
      const group = groups.get(key) ?? [];
      group.push(task);
      groups.set(key, group);
    });
    return Array.from(groups.values()).flatMap((group) =>
      group.map((task, index) => ({ task, first: index === 0, count: group.length })),
    );
  }, [filteredTasks]);

  if (!currentUser) return null;
  const todayStr = getTodayStr();

  const handleConfirmDelete = async () => {
    if (!deletingTask) return;
    await deleteTask(deletingTask.id);
    setDeletingTask(null);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-800">รายการงาน</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            แสดง {filteredTasks.length} จาก {tasks.length} งาน
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="ค้นหางาน, Feature, รายละเอียด, ผู้รับผิดชอบ..."
            aria-label="ค้นหารายการงาน"
            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-9 text-xs text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="ล้างคำค้นหา"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3">Feature</th>
              <th className="px-4 py-3">ผู้รับผิดชอบ</th>
              <th className="px-4 py-3">วันเริ่มต้น - กำหนดส่ง</th>
              <th className="px-4 py-3">ระยะเวลา</th>
              <th className="px-4 py-3">ความสำคัญ</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3 text-right">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  {tasks.length === 0 ? 'ยังไม่มีงานในโปรเจคนี้' : `ไม่พบงานที่ตรงกับ “${searchQuery.trim()}”`}
                </td>
              </tr>
            ) : (
              groupedTasks.map(({ task, first, count }) => {
                const assignee = users.find((u) => u.id === task.assigneeId);
                const milestone = visibleMilestones.find(
                  (item) => item.id === task.milestoneId && item.projectId === task.projectId,
                );
                const totalDays = calculateDaysBetween(task.startDate, task.dueDate);
                const overdue = isTaskOverdue(task, todayStr);
                const deletable = canDeleteTask(currentUser, task, project);

                return (
                  <tr
                    key={task.id}
                    onClick={() => onTaskClick(task.id)}
                    className="cursor-pointer transition hover:bg-slate-50"
                  >
                    {first && <td
                      rowSpan={count}
                      className="px-4 py-3 align-top font-semibold text-slate-800"
                    >
                      <span>{task.module?.trim() || 'ไม่ได้ระบุ Module'}</span>
                      <span className="mt-1 block text-[10px] font-medium text-slate-400">{count} งาน</span>
                    </td>}
                    <td className={`px-4 py-3 font-semibold ${overdue ? 'text-rose-600' : 'text-slate-800'}`}>
                      <div className="flex items-center gap-2">
                        <span>{task.title}</span>
                        {overdue && (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                            เลยกำหนด
                          </span>
                        )}
                      </div>
                      {milestone && (
                        <span className="mt-1 inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                          Milestone: {milestone.title}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {task.feature?.trim() ? (
                        <span className="inline-block rounded-lg bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700">
                          {task.feature.trim()}
                        </span>
                      ) : (
                        <span className="text-slate-400">ไม่ได้ระบุ</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <AvatarCircle
                          avatar={assignee?.avatar ?? '?'}
                          color={assignee?.color}
                          size="sm"
                        />
                        <span className="font-medium text-slate-700">{assignee?.name ?? '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatThaiDateShort(task.startDate)} - {formatThaiDateShort(task.dueDate)}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-slate-700">
                      {totalDays} วัน
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={task.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={task.status} />
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {deletable && (
                        <button
                          type="button"
                          title="ลบงาน"
                          aria-label={`ลบงาน ${task.title}`}
                          onClick={() => setDeletingTask(task)}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={Boolean(deletingTask)}
        onClose={() => setDeletingTask(null)}
        title="ยืนยันการลบงาน"
        size="md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            คุณต้องการลบงาน <strong className="text-slate-900">{deletingTask?.title}</strong>{' '}
            พร้อมความคิดเห็นทั้งหมดอย่างถาวรใช่หรือไม่?
            {deletingTask?.milestoneId && (
              <span> Milestone ที่เชื่อมอยู่จะถูกลบไปพร้อมกัน</span>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletingTask(null)}
              className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700"
            >
              ยืนยันลบงาน
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
