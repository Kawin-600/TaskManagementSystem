import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LocalStorageRepository } from '../../services/workspaceRepository';
import { LocalAuthService } from '../../services/authService';
import { ToastProvider } from '../../state/ToastContext';
import { AuthProvider } from '../../state/AuthContext';
import { WorkspaceProvider } from '../../state/WorkspaceContext';
import { GlobalSchedulePage } from '../GlobalSchedulePage';
import { TeamWorkloadPage } from '../TeamWorkloadPage';
import { AdminUsersPage } from '../AdminUsersPage';
import { AdminRbacPage } from '../AdminRbacPage';

async function mountWithUser(userId: string, ui: JSX.Element) {
  localStorage.clear();
  const repo = new LocalStorageRepository(() => '2026-11-20');
  const auth = new LocalAuthService(repo);
  await auth.loginAsDemoUser(userId);

  return {
    repo,
    auth,
    ...render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider authService={auth}>
            <WorkspaceProvider repository={repo}>{ui}</WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    ),
  };
}

describe('Global Schedule, Team Workload, and Admin Pages', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('GlobalSchedulePage switches Calendar/Gantt, filters strictly by visible projects, and navigates months', async () => {
    const user = userEvent.setup();
    const onOpenTaskDetail = vi.fn();

    // Supervisor u2 sees only p1 and p2 (NOT p3)
    await mountWithUser(
      'u2',
      <GlobalSchedulePage onOpenCreateTask={vi.fn()} onOpenTaskDetail={onOpenTaskDetail} />,
    );

    const projectSelect = (await screen.findByLabelText(/กรองโปรเจค/i)) as HTMLSelectElement;
    expect(within(projectSelect).getByText(/Mobile Banking/)).toBeInTheDocument();
    expect(within(projectSelect).queryByText(/วิจัยการตลาด/)).not.toBeInTheDocument();

    // Switch to Gantt Timeline view and filter by status=review
    await user.click(screen.getByRole('button', { name: /ไทม์ไลน์/i }));
    await user.selectOptions(screen.getByLabelText(/กรองสถานะ/i), 'review');

    expect(await screen.findByTestId('gantt-bar-t104')).toBeInTheDocument();
    expect(screen.queryByTestId('gantt-bar-t103')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /เดือนถัดไป/i }));
    await user.click(screen.getByRole('button', { name: /เดือนนี้/i }));
  });

  it('TeamWorkloadPage scopes visible teammates and counts ONLY tasks from visible projects', async () => {
    // Supervisor u2 sees p1 (u2, u3, u4) and p2 (u2, u4) -> NOT u1 (only in p3) and NOT p3 tasks!
    // In p1 & p2: u3 has 4 tasks (t101, t102, t103, t105); in p3 u3 also has t301, t304 which MUST NOT be counted!
    await mountWithUser('u2', <TeamWorkloadPage />);

    expect(await screen.findByText('กิตติพงษ์ ขยันยิ่ง')).toBeInTheDocument();
    expect(screen.queryByText('นพดล ใจดี')).not.toBeInTheDocument();

    const u3Card = screen.getByTestId('team-card-u3');
    expect(within(u3Card).getByTestId('total-tasks')).toHaveTextContent('4 งาน');
  });

  it('AdminUsersPage disables self role/delete, confirms & cascades supervisor demotion and deletion, and shows Demo Reset (Review Focus #4)', async () => {
    const user = userEvent.setup();
    const onOpenCreateUser = vi.fn();
    const { repo } = await mountWithUser('u1', <AdminUsersPage onOpenCreateUser={onOpenCreateUser} />);

    // Self role dropdown & delete disabled for u1
    const selfRoleSelect = (await screen.findByLabelText(/เปลี่ยนบทบาท นพดล ใจดี/)) as HTMLSelectElement;
    expect(selfRoleSelect.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /ลบผู้ใช้ นพดล ใจดี/ })).not.toBeInTheDocument();

    // Demo Reset box exists
    expect(screen.getByRole('button', { name: /รีเซ็ตข้อมูลตัวอย่าง/ })).toBeInTheDocument();

    // Demoting supervisor u2 -> staff opens confirmation mentioning supervised projects
    const u2RoleSelect = screen.getByLabelText(/เปลี่ยนบทบาท วิภาวดี รักงาน/);
    await user.selectOptions(u2RoleSelect, 'staff');

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/โอนสิทธิ์ดูแล/);
    await user.click(within(dialog).getByRole('button', { name: /ยืนยันเปลี่ยนบทบาท/ }));

    await waitFor(async () => {
      const snap = await repo.loadAll();
      expect(snap.users.find((u) => u.id === 'u2')?.role).toBe('staff');
      expect(snap.projects.find((p) => p.id === 'p1')?.supervisorId).toBe('u1');
      expect(snap.projects.find((p) => p.id === 'p2')?.supervisorId).toBe('u1');
    });

    // Delete staff u4 with confirmation
    await user.click(screen.getByRole('button', { name: /ลบผู้ใช้ สมชาย สายลุย/ }));
    const delDialog = await screen.findByRole('dialog');
    await user.click(within(delDialog).getByRole('button', { name: /ยืนยันลบผู้ใช้งาน/ }));

    await waitFor(async () => {
      const snap = await repo.loadAll();
      expect(snap.users.some((u) => u.id === 'u4')).toBe(false);
      expect(snap.tasks.every((t) => t.assigneeId !== 'u4')).toBe(true);
    });
  });

  it('AdminRbacPage documents Member-Scoped visibility and Staff completed-task lock', () => {
    render(<AdminRbacPage />);
    expect(screen.getAllByText(/Member-Scoped/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ล็อกงานที่เสร็จสิ้น/).length).toBeGreaterThan(0);
  });
});
