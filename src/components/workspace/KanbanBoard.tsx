import { useState, type DragEvent } from 'react';
import {
  CircleDot,
  Loader2,
  Clock,
  CheckCircle2,
  Calendar,
  MessageSquare,
  Check,
  RotateCcw,
  Lock,
} from 'lucide-react';
import { formatThaiDateShort, getTodayStr, isTaskOverdue } from '../../domain/dates';
import { canApproveOrRejectTask, canEditTask } from '../../domain/rbac';
import { useAuth } from '../../state/AuthContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import type { Project, Task, TaskStatus } from '../../types/models';
import { AvatarCircle, PriorityBadge } from '../ui/Badges';
import { TaskModuleGroups } from './TaskModuleGroups';

interface KanbanBoardProps {
  project: Project;
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
}

const COLUMNS: Array<{
  id: TaskStatus;
  title: string;
  Icon: typeof CircleDot;
  iconColor: string;
  badgeStyle: string;
}> = [
  {
    id: 'todo',
    title: 'รอดำเนินการ',
    Icon: CircleDot,
    iconColor: 'text-slate-500',
    badgeStyle: 'bg-slate-200 text-slate-700',
  },
  {
    id: 'in_progress',
    title: 'กำลังทำ',
    Icon: Loader2,
    iconColor: 'text-indigo-500',
    badgeStyle: 'bg-indigo-100 text-indigo-700',
  },
  {
    id: 'review',
    title: 'รอตรวจสอบ',
    Icon: Clock,
    iconColor: 'text-amber-500',
    badgeStyle: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'completed',
    title: 'เสร็จสิ้น',
    Icon: CheckCircle2,
    iconColor: 'text-emerald-500',
    badgeStyle: 'bg-emerald-100 text-emerald-700',
  },
];

export function KanbanBoard({ project, tasks, onTaskClick }: KanbanBoardProps) {
  const { currentUser } = useAuth();
  const { users, moveTaskStatus, approveTask } = useWorkspace();
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  if (!currentUser) return null;
  const todayStr = getTodayStr();

  const handleDragStart = (e: DragEvent<HTMLDivElement>, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer?.setData('text/plain', taskId);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, status: TaskStatus) => {
    if (currentUser.role === 'executive') return;
    e.preventDefault();
    setDragOverCol(status);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>, newStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const id = draggedTaskId || e.dataTransfer?.getData('text/plain');
    setDraggedTaskId(null);
    if (!id || currentUser.role === 'executive') return;
    if (tasks.find((task) => task.id === id)?.status === 'review' && newStatus === 'in_progress') {
      onTaskClick(id);
      return;
    }
    await moveTaskStatus(id, newStatus);
  };

  return (
    <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map(({ id, title, Icon, iconColor, badgeStyle }) => {
        const colTasks = tasks.filter((t) => t.status === id);
        const isOver = dragOverCol === id;

        return (
          <div
            key={id}
            data-testid={`kanban-col-${id}`}
            onDragOver={(e) => handleDragOver(e, id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, id)}
            className={`kanban-col flex min-h-[460px] min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-slate-100/80 p-3.5 transition ${
              isOver ? 'drag-over' : ''
            }`}
          >
            <div className="mb-3 flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <Icon className={`h-4 w-4 ${iconColor}`} />
                <span>{title}</span>
              </div>
              <span
                className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-bold ${badgeStyle}`}
              >
                {colTasks.length}
              </span>
            </div>

            <div className="flex-1 space-y-2.5">
              {colTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300/70 py-8 text-center text-xs text-slate-400">
                  ไม่มีงานในสถานะนี้
                </div>
              ) : (
                <TaskModuleGroups tasks={colTasks} progressTasks={tasks} renderTask={(task) => {
                  const assignee = users.find((u) => u.id === task.assigneeId);
                  const overdue = isTaskOverdue(task, todayStr);
                  const draggable = currentUser.role !== 'executive' && canEditTask(currentUser, task, project);
                  const showApproveControls = canApproveOrRejectTask(currentUser, task, project);
                  const lockedForStaff = currentUser.role === 'staff' && task.status === 'completed';

                  return (
                    <div
                      key={task.id}
                      data-testid={`kanban-card-${task.id}`}
                      draggable={draggable}
                      onDragStart={(e) => {
                        if (!draggable) {
                          e.preventDefault();
                          return;
                        }
                        handleDragStart(e, task.id);
                      }}
                      onDragEnd={() => { setDraggedTaskId(null); setDragOverCol(null); }}
                      onClick={() => onTaskClick(task.id)}
                      className={`group space-y-2.5 bg-white p-3.5 transition hover:bg-slate-50 ${
                        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                      }`}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <h5 className="min-w-0 flex-1 break-words text-sm font-semibold leading-relaxed text-slate-800 group-hover:text-indigo-600">
                          {task.title}
                        </h5>
                        <span className="shrink-0"><PriorityBadge priority={task.priority} /></span>
                      </div>

                      {(task.module?.trim() || task.feature?.trim()) && (
                        <div className="space-y-1 text-xs leading-relaxed text-slate-600">
                          {task.feature?.trim() && task.feature.trim() !== task.title.trim() && <p className="break-words"><span className="text-slate-400">Feature: </span>{task.feature}</p>}
                        </div>
                      )}

                      {task.description && (
                        <p className="line-clamp-2 break-words text-xs leading-relaxed text-slate-500">{task.description}</p>
                      )}

                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span
                          className={`flex items-center gap-1 ${
                            overdue ? 'font-bold text-rose-600' : ''
                          }`}
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          {formatThaiDateShort(task.startDate)} – {formatThaiDateShort(task.dueDate)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {lockedForStaff && (
                            <span
                              title="งานที่อนุมัติแล้วถูกล็อกสำหรับเจ้าหน้าที่"
                              className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700"
                            >
                              <Lock className="h-2.5 w-2.5" />
                              ล็อก
                            </span>
                          )}
                          {overdue && (
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                              เลยกำหนด
                            </span>
                          )}
                        </div>
                      </div>

                      {showApproveControls && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 border-t border-slate-100 pt-2"
                        >
                          <button
                            type="button"
                            onClick={() => approveTask(task.id)}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>อนุมัติ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onTaskClick(task.id)}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-rose-600 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>ส่งแก้ไข</span>
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <AvatarCircle
                            avatar={assignee?.avatar ?? '?'}
                            color={assignee?.color}
                            size="xs"
                          />
                          <span className="text-[11px] font-medium">
                            {assignee ? assignee.name.split(' ')[0] : '-'}
                          </span>
                        </div>
                        {task.comments.length > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-slate-400">
                            <MessageSquare className="h-3 w-3" />
                            {task.comments.length}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
