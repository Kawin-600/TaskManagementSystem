import { Fragment, useMemo } from 'react';
import { ZoomIn } from 'lucide-react';
import { calculateDaysBetween, isTaskOverdue } from '../../domain/dates';
import { buildGanttDays, computeGanttBarBounds } from '../../domain/scheduleLayout';
import type { Project, Task, TaskStatus, User } from '../../types/models';
import { AvatarCircle } from '../ui/Badges';

export type TimelineZoom = 'compact' | 'normal' | 'wide';
export type TimelineColorMode = 'project' | 'status';

interface TimelineGanttProps {
  yearMonth: string;
  todayStr: string;
  tasks: Task[];
  projects: Project[];
  users: User[];
  zoom: TimelineZoom;
  colorMode: TimelineColorMode;
  onZoomChange: (zoom: TimelineZoom) => void;
  onColorModeChange: (mode: TimelineColorMode) => void;
  onTaskClick: (taskId: string) => void;
}

const ZOOM_WIDTHS: Record<TimelineZoom, number> = {
  compact: 36,
  normal: 46,
  wide: 60,
};

const STATUS_BAR_COLORS: Record<TaskStatus, string> = {
  todo: '#64748b',
  in_progress: '#4f46e5',
  review: '#f59e0b',
  completed: '#10b981',
};

