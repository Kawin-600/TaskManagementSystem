import { useState, type DragEvent } from 'react';
import { Calendar, GripVertical } from 'lucide-react';
import { canEditTask, getAssignableMembers } from '../../domain/rbac';
import { formatThaiDateShort, getTodayStr, isTaskOverdue } from '../../domain/dates';
import { useAuth } from '../../state/AuthContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import type { Project, Task } from '../../types/models';
import { AvatarCircle, PriorityBadge, StatusBadge } from '../ui/Badges';

interface AssignTasksBoardProps {
  project: Project;
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
}

export function AssignTasksBoard({ project, tasks, onTaskClick }: AssignTasksBoardProps) {
  const { currentUser } = useAuth();
  const { users, updateTask } = useWorkspace();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverMemberId, setDragOverMemberId] = useState<string | null>(null);
  const todayStr = getTodayStr();

  if (
    !currentUser ||
    (currentUser.role !== 'admin' &&
      currentUser.role !== 'supervisor' &&
      currentUser.role !== 'executive')
  ) {
    return null;
  }

  const members = getAssignableMembers(currentUser, project, users);
  const handleDrop = async (e: DragEvent<HTMLElement>, memberId: string) => {
    e.preventDefault();
    setDragOverMemberId(null);
    const taskId = draggedTaskId || e.dataTransfer?.getData('text/plain');
    setDraggedTaskId(null);
    if (!taskId) return;

    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.assigneeId === memberId || !canEditTask(currentUser, task, project)) return;
    await updateTask(task.id, { assigneeId: memberId });
  };

  const unassignedTasks = tasks.filter((task) => !task.assigneeId);
  const renderTaskCard = (task: Task) => {
    const draggable = canEditTask(currentUser, task, project);
    const overdue = isTaskOverdue(task, todayStr);
    return (
      <article
        key={task.id}
        data-testid={`assign-card-${task.id}`}
        draggable={draggable}
        onDragStart={(e) => {
          if (!draggable) {
            e.preventDefault();
            return;
          }
          setDraggedTaskId(task.id);
          e.dataTransfer?.setData('text/plain', task.id);
        }}
        onDragEnd={() => {
          setDraggedTaskId(null);
          setDragOverMemberId(null);
        }}
        onClick={() => onTaskClick(task.id)}
        className={`group cursor-pointer space-y-2.5 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm transition hover:border-indigo-200 hover:shadow-md ${
          draggable ? 'cursor-grab active:cursor-grabbing' : ''
        } ${draggedTaskId === task.id ? 'opacity-50' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-1.5">
            {draggable && <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />}
            <h3 className="text-sm font-semibold leading-snug text-slate-800 group-hover:text-indigo-600">
              {task.title}
            </h3>
          </div>
          <PriorityBadge priority={task.priority} />
        </div>

        {task.description && (
          <p className="line-clamp-2 text-xs text-slate-500">{task.description}</p>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
          <span
            className={`flex items-center gap-1 text-xs ${
              overdue ? 'font-bold text-rose-600' : 'text-slate-400'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            {formatThaiDateShort(task.dueDate)}
          </span>
          <StatusBadge status={task.status} />
        </div>
      </article>
    );
  };

  return (
    <div className="flex items-start gap-4 overflow-x-auto pb-3">
      <section
        data-testid="assign-column-unassigned"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverMemberId('');
        }}
        onDragLeave={() => setDragOverMemberId(null)}
        onDrop={(e) => void handleDrop(e, '')}
        className={`flex min-h-[460px] w-80 shrink-0 flex-col rounded-2xl border p-3.5 transition ${
          dragOverMemberId === ''
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-dashed border-slate-300 bg-slate-100/80'
        }`}
      >
        <div className="mb-3 flex items-center justify-between border-b border-slate-200/80 pb-2.5">
          <h2 className="truncate text-sm font-bold text-slate-700">ยังไม่มอบหมาย</h2>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-slate-600">
            {unassignedTasks.length}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2.5">
          {unassignedTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300/70 py-8 text-center text-xs text-slate-400">
              งานใหม่ที่ยังไม่มีผู้รับผิดชอบจะแสดงที่นี่
            </div>
          ) : (
            unassignedTasks.map(renderTaskCard)
          )}
        </div>
      </section>

      {members.map((member) => {
        const memberTasks = tasks.filter((task) => task.assigneeId === member.id);
        const isOver = dragOverMemberId === member.id;

        return (
          <section
            key={member.id}
            data-testid={`assign-column-${member.id}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverMemberId(member.id);
            }}
            onDragLeave={() => setDragOverMemberId(null)}
            onDrop={(e) => void handleDrop(e, member.id)}
            className={`flex min-h-[460px] w-80 shrink-0 flex-col rounded-2xl border p-3.5 transition ${
              isOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-100/80'
            }`}
          >
            <div className="mb-3 flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <AvatarCircle avatar={member.avatar} color={member.color} size="sm" />
                <h2 className="truncate text-sm font-bold text-slate-800">{member.name}</h2>
              </div>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-slate-600">
                {memberTasks.length}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-2.5">
              {memberTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300/70 py-8 text-center text-xs text-slate-400">
                  ลากงานมามอบหมายให้ {member.name}
                </div>
              ) : (
                  memberTasks.map(renderTaskCard)
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
