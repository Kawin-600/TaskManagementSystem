import { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  GanttChart,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import {
  getMonthYearStr,
  getThaiMonthYearString,
  getTodayStr,
  shiftMonth,
} from '../domain/dates';
import { useAuth } from '../state/AuthContext';
import { useWorkspace } from '../state/WorkspaceContext';
import { CalendarBoard } from '../components/schedule/CalendarBoard';
import {
  TimelineGantt,
  type TimelineColorMode,
  type TimelineZoom,
} from '../components/schedule/TimelineGantt';

interface GlobalSchedulePageProps {
  onOpenCreateTask: (opts?: { projectId?: string; startDate?: string }) => void;
  onOpenTaskDetail: (taskId: string) => void;
}

export function GlobalSchedulePage({
  onOpenCreateTask,
  onOpenTaskDetail,
}: GlobalSchedulePageProps) {
  const { currentUser } = useAuth();
  const { visibleProjects, visibleTasks, visibleTeamUsers, users } = useWorkspace();

  const todayStr = getTodayStr();
  const [mode, setMode] = useState<'calendar' | 'timeline'>('calendar');
  const [yearMonth, setYearMonth] = useState<string>(getMonthYearStr(todayStr));
  const [zoom, setZoom] = useState<TimelineZoom>('normal');
  const [colorMode, setColorMode] = useState<TimelineColorMode>('project');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  const filteredTasks = useMemo(() => {
    return visibleTasks.filter((t) => {
      if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (assigneeFilter !== 'all' && t.assigneeId !== assigneeFilter) return false;
      return true;
    });
  }, [visibleTasks, projectFilter, statusFilter, assigneeFilter]);

  if (!currentUser) return null;

  return (
    <div className="space-y-5">
      {/* Controls & Filters */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode('calendar')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                mode === 'calendar'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>มุมมองปฏิทิน (Calendar)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('timeline')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                mode === 'timeline'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GanttChart className="h-3.5 w-3.5" />
              <span>มุมมองไทม์ไลน์ (Gantt Chart)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="เดือนก่อนหน้า"
              onClick={() => setYearMonth((m) => shiftMonth(m, -1))}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[136px] text-center text-sm font-bold text-slate-800">
              {getThaiMonthYearString(yearMonth)}
            </span>
            <button
              type="button"
              aria-label="เดือนถัดไป"
              onClick={() => setYearMonth((m) => shiftMonth(m, 1))}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setYearMonth(getMonthYearStr(todayStr))}
              className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              เดือนนี้
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-xs">
          <span className="flex items-center gap-1 font-semibold text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            ตัวกรอง:
          </span>

          <select
            aria-label="กรองโปรเจค"
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
            aria-label="กรองสถานะ"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="todo">รอดำเนินการ</option>
            <option value="in_progress">กำลังทำ</option>
            <option value="review">รอตรวจสอบ</option>
            <option value="completed">เสร็จสิ้น</option>
          </select>

          <select
            aria-label="กรองผู้รับผิดชอบ"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700"
          >
            <option value="all">ทุกคนในทีม</option>
            {visibleTeamUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Shared Calendar or Gantt Component */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {mode === 'calendar' ? (
          <CalendarBoard
            yearMonth={yearMonth}
            todayStr={todayStr}
            tasks={filteredTasks}
            projects={visibleProjects}
            canAddTaskOnDate={visibleProjects.length > 0}
            onTaskClick={onOpenTaskDetail}
            onAddTaskOnDate={(dateStr) =>
              onOpenCreateTask({
                projectId: projectFilter !== 'all' ? projectFilter : undefined,
                startDate: dateStr,
              })
            }
          />
        ) : (
          <TimelineGantt
            yearMonth={yearMonth}
            todayStr={todayStr}
            tasks={filteredTasks}
            projects={visibleProjects}
            users={users}
            zoom={zoom}
            colorMode={colorMode}
            onZoomChange={setZoom}
            onColorModeChange={setColorMode}
            onTaskClick={onOpenTaskDetail}
          />
        )}
      </div>
    </div>
  );
}
