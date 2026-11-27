import { participatesInTask } from '../domain/rbac';
import { canCreateTask } from '../domain/rbac';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Plus, Filter } from 'lucide-react';
import {
  calculateDaysBetween,
  formatThaiDateShort,
  getTodayStr,
  isTaskOverdue,
} from '../domain/dates';
import { useAuth } from '../state/AuthContext';
import { useWorkspace } from '../state/WorkspaceContext';
import type { TaskPriority, TaskStatus } from '../types/models';
import { PriorityBadge, StatusBadge } from '../components/ui/Badges';

type MyTasksFilter = 'all' | TaskStatus | 'overdue';

interface MyTasksPageProps {
  onOpenTaskDetail: (taskId: string) => void;
  onOpenCreateTask: (opts?: { projectId?: string; startDate?: string }) => void;
}

const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const VALID_FILTERS: MyTasksFilter[] = [
  'all',
  'todo',
  'in_progress',
  'review',
  'completed',
  'overdue',
];

export function MyTasksPage({ onOpenTaskDetail, onOpenCreateTask }: MyTasksPageProps) {
  const { currentUser } = useAuth();
  const { visibleProjects, visibleTasks } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();

  const paramFilter = searchParams.get('filter') as MyTasksFilter | null;
  const statusFilter: MyTasksFilter =
    paramFilter && VALID_FILTERS.includes(paramFilter) ? paramFilter : 'all';

  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority'>('dueDate');

  const todayStr = getTodayStr();
  const myTasks = useMemo(
    () => (currentUser ? visibleTasks.filter((t) => participatesInTask(t, currentUser.id)) : []),
    [currentUser, visibleTasks],
  );

  const filteredTasks = useMemo(() => {
    return myTasks
      .filter((t) => {
        if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;
        if (statusFilter === 'overdue') return isTaskOverdue(t, todayStr);
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'priority') {
          const diff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
          if (diff !== 0) return diff;
        }
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [myTasks, projectFilter, statusFilter, sortBy, todayStr]);

  const groupedTasks = useMemo(() => {
    const groups = new Map<string, typeof filteredTasks>();
    for (const task of filteredTasks) {
      const key = JSON.stringify([task.projectId, (task.module?.trim() || '').toLocaleLowerCase()]);
      const group = groups.get(key) ?? [];
      group.push(task);
      groups.set(key, group);
    }
    return [...groups.entries()];
  }, [filteredTasks]);

  if (!currentUser) return null;

  const handleFilterClick = (next: MyTasksFilter) => {
    if (next === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ filter: next });
    }
  };

  const tabs: Array<{ id: MyTasksFilter; label: string; count: number }> = [
    { id: 'all', label: 'ทั้งหมด', count: myTasks.length },
    { id: 'todo', label: 'รอดำเนินการ', count: myTasks.filter((t) => t.status === 'todo').length },
    {
      id: 'in_progress',
      label: 'กำลังทำ',
      count: myTasks.filter((t) => t.status === 'in_progress').length,
    },
    { id: 'review', label: 'รอตรวจสอบ', count: myTasks.filter((t) => t.status === 'review').length },
    {
      id: 'completed',
      label: 'เสร็จสิ้น',
      count: myTasks.filter((t) => t.status === 'completed').length,
    },
    {
      id: 'overdue',
      label: 'เลยกำหนด',
      count: myTasks.filter((t) => isTaskOverdue(t, todayStr)).length,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Filter Controls Card */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleFilterClick(tab.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === tab.id
                    ? tab.id === 'overdue'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {canCreateTask(currentUser) && (
            <button
              type="button"
              disabled={visibleProjects.length === 0}
              onClick={() => onOpenCreateTask()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>เพิ่มงานใหม่</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-xs">
          <span className="flex items-center gap-1 font-semibold text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            กรองเพิ่มเติม:
          </span>

          <select
            aria-label="กรองตามโปรเจค"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700"
          >
            <option value="all">ทุกโปรเจคของฉัน</option>
            {visibleProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            aria-label="เรียงลำดับ"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'dueDate' | 'priority')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700"
          >
            <option value="dueDate">เรียงตามวันกำหนดส่ง</option>
            <option value="priority">เรียงตามความสำคัญ</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {filteredTasks.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            ไม่มีงานที่ตรงกับตัวกรองที่เลือก
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {groupedTasks.map(([key, group]) => (
              <section key={key}>
                <div className="flex flex-wrap items-center gap-2 bg-indigo-50 px-5 py-2.5 text-xs font-semibold text-indigo-900">
                  <span>{group[0].module?.trim() || 'ไม่ได้ระบุ Module'}</span>
                  <span className="font-normal text-indigo-600">{visibleProjects.find((p) => p.id === group[0].projectId)?.name ?? '-'} · {group.length} งาน</span>
                </div>
                <div className="divide-y divide-slate-100">
            {group.map((task) => {
              const prj = visibleProjects.find((p) => p.id === task.projectId);
              const overdue = isTaskOverdue(task, todayStr);
              const days = calculateDaysBetween(task.startDate, task.dueDate);

              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onOpenTaskDetail(task.id)}
                  className="flex w-full flex-col justify-between gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: prj?.color ?? '#4f46e5' }}
                      />
                      <span
                        className={`min-w-0 break-words text-sm font-semibold leading-relaxed ${
                          overdue ? 'text-rose-600' : 'text-slate-800'
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pl-4 text-xs text-slate-400">
                      <span>{prj?.name ?? '-'}</span>
                      {task.feature?.trim() && task.feature.trim() !== task.title.trim() && <span>Feature: {task.feature}</span>}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatThaiDateShort(task.startDate)} - {formatThaiDateShort(task.dueDate)} (
                        {days} วัน)
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 pl-4 sm:pl-0">
                    {overdue && (
                      <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        เลยกำหนด
                      </span>
                    )}
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={task.status} />
                  </div>
                </button>
              );
            })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
