import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Kanban,
  List,
  GanttChart,
  Calendar as CalendarIcon,
  Plus,
  Users,
  Pencil,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  getMonthYearStr,
  getThaiMonthYearString,
  getTodayStr,
  shiftMonth,
} from '../domain/dates';
import { canCreateTaskInProject, canManageProject } from '../domain/rbac';
import { useAuth } from '../state/AuthContext';
import { useWorkspace } from '../state/WorkspaceContext';
import type { Project } from '../types/models';
import { AvatarCircle } from '../components/ui/Badges';
import { CalendarBoard } from '../components/schedule/CalendarBoard';
import {
  TimelineGantt,
  type TimelineColorMode,
  type TimelineZoom,
} from '../components/schedule/TimelineGantt';
import { KanbanBoard } from '../components/workspace/KanbanBoard';
import { TaskListTable } from '../components/workspace/TaskListTable';
import { AssignTasksBoard } from '../components/workspace/AssignTasksBoard';

type WorkspaceTab = 'kanban' | 'list' | 'timeline' | 'calendar' | 'assign';

interface ProjectWorkspacePageProps {
  onOpenCreateTask: (opts?: {
    projectId?: string;
    startDate?: string;
    unassigned?: boolean;
  }) => void;
  onOpenTaskDetail: (taskId: string) => void;
  onOpenEditProject: (project: Project) => void;
  onOpenMembers: (projectId: string) => void;
}

export function ProjectWorkspacePage({
  onOpenCreateTask,
  onOpenTaskDetail,
  onOpenEditProject,
  onOpenMembers,
}: ProjectWorkspacePageProps) {
  const { projectId } = useParams();
  const { currentUser } = useAuth();
  const { visibleProjects, visibleTasks, users } = useWorkspace();

  const todayStr = getTodayStr();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('kanban');
  const [yearMonth, setYearMonth] = useState<string>(getMonthYearStr(todayStr));
  const [zoom, setZoom] = useState<TimelineZoom>('normal');
  const [colorMode, setColorMode] = useState<TimelineColorMode>('project');

  const project = visibleProjects.find((p) => p.id === projectId);
  if (!currentUser || !project) return null;

  const projectTasks = visibleTasks.filter((t) => t.projectId === project.id);
  const doneCount = projectTasks.filter((t) => t.status === 'completed').length;
  const pct = projectTasks.length > 0 ? Math.round((doneCount / projectTasks.length) * 100) : 0;
  const members = users.filter(
    (u) => project.memberIds.includes(u.id) || u.id === project.supervisorId,
  );
  const manageable = canManageProject(currentUser, project);
  const canAddTask = canCreateTaskInProject(currentUser, project);

  const tabs: Array<{ id: WorkspaceTab; label: string; Icon: typeof Kanban }> = [
    { id: 'kanban', label: 'Kanban Board', Icon: Kanban },
    { id: 'list', label: 'รายการ (List)', Icon: List },
    { id: 'timeline', label: 'ไทม์ไลน์ (Timeline)', Icon: GanttChart },
    { id: 'calendar', label: 'ปฏิทิน (Calendar)', Icon: CalendarIcon },
  ];
  const canAssignTasks =
    currentUser.role === 'admin' ||
    currentUser.role === 'supervisor' ||
    currentUser.role === 'executive';
  if (canAssignTasks) {
    tabs.push({ id: 'assign', label: 'มอบหมายงาน (Assign)', Icon: Users });
  }

  return (
    <div className="space-y-5">
      {/* Compact Project Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div
          className="absolute bottom-0 left-0 top-0 w-2"
          style={{ backgroundColor: project.color }}
        />

        <div className="flex flex-col justify-between gap-4 pl-2 md:flex-row md:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-800">{project.name}</h2>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                style={{ backgroundColor: project.color }}
              >
                {pct}% เสร็จสิ้น
              </span>
            </div>
            <p className="text-xs text-slate-500">{project.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenMembers(project.id)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <div className="flex -space-x-1.5">
                {members.slice(0, 3).map((m) => (
                  <span key={m.id} className="rounded-full ring-2 ring-white">
                    <AvatarCircle avatar={m.avatar} color={m.color} size="xs" />
                  </span>
                ))}
              </div>
              <Users className="h-3.5 w-3.5 text-slate-500" />
              <span>จัดการสมาชิก ({members.length})</span>
            </button>

            {manageable && (
              <button
                type="button"
                onClick={() => onOpenEditProject(project)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>ตั้งค่า</span>
              </button>
            )}

            {canAddTask && (
              <button
                type="button"
                onClick={() =>
                  onOpenCreateTask({ projectId: project.id, unassigned: activeTab === 'assign' })
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>เพิ่มงานในโปรเจคนี้</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher + Local Month Nav */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3.5 pl-2">
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === id
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {(activeTab === 'timeline' || activeTab === 'calendar') && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="เดือนก่อนหน้า"
                onClick={() => setYearMonth((m) => shiftMonth(m, -1))}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[132px] text-center text-xs font-bold text-slate-800">
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
                className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                เดือนนี้
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'kanban' && (
        <KanbanBoard project={project} tasks={projectTasks} onTaskClick={onOpenTaskDetail} />
      )}
      {activeTab === 'list' && (
        <TaskListTable project={project} tasks={projectTasks} onTaskClick={onOpenTaskDetail} />
      )}
      {activeTab === 'timeline' && (
        <TimelineGantt
          yearMonth={yearMonth}
          todayStr={todayStr}
          tasks={projectTasks}
          projects={visibleProjects}
          users={users}
          zoom={zoom}
          colorMode={colorMode}
          onZoomChange={setZoom}
          onColorModeChange={setColorMode}
          onTaskClick={onOpenTaskDetail}
        />
      )}
      {activeTab === 'calendar' && (
        <CalendarBoard
          yearMonth={yearMonth}
          todayStr={todayStr}
          tasks={projectTasks}
          projects={visibleProjects}
          canAddTaskOnDate={canAddTask}
          onTaskClick={onOpenTaskDetail}
          onAddTaskOnDate={(dateStr) =>
            onOpenCreateTask({ projectId: project.id, startDate: dateStr })
          }
        />
      )}
      {activeTab === 'assign' && canAssignTasks && (
        <AssignTasksBoard
          project={project}
          tasks={projectTasks}
          onTaskClick={onOpenTaskDetail}
        />
      )}
    </div>
  );
}
