import { participatesInTask } from '../domain/rbac';
import { Link } from 'react-router-dom';
import {
  FolderOpen,
  ListChecks,
  Clock,
  AlertTriangle,
  UserCheck,
  Bell,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import { formatThaiDateShort, getTodayStr, isTaskOverdue } from '../domain/dates';
import { useAuth } from '../state/AuthContext';
import { useWorkspace } from '../state/WorkspaceContext';
import { StatusBadge } from '../components/ui/Badges';

interface DashboardPageProps {
  onOpenTaskDetail: (taskId: string) => void;
}

export function DashboardPage({ onOpenTaskDetail }: DashboardPageProps) {
  const { currentUser } = useAuth();
  const { visibleProjects, visibleTasks, users } = useWorkspace();

  if (!currentUser) return null;

  const todayStr = getTodayStr();
  const completedTasks = visibleTasks.filter((t) => t.status === 'completed');
  const reviewTasks = visibleTasks.filter((t) => t.status === 'review');
  const overdueTasks = visibleTasks.filter((t) => isTaskOverdue(t, todayStr));
  const myTasks = visibleTasks.filter((t) => participatesInTask(t, currentUser.id));
  const urgentQueue = visibleTasks
    .filter((t) => t.status === 'review' || isTaskOverdue(t, todayStr))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* 4 Scoped KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          data-testid="kpi-projects"
          className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              โปรเจคของฉัน
            </p>
            <h3 className="mt-1 text-2xl font-bold text-slate-800">
              {visibleProjects.length}{' '}
              <span className="text-xs font-normal text-slate-500">โปรเจค</span>
            </h3>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <FolderOpen className="h-6 w-6" />
          </div>
        </div>

        <div
          data-testid="kpi-tasks"
          className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              งานทั้งหมด
            </p>
            <h3 className="mt-1 text-2xl font-bold text-slate-800">
              {visibleTasks.length} <span className="text-xs font-normal text-slate-500">งาน</span>
            </h3>
            <p className="mt-1 text-xs font-medium text-emerald-600">
              เสร็จแล้ว {completedTasks.length} งาน
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <ListChecks className="h-6 w-6" />
          </div>
        </div>

        <div
          data-testid="kpi-review"
          className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              รอตรวจสอบ (Review)
            </p>
            <h3 className="mt-1 text-2xl font-bold text-amber-600">
              {reviewTasks.length} <span className="text-xs font-normal text-slate-500">งาน</span>
            </h3>
            <p className="mt-1 text-xs font-medium text-amber-600">ต้องการการอนุมัติ</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div
          data-testid="kpi-overdue"
          className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              งานเลยกำหนด (Overdue)
            </p>
            <h3 className="mt-1 text-2xl font-bold text-rose-600">
              {overdueTasks.length} <span className="text-xs font-normal text-slate-500">งาน</span>
            </h3>
            <p className="mt-1 text-xs font-medium text-rose-500">เลยกำหนดส่ง ณ วันนี้</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Main 2-Column Body */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* My Tasks Preview */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
                <UserCheck className="h-5 w-5 text-indigo-500" />
                <span>งานของฉัน ({currentUser.name})</span>
              </h3>
              <Link
                to="/my-tasks"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
              >
                <span>ดูทั้งหมด ({myTasks.length})</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {myTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                ไม่มีงานที่ได้รับมอบหมายในขณะนี้
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {myTasks.slice(0, 5).map((task) => {
                  const prj = visibleProjects.find((p) => p.id === task.projectId);
                  const overdue = isTaskOverdue(task, todayStr);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onOpenTaskDetail(task.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-slate-50"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: prj?.color ?? '#94a3b8' }}
                          />
                          <h4 className="min-w-0 break-words text-sm font-semibold leading-relaxed text-slate-800">
                            {task.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-3 pl-4 text-xs text-slate-400">
                          <span>{prj?.name ?? '-'}</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            กำหนด: {formatThaiDateShort(task.dueDate)}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {overdue && (
                          <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                            เลยกำหนด
                          </span>
                        )}
                        <StatusBadge status={task.status} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Urgent & Review Queue */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-800">
              <Bell className="h-5 w-5 text-amber-500" />
              <span>งานเร่งรัด &amp; รอการอนุมัติ</span>
            </h3>

            {urgentQueue.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">
                ไม่มีงานเลยกำหนดหรือค้างรอตรวจสอบ
              </p>
            ) : (
              <div className="space-y-2.5">
                {urgentQueue.map((task) => {
                  const prj = visibleProjects.find((p) => p.id === task.projectId);
                  const assignee = users.find((u) => u.id === task.assigneeId);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onOpenTaskDetail(task.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-left transition hover:border-slate-300 hover:bg-white"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <span className="text-[10px] font-bold uppercase text-slate-400">
                          {prj?.name ?? ''}
                        </span>
                        <h5 className="break-words text-sm font-semibold leading-relaxed text-slate-800">
                          {task.title}
                        </h5>
                        <p className="text-xs text-slate-500">
                          ผู้รับผิดชอบ: {assignee?.name ?? '-'} ·{' '}
                          {formatThaiDateShort(task.startDate)} - {formatThaiDateShort(task.dueDate)}
                        </p>
                      </div>
                      {task.status === 'review' ? (
                        <span className="shrink-0 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
                          อนุมัติงาน
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white">
                          เร่งรัด
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Visible Projects Progress */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800">ความคืบหน้าโปรเจคของฉัน</h3>
            <Link to="/projects" className="text-xs font-semibold text-indigo-600 hover:underline">
              ดูทั้งหมด
            </Link>
          </div>

          {visibleProjects.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">ยังไม่มีโปรเจคที่เข้าร่วม</p>
          ) : (
            <div className="space-y-4">
              {visibleProjects.map((project) => {
                const prjTasks = visibleTasks.filter((t) => t.projectId === project.id);
                const done = prjTasks.filter((t) => t.status === 'completed').length;
                const pct = prjTasks.length > 0 ? Math.round((done / prjTasks.length) * 100) : 0;
                const supervisor = users.find((u) => u.id === project.supervisorId);

                return (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="block rounded-xl border border-transparent p-3 transition hover:border-slate-200 hover:bg-slate-50"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="truncate">{project.name}</span>
                      </span>
                      <span className="shrink-0 text-xs font-bold text-slate-700">{pct}%</span>
                    </div>
                    <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: project.color }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>หัวหน้า: {supervisor ? supervisor.name.split(' ')[0] : '-'}</span>
                      <span>
                        {done}/{prjTasks.length} งานเสร็จสิ้น
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
