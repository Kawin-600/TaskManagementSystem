import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  PanelLeftOpen,
  Search,
  Calendar,
  Plus,
  Clock,
  AlertTriangle,
  Folder,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { formatThaiDateFull, formatThaiDateShort, getTodayStr, isTaskOverdue } from '../../domain/dates';
import { canAccessAdmin, canManageUsers } from '../../domain/rbac';
import { useAuth } from '../../state/AuthContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import { useToast } from '../../state/ToastContext';
import { requestTelegramSettings } from '../../services/telegramSettings';

interface TopbarProps {
  hasSubPanelRoute: boolean;
  isSubPanelCollapsed: boolean;
  onExpandSubPanel: () => void;
  onOpenMobileDrawer: () => void;
  onOpenCreateTask: (opts?: { projectId?: string; startDate?: string }) => void;
  onOpenTaskDetail: (taskId: string) => void;
}

export function Topbar({
  hasSubPanelRoute,
  isSubPanelCollapsed,
  onExpandSubPanel,
  onOpenMobileDrawer,
  onOpenCreateTask,
  onOpenTaskDetail,
}: TopbarProps) {
  const { currentUser } = useAuth();
  const { visibleProjects, visibleTasks, users } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [testingTelegram, setTestingTelegram] = useState(false);

  async function testTelegram() {
    if (!currentUser) return;
    setTestingTelegram(true);
    try {
      const { result } = await requestTelegramSettings(currentUser.id, 'test');
      if (result === 'accepted') showToast('Telegram ตอบรับข้อความทดสอบแล้ว ลองเปิดแชตกับบอต', 'success');
      else if (result === 'unconfigured') showToast('บัญชีนี้ยังไม่ได้ตั้งค่า Telegram', 'warning');
      else showToast('ส่งข้อความทดสอบไป Telegram ไม่สำเร็จ', 'error');
    } catch {
      showToast('ติดต่อระบบแจ้งเตือนไม่ได้', 'error');
    } finally {
      setTestingTelegram(false);
    }
  }

  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);

  const todayStr = getTodayStr();

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
      if (reviewRef.current && !reviewRef.current.contains(e.target as Node)) {
        setReviewOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const pageHeader = useMemo(() => {
    const path = location.pathname;
    if (path === '/') {
      return {
        title: 'แดชบอร์ดภาพรวม',
        subtitle: 'สรุปสถิติงาน ความคืบหน้าโปรเจค และรายการเร่งด่วน',
      };
    }
    if (path.startsWith('/my-tasks')) {
      return {
        title: 'งานของฉัน',
        subtitle: 'ติดตามงานที่ได้รับมอบหมายทั้งหมดของคุณ',
      };
    }
    if (path === '/projects') {
      return {
        title: 'โปรเจคทั้งหมด',
        subtitle: 'โปรเจคที่คุณมีสิทธิ์เข้าถึงและความคืบหน้าล่าสุด',
      };
    }
    if (path.startsWith('/projects/')) {
      const pid = path.replace('/projects/', '');
      const project = visibleProjects.find((p) => p.id === pid);
      return {
        title: project ? project.name : 'พื้นที่ทำงานโปรเจค',
        subtitle: project?.description || 'จัดการงานแบบ Kanban, List, Timeline และ Calendar',
      };
    }
    if (path.startsWith('/schedule')) {
      return {
        title: 'ปฏิทิน & ไทม์ไลน์รวม',
        subtitle: 'วางแผนและติดตามกำหนดการทุกโปรเจคที่คุณดูแล',
      };
    }
    if (path.startsWith('/team')) {
      return {
        title: 'ทีมงาน & ภาระงาน',
        subtitle: 'ภาพรวมการกระจายงานของสมาชิกในขอบเขตโปรเจคของคุณ',
      };
    }
    if (path.startsWith('/admin/')) {
      if (path.startsWith('/admin/users')) {
        if (!currentUser || !canManageUsers(currentUser)) {
          return {
            title: 'ไม่มีสิทธิ์เข้าถึง',
            subtitle: 'สงวนสิทธิ์สำหรับ Admin และผู้บริหาร',
          };
        }
        return {
          title: 'จัดการผู้ใช้งาน',
          subtitle:
            currentUser.role === 'executive'
              ? 'เพิ่มและลบบัญชีผู้ใช้ โดย role ที่สร้างใหม่เป็น Staff'
              : 'เพิ่ม แก้ไขบทบาท และดูแลบัญชีผู้ใช้ในองค์กร (Admin)',
        };
      }
      if (path.startsWith('/admin/rbac')) {
        if (!currentUser || !canAccessAdmin(currentUser)) {
          return {
            title: 'ไม่มีสิทธิ์เข้าถึง',
            subtitle: 'สงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin)',
          };
        }
        return {
          title: 'ตารางสิทธิ์การใช้งาน (RBAC Matrix)',
          subtitle: 'รายละเอียดสิทธิ์การเข้าถึงแบบ Member-Scoped ทั้ง 4 บทบาท',
        };
      }
    }
    return { title: 'TaskFlow Pro', subtitle: '' };
  }, [location.pathname, visibleProjects, currentUser]);

  const searchResults = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return { projects: [], tasks: [] };
    return {
      projects: visibleProjects
        .filter((p) => p.name.toLowerCase().includes(trimmed))
        .slice(0, 4),
      tasks: visibleTasks
        .filter((t) => t.title.toLowerCase().includes(trimmed))
        .slice(0, 6),
    };
  }, [query, visibleProjects, visibleTasks]);

  if (!currentUser) return null;

  const isManager =
    currentUser.role === 'admin' ||
    currentUser.role === 'supervisor' ||
    currentUser.role === 'executive';
  const reviewTasks = visibleTasks.filter((t) => t.status === 'review');
  const myOverdueCount = visibleTasks.filter(
    (t) => t.assigneeId === currentUser.id && isTaskOverdue(t, todayStr),
  ).length;

  const currentProjectId = location.pathname.startsWith('/projects/')
    ? location.pathname.replace('/projects/', '')
    : undefined;

  return (
    <header className="z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 shadow-sm shadow-slate-900/[0.02]">
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          aria-label="เปิดเมนูนำทาง"
          onClick={onOpenMobileDrawer}
          className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        {hasSubPanelRoute && isSubPanelCollapsed && (
          <button
            type="button"
            aria-label="แสดงแผงย่อย"
            title="แสดงแผงย่อย"
            onClick={onExpandSubPanel}
            className="hidden rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-100 md:inline-flex"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-slate-800 md:text-base">
            {pageHeader.title}
          </h2>
          {pageHeader.subtitle && (
            <p className="hidden truncate text-[11px] text-slate-500 sm:block">
              {pageHeader.subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Quick Search */}
        <div ref={searchRef} className="relative hidden w-56 lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onFocus={() => setSearchFocused(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchFocused(true);
            }}
            placeholder="ค้นหางานหรือโปรเจค..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-700 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />

          {searchFocused && query.trim() && (
            <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              {searchResults.projects.length === 0 && searchResults.tasks.length === 0 ? (
                <p className="p-4 text-center text-xs text-slate-400">ไม่พบงานหรือโปรเจคที่ตรงกัน</p>
              ) : (
                <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto p-2">
                  {searchResults.projects.length > 0 && (
                    <div className="pb-1.5">
                      <p className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">
                        โปรเจค
                      </p>
                      {searchResults.projects.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setQuery('');
                            setSearchFocused(false);
                            navigate(`/projects/${p.id}`);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: p.color }} />
                          <span className="truncate">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.tasks.length > 0 && (
                    <div className="pt-1.5">
                      <p className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">
                        งาน
                      </p>
                      {searchResults.tasks.map((t) => {
                        const prj = visibleProjects.find((p) => p.id === t.projectId);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setQuery('');
                              setSearchFocused(false);
                              onOpenTaskDetail(t.id);
                            }}
                            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-100"
                          >
                            <span className="truncate font-medium text-slate-700">{t.title}</span>
                            <span className="shrink-0 text-[10px] text-slate-400">
                              {prj?.name.slice(0, 14)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Attention Indicator Pill */}
        {isManager ? (
          <div ref={reviewRef} className="relative">
            <button
              type="button"
              onClick={() => setReviewOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition ${
                reviewTasks.length > 0
                  ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>รอตรวจ {reviewTasks.length}</span>
            </button>

            {reviewOpen && (
              <div
                data-testid="review-queue-popover"
                className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-slate-100 bg-amber-50/70 px-4 py-2.5">
                  <span className="text-xs font-bold text-amber-900">
                    งานรอตรวจสอบทั้งหมด ({reviewTasks.length})
                  </span>
                </div>
                {reviewTasks.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 p-6 text-center text-xs text-slate-400">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    <span>ไม่มีงานค้างรอตรวจสอบ</span>
                  </div>
                ) : (
                  <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                    {reviewTasks.map((task) => {
                      const prj = visibleProjects.find((p) => p.id === task.projectId);
                      const assignee = users.find((u) => u.id === task.assigneeId);
                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => {
                            setReviewOpen(false);
                            onOpenTaskDetail(task.id);
                          }}
                          className="flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-slate-50"
                        >
                          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: prj?.color ?? '#6366f1' }}
                            />
                            {prj?.name}
                          </span>
                          <span className="text-xs font-semibold text-slate-800">{task.title}</span>
                          <span className="text-[11px] text-slate-500">
                            {assignee?.name ?? '-'} · กำหนดส่ง {formatThaiDateShort(task.dueDate)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          myOverdueCount > 0 && (
            <button
              type="button"
              onClick={() => navigate('/my-tasks?filter=overdue')}
              className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>เลยกำหนด {myOverdueCount}</span>
            </button>
          )
        )}

        {/* Dynamic Today Date Badge */}
        <div className="hidden items-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-1.5 text-xs font-semibold text-indigo-700 xl:flex">
          <Calendar className="h-3.5 w-3.5" />
          <span>วันนี้: {formatThaiDateFull(todayStr)}</span>
        </div>

        <button
          type="button"
          onClick={() => void testTelegram()}
          disabled={testingTelegram}
          title="ทดสอบ Telegram"
          aria-label="ทดสอบ Telegram"
          aria-busy={testingTelegram}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">{testingTelegram ? 'กำลังส่ง…' : 'ทดสอบ Telegram'}</span>
        </button>

        {/* Quick Create Task Button */}
        <button
          type="button"
          disabled={visibleProjects.length === 0}
          onClick={() => onOpenCreateTask({ projectId: currentProjectId })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">สร้างงาน</span>
        </button>
      </div>
    </header>
  );
}
