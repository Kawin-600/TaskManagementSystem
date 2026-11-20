import { useState } from 'react';
import { Trash2 } from 'lucide-react';
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

  if (!currentUser) return null;
  const todayStr = getTodayStr();

  const handleConfirmDelete = async () => {
    if (!deletingTask) return;
    await deleteTask(deletingTask.id);
    setDeletingTask(null);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">ชื่องาน</th>
              <th className="px-4 py-3">ผู้รับผิดชอบ</th>
              <th className="px-4 py-3">วันเริ่มต้น - กำหนดส่ง</th>
              <th className="px-4 py-3">ระยะเวลา</th>
              <th className="px-4 py-3">ความสำคัญ</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3 text-right">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  ยังไม่มีงานในโปรเจคนี้
                </td>
              </tr>
            ) : (
              tasks.map((task) => {
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
                    <td
                      className={`px-4 py-3 font-semibold ${
                        overdue ? 'text-rose-600' : 'text-slate-800'
                      }`}
                    >
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
