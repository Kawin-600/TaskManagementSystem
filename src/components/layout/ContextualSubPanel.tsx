import { Link, useLocation } from 'react-router-dom';
import { Plus, PanelLeftClose, FolderOpen, UserCog, Shield } from 'lucide-react';
import { canAccessAdmin, canCreateProject } from '../../domain/rbac';
import { useAuth } from '../../state/AuthContext';
import { useWorkspace } from '../../state/WorkspaceContext';

interface ContextualSubPanelProps {
  mode: 'projects' | 'admin';
  onCollapse: () => void;
  onOpenCreateProject: () => void;
  onNavigate?: () => void;
}

export function ContextualSubPanel({
  mode,
  onCollapse,
  onOpenCreateProject,
  onNavigate,
}: ContextualSubPanelProps) {
  const { currentUser } = useAuth();
  const { visibleProjects, visibleTasks } = useWorkspace();
  const location = useLocation();

  if (!currentUser) return null;

  return (
    <aside
      data-testid="contextual-subpanel"
      className="flex h-full w-56 shrink-0 flex-col border-r border-slate-200 bg-slate-50/90"
    >
      {mode === 'projects' ? (
        <>
          <div className="flex h-14 items-center justify-between border-b border-slate-200/80 px-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              โปรเจคของฉัน
            </span>
            <div className="flex items-center gap-1">
              {canCreateProject(currentUser) && (
                <button
                  type="button"
                  onClick={onOpenCreateProject}
                  title="สร้างโปรเจคใหม่"
                  aria-label="สร้างโปรเจคใหม่"
                  className="rounded-lg p-1 text-indigo-600 transition hover:bg-indigo-100"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onCollapse}
                title="ซ่อนแผง"
                aria-label="ซ่อนแผง"
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto p-2.5">
            <Link
              to="/projects"
              onClick={onNavigate}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                location.pathname === '/projects'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span>โปรเจคทั้งหมด ({visibleProjects.length})</span>
            </Link>

            <div className="pt-2">
              {visibleProjects.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-400">ยังไม่มีโปรเจคที่เข้าร่วม</p>
              ) : (
                <ul className="space-y-1">
                  {visibleProjects.map((project) => {
                    const active = location.pathname === `/projects/${project.id}`;
                    const reviewCount = visibleTasks.filter(
                      (t) => t.projectId === project.id && t.status === 'review',
                    ).length;

                    return (
                      <li key={project.id}>
                        <Link
                          to={`/projects/${project.id}`}
                          onClick={onNavigate}
                          className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs transition ${
                            active
                              ? 'bg-white font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                              : 'font-medium text-slate-600 hover:bg-white hover:text-slate-900'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: project.color }}
                            />
                            <span className="truncate">{project.name}</span>
                          </span>
                          {reviewCount > 0 && (
                            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                              {reviewCount}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex h-14 items-center justify-between border-b border-slate-200/80 px-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {canAccessAdmin(currentUser) ? 'จัดการระบบ' : 'จัดการผู้ใช้'}
            </span>
            <button
              type="button"
              onClick={onCollapse}
              title="ซ่อนแผง"
              aria-label="ซ่อนแผง"
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-1 p-2.5">
            <Link
              to="/admin/users"
              onClick={onNavigate}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                location.pathname === '/admin/users'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <UserCog className="h-4 w-4 shrink-0" />
              <span>จัดการผู้ใช้งาน</span>
            </Link>
            {canAccessAdmin(currentUser) && (
              <Link
                to="/admin/rbac"
                onClick={onNavigate}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  location.pathname === '/admin/rbac'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Shield className="h-4 w-4 shrink-0" />
                <span>ตารางสิทธิ์ (RBAC Matrix)</span>
              </Link>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
