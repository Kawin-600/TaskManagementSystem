import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LocalStorageRepository } from '../../services/workspaceRepository';
import { LocalAuthService } from '../../services/authService';
import { ToastProvider } from '../../state/ToastContext';
import { AuthProvider } from '../../state/AuthContext';
import { WorkspaceProvider } from '../../state/WorkspaceContext';
import { DashboardPage } from '../DashboardPage';
import { MyTasksPage } from '../MyTasksPage';
import { ProjectsOverviewPage } from '../ProjectsOverviewPage';
import { ProjectWorkspacePage } from '../ProjectWorkspacePage';

function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="loc">{`${loc.pathname}${loc.search}`}</div>;
}

async function mountWithUser(userId: string, initialEntries: string[], ui: JSX.Element) {
  localStorage.clear();
  const repo = new LocalStorageRepository(() => '2026-11-20');
  const auth = new LocalAuthService(repo);
  await auth.loginAsDemoUser(userId);

  return {
    repo,
    auth,
    ...render(
      <MemoryRouter initialEntries={initialEntries}>
        <ToastProvider>
          <AuthProvider authService={auth}>
            <WorkspaceProvider repository={repo}>
              <LocationDisplay />
              {ui}
            </WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    ),
  };
}

describe('Core Workspace Pages', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('DashboardPage renders Member-Scoped KPI cards, My Tasks, Review/Overdue, and triggers onOpenTaskDetail', async () => {
    const user = userEvent.setup();
    const onOpenTaskDetail = vi.fn();

    // Supervisor u2 sees p1 (5 tasks) & p2 (3 tasks) = 2 projects, 8 tasks, 1 review (t104), 1 overdue (t102)
    await mountWithUser('u2', ['/'], <DashboardPage onOpenTaskDetail={onOpenTaskDetail} />);

    expect(await screen.findByTestId('kpi-projects')).toHaveTextContent('2');
    expect(screen.getByTestId('kpi-tasks')).toHaveTextContent('8');
    expect(screen.getByTestId('kpi-review')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-overdue')).toHaveTextContent('1');
    expect(screen.queryByText(/ออกแบบวิจัยการตลาดประจำปี 2027/)).not.toBeInTheDocument();

    await user.click(screen.getByText(/ทดสอบการเชื่อมต่อ Payment Gateway/));
    expect(onOpenTaskDetail).toHaveBeenCalledWith('t104');
  });

  it('MyTasksPage lists only current user tasks and honors ?filter=overdue query param', async () => {
    const user = userEvent.setup();
    await mountWithUser(
      'u3',
      ['/my-tasks?filter=overdue'],
      <MyTasksPage onOpenTaskDetail={vi.fn()} onOpenCreateTask={vi.fn()} />,
    );

    // t102 is u3's overdue task; t101 is completed; t104 belongs to u4
    expect(await screen.findByText(/ออกแบบ DB และ API Architecture/)).toBeInTheDocument();
    expect(screen.queryByText(/วิเคราะห์ Requirement หน้า UX\/UI ใหม่/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ทดสอบการเชื่อมต่อ Payment Gateway/)).not.toBeInTheDocument();

    // Switching to "ทั้งหมด" shows u3's completed & upcoming tasks too, still excluding u4's t104
    await user.click(screen.getByRole('button', { name: /ทั้งหมด/ }));
    expect(await screen.findByText(/วิเคราะห์ Requirement หน้า UX\/UI ใหม่/)).toBeInTheDocument();
    expect(screen.queryByText(/ทดสอบการเชื่อมต่อ Payment Gateway/)).not.toBeInTheDocument();
  });

  it('ProjectsOverviewPage hides create/manage buttons for Staff and shows only visible projects', async () => {
    const { unmount } = await mountWithUser(
      'u3',
      ['/projects'],
      <ProjectsOverviewPage onOpenCreateProject={vi.fn()} onOpenEditProject={vi.fn()} />,
    );

    expect(await screen.findByText(/ปรับปรุงระบบ Mobile Banking 3.0/)).toBeInTheDocument();
    expect(screen.queryByText(/พัฒนาระบบ AI Chatbot บริการลูกค้า/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /สร้างโปรเจคใหม่/i })).not.toBeInTheDocument();
    expect(screen.queryByTitle(/ลบโปรเจค/)).not.toBeInTheDocument();
    unmount();

    await mountWithUser(
      'u2',
      ['/projects'],
      <ProjectsOverviewPage onOpenCreateProject={vi.fn()} onOpenEditProject={vi.fn()} />,
    );
    expect(await screen.findByRole('button', { name: /สร้างโปรเจคใหม่/i })).toBeInTheDocument();
  });

  it('ProjectWorkspacePage enforces Kanban Staff completed lock, Supervisor inline approve, and isolated Timeline/Calendar state', async () => {
    const user = userEvent.setup();

    // 1. Staff view of p1 Kanban
    const { unmount } = await mountWithUser(
      'u3',
      ['/projects/p1'],
      <Routes>
        <Route
          path="/projects/:projectId"
          element={
            <ProjectWorkspacePage
              onOpenCreateTask={vi.fn()}
              onOpenTaskDetail={vi.fn()}
              onOpenEditProject={vi.fn()}
              onOpenMembers={vi.fn()}
            />
          }
        />
      </Routes>,
    );

    const completedCard = await screen.findByTestId('kanban-card-t101');
    const inProgressCard = screen.getByTestId('kanban-card-t102');
    expect(completedCard).toHaveAttribute('draggable', 'false');
    expect(inProgressCard).toHaveAttribute('draggable', 'true');

    // Dropping Staff task onto completed column triggers warning toast and does not complete
    const completedCol = screen.getByTestId('kanban-col-completed');
    fireEvent.dragStart(inProgressCard, {
      dataTransfer: { setData: vi.fn(), getData: () => 't102' },
    });
    fireEvent.dragOver(completedCol);
    fireEvent.drop(completedCol, {
      dataTransfer: { getData: () => 't102' },
    });
    expect(await screen.findByText(/ไม่สามารถย้ายงานไป "เสร็จสิ้น"/)).toBeInTheDocument();

    // Switching to Timeline & clicking Zoom/Next Month stays on /projects/p1 (fixes design.html leak!)
    await user.click(screen.getByRole('button', { name: /ไทม์ไลน์/ }));
    await user.click(screen.getByRole('button', { name: 'กว้าง' }));
    await user.click(screen.getByRole('button', { name: /เดือนถัดไป/i }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/projects/p1');
    unmount();

    // 2. Supervisor inline approve on Review card
    const { repo } = await mountWithUser(
      'u2',
      ['/projects/p1'],
      <Routes>
        <Route
          path="/projects/:projectId"
          element={
            <ProjectWorkspacePage
              onOpenCreateTask={vi.fn()}
              onOpenTaskDetail={vi.fn()}
              onOpenEditProject={vi.fn()}
              onOpenMembers={vi.fn()}
            />
          }
        />
      </Routes>,
    );

    const approveBtn = await screen.findByRole('button', { name: /^อนุมัติ$/ });
    await user.click(approveBtn);
    await waitFor(async () => {
      const snap = await repo.loadAll();
      expect(snap.tasks.find((t) => t.id === 't104')?.status).toBe('completed');
    });
  });

  it('MyTasksPage resets overdue filter back to all when navigating back to /my-tasks without query param (Important #5)', async () => {
    const user = userEvent.setup();
    const { Link } = await import('react-router-dom');

    await mountWithUser(
      'u3',
      ['/my-tasks?filter=overdue'],
      <>
        <Link to="/my-tasks">ไปงานของฉันทั้งหมด</Link>
        <MyTasksPage onOpenTaskDetail={vi.fn()} onOpenCreateTask={vi.fn()} />
      </>,
    );

    expect(await screen.findByText(/ออกแบบ DB และ API Architecture/)).toBeInTheDocument();
    expect(screen.queryByText(/วิเคราะห์ Requirement หน้า UX\/UI ใหม่/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'ไปงานของฉันทั้งหมด' }));
    expect(await screen.findByText(/วิเคราะห์ Requirement หน้า UX\/UI ใหม่/)).toBeInTheDocument();
  });

  it('TaskListTable requires confirmation before permanently deleting a task (Important #7)', async () => {
    const user = userEvent.setup();
    const { repo } = await mountWithUser(
      'u2',
      ['/projects/p1'],
      <Routes>
        <Route
          path="/projects/:projectId"
          element={
            <ProjectWorkspacePage
              onOpenCreateTask={vi.fn()}
              onOpenTaskDetail={vi.fn()}
              onOpenEditProject={vi.fn()}
              onOpenMembers={vi.fn()}
            />
          }
        />
      </Routes>,
    );

    await user.click(await screen.findByRole('button', { name: /รายการ/ }));
    const search = screen.getByRole('searchbox', { name: 'ค้นหารายการงาน' });
    await user.type(search, 'API Documentation');
    expect(screen.getByText('จัดทำเอกสาร API Documentation')).toBeInTheDocument();
    expect(screen.queryByText('วิเคราะห์ Requirement หน้า UX/UI ใหม่')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ล้างคำค้นหา' }));
    await user.click(await screen.findByRole('button', { name: /ลบงาน จัดทำเอกสาร API Documentation/ }));

    // Task must NOT be deleted immediately without confirming!
    expect((await repo.loadAll()).tasks.some((t) => t.id === 't105')).toBe(true);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /ยืนยันลบงาน/ }));

    await waitFor(async () => {
      expect((await repo.loadAll()).tasks.some((t) => t.id === 't105')).toBe(false);
    });
  });
});