export function TimelineGantt({
  yearMonth,
  todayStr,
  tasks,
  projects,
  users,
  zoom,
  colorMode,
  onZoomChange,
  onColorModeChange,
  onTaskClick,
}: TimelineGanttProps) {
  const colWidth = ZOOM_WIDTHS[zoom];
  const dayColumns = useMemo(() => buildGanttDays(yearMonth, todayStr), [yearMonth, todayStr]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const orderedTasks = useMemo(() => {
    const groups = new Map<string, Task[]>();
    tasks.forEach((task) => {
      const key = JSON.stringify([task.projectId, (task.module?.trim() || '').toLocaleLowerCase()]);
      groups.set(key, [...(groups.get(key) ?? []), task]);
    });
    return [...groups.values()].flatMap((group) => group.map((task, index) => ({ task, first: index === 0, count: group.length })));
  }, [tasks]);

  const todayIdx = dayColumns.findIndex((d) => d.isToday);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 font-semibold text-slate-600">
            <ZoomIn className="h-3.5 w-3.5" />
            ขนาดตาราง:
          </span>
          {(
            [
              { id: 'compact', label: 'กะทัดรัด' },
              { id: 'normal', label: 'ปกติ' },
              { id: 'wide', label: 'กว้าง' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onZoomChange(item.id)}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                zoom === item.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            <span className="px-1.5 text-[11px] font-semibold text-slate-500">สีแถบ:</span>
            <button
              type="button"
              onClick={() => onColorModeChange('project')}
              className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
                colorMode === 'project' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              ตามโปรเจค
            </button>
            <button
              type="button"
              onClick={() => onColorModeChange('status')}
              className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
                colorMode === 'status' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              ตามสถานะ
            </button>
          </div>

          <div className="hidden items-center gap-3 text-[11px] text-slate-500 sm:flex">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded bg-rose-500 ring-2 ring-rose-200" />
              เลยกำหนด
            </span>
            <span className="flex items-center gap-1 font-semibold text-rose-600">
              <span className="h-3.5 w-0.5 bg-rose-600" />
              เส้นวันนี้
            </span>
          </div>
        </div>
      </div>

      {/* Split Scrollable Gantt */}
      <div className="relative flex overflow-x-auto">
        {/* Sticky Left Column */}
        <div className="sticky left-0 z-20 w-60 shrink-0 border-r border-slate-200 bg-white shadow-sm md:w-72">
          <div className="flex h-12 items-center border-b border-slate-200 bg-slate-100 px-3.5 text-xs font-bold uppercase tracking-wider text-slate-700">
            รายละเอียดงาน ({tasks.length})
          </div>
          {tasks.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">ไม่มีรายการงานในช่วงนี้</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {orderedTasks.map(({ task, first, count }) => {
                const prj = projectMap.get(task.projectId);
                const assignee = userMap.get(task.assigneeId);
                const overdue = isTaskOverdue(task, todayStr);
                return (
                  <Fragment key={task.id}>
                  {first && <div className="flex h-8 items-center gap-2 bg-indigo-50 px-3 text-xs font-bold text-indigo-900"><span className="truncate">{task.module?.trim() || 'ไม่ได้ระบุ Module'}</span><span className="shrink-0 text-[10px] font-medium text-indigo-600">{count} งาน · {prj?.name}</span></div>}
                  <button
                    type="button"
                    onClick={() => onTaskClick(task.id)}
                    className="flex h-12 w-full items-center justify-between gap-2 px-3 text-left transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: prj?.color ?? '#94a3b8' }}
                        />
                        <span
                          className={`truncate text-xs font-semibold ${
                            overdue ? 'text-rose-600' : 'text-slate-800'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                      <p className="truncate pl-3.5 text-[10px] text-slate-500">{task.feature?.trim() || 'ไม่ได้ระบุ Feature'}</p>
                    </div>
                    <AvatarCircle
                      avatar={assignee?.avatar ?? '?'}
                      color={assignee?.color}
                      size="xs"
                    />
                  </button>
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Timeline Grid */}
        <div className="min-w-max flex-1">
          <div className="flex h-12 items-end border-b border-slate-200 bg-slate-100">
            {dayColumns.map((day) => (
              <div
                key={day.dateStr}
                style={{ width: `${colWidth}px` }}
                className={`flex h-full shrink-0 flex-col items-center justify-center border-r border-slate-200 ${
                  day.isToday
                    ? 'bg-indigo-100 font-bold'
                    : day.isWeekend
                      ? 'bg-slate-200/50'
                      : ''
                }`}
              >
                <span className="text-[10px] font-semibold text-slate-500">
                  {day.dayOfWeekName}
                </span>
                <span
                  className={`text-xs font-bold ${
                    day.isToday
                      ? 'text-indigo-700'
                      : day.isWeekend
                        ? 'text-rose-500'
                        : 'text-slate-700'
                  }`}
                >
                  {day.dayNum}
                </span>
              </div>
            ))}
          </div>

          <div className="relative divide-y divide-slate-100">
            {todayIdx !== -1 && (
              <div
                data-testid="gantt-today-line"
                style={{ left: `${todayIdx * colWidth + colWidth / 2}px` }}
                className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-rose-500"
              >
                <span className="absolute -left-4 top-0.5 rounded bg-rose-600 px-1 py-0.5 text-[9px] font-bold text-white shadow">
                  วันนี้
                </span>
              </div>
            )}

            {orderedTasks.map(({ task, first }) => {
              const prj = projectMap.get(task.projectId);
              const overdue = isTaskOverdue(task, todayStr);
              const bounds = computeGanttBarBounds(task, dayColumns, colWidth);
              const totalDays = calculateDaysBetween(task.startDate, task.dueDate);
              const barColor =
                colorMode === 'status'
                  ? STATUS_BAR_COLORS[task.status]
                  : prj?.color ?? '#4f46e5';

              return (
                <Fragment key={task.id}>
                {first && <div className="h-8 bg-indigo-50" />}
                <div className="relative flex h-12 items-center">
                  <div className="pointer-events-none absolute inset-0 flex">
                    {dayColumns.map((day) => (
                      <div
                        key={day.dateStr}
                        style={{ width: `${colWidth}px` }}
                        className={`h-full shrink-0 border-r border-slate-100 ${
                          day.isWeekend ? 'bg-slate-50/70' : ''
                        }`}
                      />
                    ))}
                  </div>

                  {bounds.isVisible && (
                    <button
                      type="button"
                      data-testid={`gantt-bar-${task.id}`}
                      onClick={() => onTaskClick(task.id)}
                      style={{
                        left: `${bounds.leftPx + 2}px`,
                        width: `${Math.max(bounds.widthPx - 4, 24)}px`,
                        backgroundColor: barColor,
                      }}
                      className={`absolute z-10 flex h-7 items-center justify-between overflow-hidden rounded-lg px-2.5 text-left text-[11px] font-semibold text-white shadow-sm transition hover:brightness-110 ${
                        overdue ? 'ring-2 ring-rose-500' : ''
                      }`}
                    >
                      <span className="truncate">{task.feature?.trim() || task.title}</span>
                      <span className="ml-1 shrink-0 rounded bg-black/25 px-1.5 py-0.5 font-mono text-[9px]">
                        {totalDays} วัน
                      </span>
                    </button>
                  )}
                </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
