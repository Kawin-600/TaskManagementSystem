import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { calculateDaysBetween, formatThaiDateShort, isTaskOverdue } from '../../domain/dates';
import { buildCalendarWeeks, packWeekLanes } from '../../domain/scheduleLayout';
import type { Project, Task } from '../../types/models';
import { StatusBadge } from '../ui/Badges';
import { Modal } from '../ui/Modal';

interface CalendarBoardProps {
  yearMonth: string;
  todayStr: string;
  tasks: Task[];
  projects: Project[];
  canAddTaskOnDate: boolean;
  onTaskClick: (taskId: string) => void;
  onAddTaskOnDate: (dateStr: string) => void;
}

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'] as const;
const MAX_VISIBLE_LANES = 3;

export function CalendarBoard({
  yearMonth,
  todayStr,
  tasks,
  projects,
  canAddTaskOnDate,
  onTaskClick,
  onAddTaskOnDate,
}: CalendarBoardProps) {
  const [overflowWeek, setOverflowWeek] = useState<{ label: string; tasks: Task[] } | null>(null);

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const weekRows = useMemo(() => {
    const weeks = buildCalendarWeeks(yearMonth, todayStr);
    return weeks.map((days) => ({
      days,
      lanes: packWeekLanes(days, tasks),
    }));
  }, [yearMonth, todayStr, tasks]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px] select-none overflow-hidden rounded-xl border border-slate-200 bg-white">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 py-2.5 text-center text-xs font-bold text-slate-600">
          {THAI_DAYS.map((dayName, idx) => (
            <div key={dayName} className={idx === 0 || idx === 6 ? 'text-rose-500' : ''}>
              {dayName}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="divide-y divide-slate-200">
          {weekRows.map(({ days, lanes }, weekIdx) => {
            const visibleLanes = lanes.slice(0, MAX_VISIBLE_LANES);
            const hiddenBarsCount = lanes
              .slice(MAX_VISIBLE_LANES)
              .reduce((sum, lane) => sum + lane.length, 0);
            const weekTasks = lanes.flat().map((b) => b.task);

            return (
              <div key={weekIdx} className="relative min-h-[124px] bg-white">
                {/* Date Cells Background */}
                <div className="pointer-events-none absolute inset-0 grid grid-cols-7 divide-x divide-slate-100">
                  {days.map((day) => (
                    <div
                      key={day.dateStr}
                      className={`p-1.5 ${
                        !day.isCurrentMonth
                          ? 'bg-slate-50/80 opacity-45'
                          : day.isWeekend
                            ? 'bg-slate-50/40'
                            : ''
                      }`}
                    >
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                          day.isToday
                            ? 'bg-indigo-600 font-bold text-white ring-4 ring-indigo-100'
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

                {/* Hover Add Buttons Layer */}
                {canAddTaskOnDate && (
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-7">
                    {days.map((day) => (
                      <div key={day.dateStr} className="group pointer-events-auto relative p-1">
                        <button
                          type="button"
                          title={`เพิ่มงานวันที่ ${day.dateStr}`}
                          onClick={() => onAddTaskOnDate(day.dateStr)}
                          className="absolute bottom-1 right-1 z-10 flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 opacity-0 shadow-sm transition hover:bg-indigo-600 hover:text-white group-hover:opacity-100"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Horizontally Packed Multi-day Lanes */}
                <div className="pointer-events-none relative z-20 space-y-1 px-0.5 pb-2 pt-8">
                  {visibleLanes.map((lane, laneIdx) => (
                    <div
                      key={laneIdx}
                      data-testid="calendar-lane"
                      className="grid grid-cols-7 gap-x-0.5"
                    >
                      {lane.map((bar) => {
                        const prj = projectMap.get(bar.task.projectId);
                        const barColor = prj?.color ?? '#4f46e5';
                        const overdue = isTaskOverdue(bar.task, todayStr);
                        const totalDays = calculateDaysBetween(bar.task.startDate, bar.task.dueDate);

                        return (
                          <div
                            key={bar.task.id}
                            style={{
                              gridColumn: `${bar.startCol + 1} / span ${bar.spanCols}`,
                            }}
                            className="pointer-events-auto px-0.5"
                          >
                            <button
                              type="button"
                              onClick={() => onTaskClick(bar.task.id)}
                              title={`${bar.task.title} · Feature: ${bar.task.feature?.trim() || 'ไม่ได้ระบุ'}`}
                              style={{ backgroundColor: barColor }}
                              className={`flex h-6 w-full items-center justify-between overflow-hidden px-2 text-left text-[11px] font-medium text-white shadow-sm transition hover:brightness-110 ${
                                bar.isStartInWeek ? 'rounded-l-lg' : 'rounded-l-none'
                              } ${bar.isEndInWeek ? 'rounded-r-lg' : 'rounded-r-none'} ${
                                overdue ? 'ring-2 ring-rose-500' : ''
                              }`}
                            >
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/90" />
                                <span className="truncate">{bar.task.title}{bar.task.feature?.trim() ? ` · ${bar.task.feature.trim()}` : ''}</span>
                              </span>
                              <span className="ml-1 shrink-0 rounded bg-black/20 px-1 py-0.5 font-mono text-[9px]">
                                {totalDays}วัน
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {hiddenBarsCount > 0 && (
                    <div className="pointer-events-auto flex justify-center pt-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          setOverflowWeek({
                            label: `${formatThaiDateShort(days[0].dateStr)} - ${formatThaiDateShort(days[6].dateStr)}`,
                            tasks: weekTasks,
                          })
                        }
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        + อีก {hiddenBarsCount} งาน
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overflow Tasks Modal */}
      <Modal
        isOpen={Boolean(overflowWeek)}
        onClose={() => setOverflowWeek(null)}
        title={`งานทั้งหมดในช่วง ${overflowWeek?.label ?? ''}`}
        size="md"
      >
        <div className="divide-y divide-slate-100">
          {overflowWeek?.tasks.map((task) => {
            const prj = projectMap.get(task.projectId);
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => {
                  setOverflowWeek(null);
                  onTaskClick(task.id);
                }}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: prj?.color ?? '#4f46e5' }}
                    />
                    <span className="truncate text-xs font-semibold text-slate-800">
                      {task.title}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate pl-4 text-[11px] font-semibold text-indigo-700">
                    Feature: {task.feature?.trim() || 'ไม่ได้ระบุ'}
                  </p>
                  <p className="mt-0.5 pl-4 text-[11px] text-slate-400">
                    {formatThaiDateShort(task.startDate)} - {formatThaiDateShort(task.dueDate)} (
                    {calculateDaysBetween(task.startDate, task.dueDate)} วัน)
                  </p>
                </div>
                <StatusBadge status={task.status} />
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
