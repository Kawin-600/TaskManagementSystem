import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { LocalStorageRepository } from '../../../services/workspaceRepository';
import { LocalAuthService } from '../../../services/authService';
import { ToastProvider } from '../../../state/ToastContext';
import { AuthProvider } from '../../../state/AuthContext';
import { WorkspaceProvider } from '../../../state/WorkspaceContext';
import { AppRoutes } from '../../../App';

function LocationTracker() {
  const loc = useLocation();
  return <div data-testid="location-display">{`${loc.pathname}${loc.search}`}</div>;
}

function renderApp(initialEntries: string[], onOpenTaskDetail?: (taskId: string) => void) {
  const repo = new LocalStorageRepository(() => '2026-11-20');
  const auth = new LocalAuthService(repo);
  return {
    repo,
    auth,
    ...render(
      <MemoryRouter initialEntries={initialEntries}>
        <ToastProvider>
          <AuthProvider authService={auth}>
            <WorkspaceProvider repository={repo}>
              <LocationTracker />
              <AppRoutes testOnOpenTaskDetail={onOpenTaskDetail} />
            </WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    ),
  };
}

describe('Login, Focused Dual-Rail AppShell, and Route Guards', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('redirects unauthenticated visits to /login, supports demo quick-login and logout', async () => {
    const user = userEvent.setup();
    renderApp(['/']);

    await waitFor(() => expect(screen.getByTestId('location-display')).toHaveTextContent('/login'));
    expect(screen.getByLabelText(/อีเมล/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Admin/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /หัวหน้างาน/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /เจ้าหน้าที่/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Admin/i }));
    await waitFor(() => expect(screen.getByTestId('location-display')).toHaveTextContent('/'));
    expect(screen.getByRole('navigation', { name: /เมนูหลัก/i })).toBeInTheDocument();

    // Open account popover and log out
    await user.click(screen.getByRole('button', { name: /บัญชีผู้ใช้/i }));
    await user.click(screen.getByRole('button', { name: /ออกจากระบบ/i }));
    await waitFor(() => expect(screen.getByTestId('location-display')).toHaveTextContent('/login'));
  });

  it('shows Contextual Sub-Panel only on /projects and /admin and allows collapsing/expanding', async () => {
    const user = userEvent.setup();
    const repo = new LocalStorageRepository(() => '2026-11-20');
    const auth = new LocalAuthService(repo);
    await auth.loginAsDemoUser('u1');

    render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <AuthProvider authService={auth}>
            <WorkspaceProvider repository={repo}>
              <AppRoutes />
            </WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('navigation', { name: /เมนูหลัก/i })).toBeInTheDocument());
    expect(screen.queryByTestId('contextual-subpanel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /โปรเจค/i }));
    expect(await screen.findByTestId('contextual-subpanel')).toBeInTheDocument();
    expect(screen.getByText('โปรเจคของฉัน')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ซ่อนแผง/i }));
    expect(screen.queryByTestId('contextual-subpanel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /แสดงแผงย่อย/i }));
    expect(await screen.findByTestId('contextual-subpanel')).toBeInTheDocument();
  });

  it('blocks Staff from /admin routes and hides Admin rail button (Review Focus #2)', async () => {
    const repo = new LocalStorageRepository(() => '2026-11-20');
    const auth = new LocalAuthService(repo);
    await auth.loginAsDemoUser('u3');

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <ToastProvider>
          <AuthProvider authService={auth}>
            <WorkspaceProvider repository={repo}>
              <LocationTracker />
              <AppRoutes />
            </WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/ไม่มีสิทธิ์เข้าถึงหน้านี้/i)).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /จัดการระบบ/i })).not.toBeInTheDocument();
  });

  it('hides non-member projects from Sub-Panel & Quick Search and blocks direct /projects/p3 access for Supervisor u2 (Review Focus #2)', async () => {
    const user = userEvent.setup();
    const repo = new LocalStorageRepository(() => '2026-11-20');
    const auth = new LocalAuthService(repo);
    await auth.loginAsDemoUser('u2');

    render(
      <MemoryRouter initialEntries={['/projects/p3']}>
        <ToastProvider>
          <AuthProvider authService={auth}>
            <WorkspaceProvider repository={repo}>
              <LocationTracker />
              <AppRoutes />
            </WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('location-display')).toHaveTextContent('/projects'));
    expect(screen.queryByText(/ออกแบบวิจัยการตลาดประจำปี 2027/)).not.toBeInTheDocument();

    // Quick search must not expose Project 3 or its tasks
    const searchInput = screen.getByPlaceholderText(/ค้นหางานหรือโปรเจค/i);
    await user.type(searchInput, 'วิจัยการตลาด');
    expect(screen.queryByText(/ออกแบบวิจัยการตลาดประจำปี 2027/)).not.toBeInTheDocument();
  });

  it('shows Review Queue popover for Supervisor and Overdue shortcut navigating to /my-tasks?filter=overdue for Staff', async () => {
    const user = userEvent.setup();
    const onOpenTaskDetail = vi.fn();

    // Supervisor sees Review pill & clicking item triggers onOpenTaskDetail
    const repo1 = new LocalStorageRepository(() => '2026-11-20');
    const auth1 = new LocalAuthService(repo1);
    await auth1.loginAsDemoUser('u2');

    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <AuthProvider authService={auth1}>
            <WorkspaceProvider repository={repo1}>
              <AppRoutes testOnOpenTaskDetail={onOpenTaskDetail} />
            </WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    const reviewBtn = await screen.findByRole('button', { name: /รอตรวจ/i });
    await user.click(reviewBtn);
    const popover = await screen.findByTestId('review-queue-popover');
    const reviewItem = within(popover).getByText(/ทดสอบการเชื่อมต่อ Payment Gateway/);
    await user.click(reviewItem);
    expect(onOpenTaskDetail).toHaveBeenCalledWith('t104');
    unmount();

    // Staff sees Overdue pill & clicking navigates to /my-tasks?filter=overdue
    localStorage.clear();
    const repo2 = new LocalStorageRepository(() => '2026-11-20');
    const auth2 = new LocalAuthService(repo2);
    await auth2.loginAsDemoUser('u3');

    render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <AuthProvider authService={auth2}>
            <WorkspaceProvider repository={repo2}>
              <LocationTracker />
              <AppRoutes />
            </WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    const header = await screen.findByRole('banner');
    const overdueBtn = await within(header).findByRole('button', { name: /เลยกำหนด/i });
    await user.click(overdueBtn);
    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/my-tasks?filter=overdue'),
    );
  });

  it('hides Admin sub-panel and Admin Topbar heading when non-Admin visits /admin/users or /admin/rbac directly (Important #3 / Review Focus #2)', async () => {
    const repo = new LocalStorageRepository(() => '2026-11-20');
    const auth = new LocalAuthService(repo);
    await auth.loginAsDemoUser('u3');

    const { unmount } = render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <ToastProvider>
          <AuthProvider authService={auth}>
            <WorkspaceProvider repository={repo}>
              <AppRoutes />
            </WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/ไม่มีสิทธิ์เข้าถึงหน้านี้/)).toBeInTheDocument());
    expect(screen.queryByTestId('contextual-subpanel')).not.toBeInTheDocument();
    const banner = screen.getByRole('banner');
    expect(within(banner).queryByText(/จัดการผู้ใช้งาน/)).not.toBeInTheDocument();
    unmount();

    render(
      <MemoryRouter initialEntries={['/admin/rbac']}>
        <ToastProvider>
          <AuthProvider authService={auth}>
            <WorkspaceProvider repository={repo}>
              <AppRoutes />
            </WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/ไม่มีสิทธิ์เข้าถึงหน้านี้/)).toBeInTheDocument());
    expect(screen.queryByTestId('contextual-subpanel')).not.toBeInTheDocument();
  });

  it('authenticates via real email/password form, displays Thai error on wrong password, and blocks Staff from /projects/p2 (Important #8)', async () => {
    const user = userEvent.setup();
    const { unmount } = renderApp(['/login']);

    await user.type(await screen.findByLabelText(/อีเมล/i), 'kittipong@taskflow.local');
    await user.type(screen.getByLabelText(/รหัสผ่าน/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /^เข้าสู่ระบบ$/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/อีเมลหรือรหัสผ่านไม่ถูกต้อง/);

    const passInput = screen.getByLabelText(/รหัสผ่าน/i);
    await user.clear(passInput);
    await user.type(passInput, '1234');
    await user.click(screen.getByRole('button', { name: /^เข้าสู่ระบบ$/ }));
    await waitFor(() => expect(screen.getByTestId('location-display')).toHaveTextContent('/'));
    unmount();

    // Staff u3 is not a member of p2 -> direct /projects/p2 redirects to /projects
    const repo2 = new LocalStorageRepository(() => '2026-11-20');
    const auth2 = new LocalAuthService(repo2);
    await auth2.loginAsDemoUser('u3');

    render(
      <MemoryRouter initialEntries={['/projects/p2']}>
        <ToastProvider>
          <AuthProvider authService={auth2}>
            <WorkspaceProvider repository={repo2}>
              <LocationTracker />
              <AppRoutes />
            </WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects'),
    );
  });
});
