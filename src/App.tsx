import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { canAccessAdmin, canManageUsers } from './domain/rbac';
import { ToastProvider } from './state/ToastContext';
import { AuthProvider, useAuth } from './state/AuthContext';
import { WorkspaceProvider, useWorkspace } from './state/WorkspaceContext';
import type { Project } from './types/models';
import { AppShell } from './components/layout/AppShell';
import { CreateTaskModal } from './components/modals/CreateTaskModal';
import { TaskDetailModal } from './components/modals/TaskDetailModal';
import { ProjectFormModal } from './components/modals/ProjectFormModal';
import { ProjectMembersModal } from './components/modals/ProjectMembersModal';
import { CreateUserModal } from './components/modals/CreateUserModal';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MyTasksPage } from './pages/MyTasksPage';
import { ProjectsOverviewPage } from './pages/ProjectsOverviewPage';
import { ProjectWorkspacePage } from './pages/ProjectWorkspacePage';
import { GlobalSchedulePage } from './pages/GlobalSchedulePage';
import { TeamWorkloadPage } from './pages/TeamWorkloadPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminRbacPage } from './pages/AdminRbacPage';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { currentUser, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500">
        กำลังโหลดข้อมูลระบบ...
      </div>
    );
  }
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AdminRoute({ children }: { children: JSX.Element }) {
  const { currentUser } = useAuth();
  if (!currentUser || !canAccessAdmin(currentUser)) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-rose-500" />
        <h3 className="text-base font-bold text-slate-800">ไม่มีสิทธิ์เข้าถึงหน้านี้</h3>
        <p className="mt-1 text-xs text-slate-500">
          เมนูการจัดการระบบสงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น
        </p>
      </div>
    );
  }
  return children;
}

function UserManagementRoute({ children }: { children: JSX.Element }) {
  const { currentUser } = useAuth();
  if (!currentUser || !canManageUsers(currentUser)) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-rose-500" />
        <h3 className="text-base font-bold text-slate-800">ไม่มีสิทธิ์เข้าถึงหน้านี้</h3>
        <p className="mt-1 text-xs text-slate-500">สงวนสิทธิ์สำหรับ Admin และผู้บริหาร</p>
      </div>
    );
  }
  return children;
}

function ProjectAccessGuard({ children }: { children: JSX.Element }) {
  const { projectId } = useParams();
  const { visibleProjects, isLoading } = useWorkspace();
  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">กำลังโหลดโปรเจค...</div>;
  }
  const hasAccess = visibleProjects.some((p) => p.id === projectId);
  if (!hasAccess) {
    return <Navigate to="/projects" replace />;
  }
  return children;
}

export function AppRoutes({
  testOnOpenTaskDetail,
}: {
  testOnOpenTaskDetail?: (taskId: string) => void;
} = {}) {
  const navigate = useNavigate();

  const [createTaskModal, setCreateTaskModal] = useState<{
    isOpen: boolean;
    projectId?: string;
    startDate?: string;
    unassigned?: boolean;
  }>({ isOpen: false });
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [projectFormModal, setProjectFormModal] = useState<{
    isOpen: boolean;
    project?: Project | null;
  }>({ isOpen: false });
  const [membersProjectId, setMembersProjectId] = useState<string | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);

  const handleOpenCreateTask = (opts?: {
    projectId?: string;
    startDate?: string;
    unassigned?: boolean;
  }) => {
    setCreateTaskModal({
      isOpen: true,
      projectId: opts?.projectId,
      startDate: opts?.startDate,
      unassigned: opts?.unassigned,
    });
  };

  const handleOpenTaskDetail = (taskId: string) => {
    testOnOpenTaskDetail?.(taskId);
    setDetailTaskId(taskId);
  };

  const handleOpenCreateProject = () => {
    setProjectFormModal({ isOpen: true, project: null });
  };

  const handleOpenEditProject = (project: Project) => {
    setProjectFormModal({ isOpen: true, project });
  };

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppShell
                onOpenCreateTask={handleOpenCreateTask}
                onOpenTaskDetail={handleOpenTaskDetail}
                onOpenCreateProject={handleOpenCreateProject}
              />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage onOpenTaskDetail={handleOpenTaskDetail} />} />
          <Route
            path="/my-tasks"
            element={
              <MyTasksPage
                onOpenTaskDetail={handleOpenTaskDetail}
                onOpenCreateTask={handleOpenCreateTask}
              />
            }
          />
          <Route
            path="/projects"
            element={
              <ProjectsOverviewPage
                onOpenCreateProject={handleOpenCreateProject}
                onOpenEditProject={handleOpenEditProject}
              />
            }
          />
          <Route
            path="/projects/:projectId"
            element={
              <ProjectAccessGuard>
                <ProjectWorkspacePage
                  onOpenCreateTask={handleOpenCreateTask}
                  onOpenTaskDetail={handleOpenTaskDetail}
                  onOpenEditProject={handleOpenEditProject}
                  onOpenMembers={(pid) => setMembersProjectId(pid)}
                />
              </ProjectAccessGuard>
            }
          />
          <Route
            path="/schedule"
            element={
              <GlobalSchedulePage
                onOpenCreateTask={handleOpenCreateTask}
                onOpenTaskDetail={handleOpenTaskDetail}
              />
            }
          />
          <Route path="/team" element={<TeamWorkloadPage />} />
          <Route
            path="/admin/users"
            element={
              <UserManagementRoute>
                <AdminUsersPage onOpenCreateUser={() => setCreateUserOpen(true)} />
              </UserManagementRoute>
            }
          />
          <Route
            path="/admin/rbac"
            element={
              <AdminRoute>
                <AdminRbacPage />
              </AdminRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Center Modals */}
      <CreateTaskModal
        isOpen={createTaskModal.isOpen}
        defaultProjectId={createTaskModal.projectId}
        defaultStartDate={createTaskModal.startDate}
        defaultUnassigned={createTaskModal.unassigned}
        onClose={() => setCreateTaskModal({ isOpen: false })}
      />
      <TaskDetailModal taskId={detailTaskId} onClose={() => setDetailTaskId(null)} />
      <ProjectFormModal
        isOpen={projectFormModal.isOpen}
        project={projectFormModal.project}
        onClose={() => setProjectFormModal({ isOpen: false })}
        onSaved={(saved) => {
          if (!projectFormModal.project) {
            navigate(`/projects/${saved.id}`);
          }
        }}
      />
      <ProjectMembersModal projectId={membersProjectId} onClose={() => setMembersProjectId(null)} />
      <CreateUserModal isOpen={createUserOpen} onClose={() => setCreateUserOpen(false)} />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <WorkspaceProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </WorkspaceProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
