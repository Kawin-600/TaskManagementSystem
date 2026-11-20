import { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  GanttChart,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Filter,
  ListChecks,
  Map as MapIcon,
  Plus,
} from 'lucide-react';
import {
  formatThaiDateShort,
  getMonthYearStr,
  getThaiMonthYearString,
  getTodayStr,
  shiftMonth,
} from '../domain/dates';
import { canManageMilestones } from '../domain/rbac';
import {
  MILESTONE_STATUS_LABELS,
  countMilestoneStats,
  getRoadmapRangeLabel,
} from '../domain/roadmap';
import type { Milestone } from '../types/models';
import { useAuth } from '../state/AuthContext';
import { useWorkspace } from '../state/WorkspaceContext';
import { CalendarBoard } from '../components/schedule/CalendarBoard';
import { RoadmapBoard } from '../components/schedule/RoadmapBoard';
import { RoadmapList } from '../components/schedule/RoadmapList';
import { RoadmapPhaseBoard } from '../components/schedule/RoadmapPhaseBoard';
import { RoadmapStats } from '../components/schedule/RoadmapStats';
import {
  MILESTONE_STATUS_ORDER,
  MILESTONE_STATUS_STYLES,
} from '../components/schedule/roadmapStyles';
import { MilestoneFormModal } from '../components/modals/MilestoneFormModal';
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
  const {
    visibleProjects,
    visibleTasks,
    visibleTeamUsers,
    visibleMilestones,
    users,
    updateMilestone,
    deleteMilestone,
  } = useWorkspace();

  const todayStr = getTodayStr();
  const [mode, setMode] = useState<'calendar' | 'timeline' | 'roadmap'>('calendar');
  const [roadmapView, setRoadmapView] = useState<'gantt' | 'list' | 'board'>('gantt');
  const [milestoneModal, setMilestoneModal] = useState<{
    isOpen: boolean;
    milestone: Milestone | null;
    projectId?: string;
    phase?: number;
  }>({ isOpen: false, milestone: null });
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

  const roadmapProjects = useMemo(
    () =>
      projectFilter === 'all'
        ? visibleProjects
        : visibleProjects.filter((p) => p.id === projectFilter),
    [visibleProjects, projectFilter],
  );

  const roadmapMilestones = useMemo(
    () =>
      projectFilter === 'all'
        ? visibleMilestones
        : visibleMilestones.filter((m) => m.projectId === projectFilter),
    [visibleMilestones, projectFilter],
  );

  const milestoneStats = useMemo(
    () => countMilestoneStats(roadmapMilestones, todayStr),
    [roadmapMilestones, todayStr],
  );

  if (!currentUser) return null;

  const isRoadmap = mode === 'roadmap';
  const canManageProjectMilestones = (projectId: string) => {
    const project = visibleProjects.find((p) => p.id === projectId);
    return Boolean(project && canManageMilestones(currentUser, project));
  };
  const canAddMilestone = visibleProjects.some((p) => canManageMilestones(currentUser, p));
  const openMilestoneEditor = (milestone: Milestone) => {
    if (!canManageProjectMilestones(milestone.projectId)) return;
    setMilestoneModal({ isOpen: true, milestone });
  };
  const handleDeleteMilestone = (milestone: Milestone) => {
    if (!window.confirm(`ยืนยันการลบ Milestone "${milestone.title}"?`)) return;
    void deleteMilestone(milestone.id);
  };
  const roadmapViewProps = {
    todayStr,
    projects: roadmapProjects,
    milestones: roadmapMilestones,
    users,
    canManageProject: canManageProjectMilestones,
    onMilestoneClick: openMilestoneEditor,
  };

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
            <button
              type="button"
              onClick={() => setMode('roadmap')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                isRoadmap
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span>แผนงาน (Roadmap)</span>
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
            <span
              className={`text-center text-sm font-bold text-slate-800 ${
                isRoadmap ? 'min-w-[210px]' : 'min-w-[136px]'
              }`}
            >
              {isRoadmap ? getRoadmapRangeLabel(yearMonth) : getThaiMonthYearString(yearMonth)}
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

          {!isRoadmap && (
            <>
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
            </>
          )}
        </div>
      </div>

      {isRoadmap && (
        <>
          <RoadmapStats stats={milestoneStats} />

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col items-start justify-between gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
                <button
                  type="button"
                  aria-pressed={roadmapView === 'gantt'}
                  onClick={() => setRoadmapView('gantt')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    roadmapView === 'gantt'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <GanttChart className="h-3.5 w-3.5" />
                  <span>ไทม์ไลน์ (Gantt)</span>
                </button>
                <button
                  type="button"
                  aria-pressed={roadmapView === 'list'}
                  onClick={() => setRoadmapView('list')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    roadmapView === 'list'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ListChecks className="h-3.5 w-3.5" />
                  <span>รายการเฟสงาน</span>
                </button>
                <button
                  type="button"
                  aria-pressed={roadmapView === 'board'}
                  onClick={() => setRoadmapView('board')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    roadmapView === 'board'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Columns3 className="h-3.5 w-3.5" />
                  <span>บอร์ดเฟส</span>
                </button>
              </div>

              {canAddMilestone && (
                <button
                  type="button"
                  onClick={() => setMilestoneModal({ isOpen: true, milestone: null })}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>เพิ่ม Milestone ใหม่</span>
                </button>
              )}
            </div>

            <div className="flex flex-col items-start justify-between gap-2 px-4 py-3 text-xs sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <CalendarIcon className="h-4 w-4 text-indigo-600" />
                <span>กรอบเวลาแผนงาน: {getRoadmapRangeLabel(yearMonth)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                {MILESTONE_STATUS_ORDER.map((status) => (
                  <span key={status} className="inline-flex items-center gap-1">
                    <span
                      className={`h-2 w-2 rounded-full ${MILESTONE_STATUS_STYLES[status].dot}`}
                    />
                    {MILESTONE_STATUS_LABELS[status]}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
                  <span className="h-3 border-l-2 border-dashed border-slate-400" />
                  วันนี้ ({formatThaiDateShort(todayStr)})
                </span>
              </div>
            </div>

            {roadmapMilestones.length === 0 ? (
              <p className="border-t border-slate-100 px-4 py-12 text-center text-sm text-slate-500">
                ยังไม่มี Milestone ในโปรเจคที่เลือก
              </p>
            ) : roadmapView === 'gantt' ? (
              <div className="border-t border-slate-200">
                <RoadmapBoard yearMonth={yearMonth} {...roadmapViewProps} />
              </div>
            ) : roadmapView === 'list' ? (
              <div className="border-t border-slate-200">
                <RoadmapList {...roadmapViewProps} onDelete={handleDeleteMilestone} />
              </div>
            ) : (
              <div className="border-t border-slate-200">
                <RoadmapPhaseBoard
                  {...roadmapViewProps}
                  onMovePhase={(milestone, phase) => void updateMilestone(milestone.id, { phase })}
                  onAddInPhase={(projectId, phase) =>
                    setMilestoneModal({ isOpen: true, milestone: null, projectId, phase })
                  }
                />
              </div>
            )}
          </div>

          <MilestoneFormModal
            isOpen={milestoneModal.isOpen}
            milestone={milestoneModal.milestone}
            defaultProjectId={
              milestoneModal.projectId ?? (projectFilter !== 'all' ? projectFilter : undefined)
            }
            defaultPhase={milestoneModal.phase}
            onClose={() => setMilestoneModal({ isOpen: false, milestone: null })}
          />
        </>
      )}

      {/* Shared Calendar or Gantt Component */}
      {!isRoadmap && (
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
      )}
    </div>
  );
}
