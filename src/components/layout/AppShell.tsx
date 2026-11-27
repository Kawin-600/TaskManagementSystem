import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { canManageUsers } from '../../domain/rbac';
import { useAuth } from '../../state/AuthContext';
import { IconRail } from './IconRail';
import { ContextualSubPanel } from './ContextualSubPanel';
import { Topbar } from './Topbar';
import { TaskAssistant } from './TaskAssistant';

interface AppShellProps {
  onOpenCreateTask: (opts?: { projectId?: string; startDate?: string }) => void;
  onOpenTaskDetail: (taskId: string) => void;
  onOpenCreateProject: () => void;
}

export function AppShell({
  onOpenCreateTask,
  onOpenTaskDetail,
  onOpenCreateProject,
}: AppShellProps) {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [subPanelCollapsed, setSubPanelCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const subPanelMode: 'projects' | 'admin' | null = location.pathname.startsWith('/projects')
    ? 'projects'
    : location.pathname.startsWith('/admin') && currentUser && canManageUsers(currentUser)
      ? 'admin'
      : null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop Dual-Rail */}
      <div className="hidden h-full shrink-0 md:flex">
        <IconRail />
        {subPanelMode && !subPanelCollapsed && (
          <ContextualSubPanel
            mode={subPanelMode}
            onCollapse={() => setSubPanelCollapsed(true)}
            onOpenCreateProject={onOpenCreateProject}
          />
        )}
      </div>

      {/* Mobile Slide-Over Drawer (< 768px) */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className="fixed inset-0 z-40 flex bg-slate-900/50 backdrop-blur-sm md:hidden"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-full bg-white shadow-2xl"
          >
            <IconRail onNavigate={() => setMobileDrawerOpen(false)} />
            {subPanelMode && (
              <ContextualSubPanel
                mode={subPanelMode}
                onCollapse={() => setMobileDrawerOpen(false)}
                onOpenCreateProject={() => {
                  setMobileDrawerOpen(false);
                  onOpenCreateProject();
                }}
                onNavigate={() => setMobileDrawerOpen(false)}
              />
            )}
            <button
              type="button"
              aria-label="ปิดเมนู"
              onClick={() => setMobileDrawerOpen(false)}
              className="absolute right-2 top-2 rounded-lg bg-white/90 p-1 text-slate-600 shadow"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          hasSubPanelRoute={subPanelMode !== null}
          isSubPanelCollapsed={subPanelCollapsed}
          onExpandSubPanel={() => setSubPanelCollapsed(false)}
          onOpenMobileDrawer={() => setMobileDrawerOpen(true)}
          onOpenCreateTask={onOpenCreateTask}
          onOpenTaskDetail={onOpenTaskDetail}
        />
        <main className="relative flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      {currentUser && (
        <TaskAssistant key={currentUser.id} userId={currentUser.id} onOpenTaskDetail={onOpenTaskDetail} />
      )}
    </div>
  );
}
