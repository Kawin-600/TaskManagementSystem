import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocalStorageRepository } from '../../services/workspaceRepository';
import { LocalAuthService } from '../../services/authService';
import { ToastProvider } from '../ToastContext';
import { AuthProvider, useAuth } from '../AuthContext';
import { WorkspaceProvider, useWorkspace } from '../WorkspaceContext';

function Harness() {
  const { currentUser, loginAsDemoUser } = useAuth();
  const { visibleProjects, visibleTasks, moveTaskStatus, approveTask, rejectTask } = useWorkspace();

  return (
    <div>
      <div data-testid="user-role">{currentUser?.role ?? 'none'}</div>
      <div data-testid="visible-projects">{visibleProjects.map((p) => p.id).join(',')}</div>
      <div data-testid="t102-status">{visibleTasks.find((t) => t.id === 't102')?.status ?? 'hidden'}</div>
      <div data-testid="t101-status">{visibleTasks.find((t) => t.id === 't101')?.status ?? 'hidden'}</div>
      <div data-testid="t104-status">{visibleTasks.find((t) => t.id === 't104')?.status ?? 'hidden'}</div>
      <button type="button" onClick={() => loginAsDemoUser('u3')}>
        login-staff
      </button>
      <button type="button" onClick={() => loginAsDemoUser('u2')}>
        login-supervisor
      </button>
      <button type="button" onClick={() => moveTaskStatus('t102', 'completed')}>
        staff-complete-t102
      </button>
      <button type="button" onClick={() => moveTaskStatus('t101', 'in_progress')}>
        staff-reopen-t101
      </button>
      <button type="button" onClick={() => approveTask('t104')}>
        approve-t104
      </button>
      <button type="button" onClick={() => rejectTask('t104')}>
        reject-t104
      </button>
    </div>
  );
}

describe('WorkspaceContext RBAC integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function mountApp() {
    const repo = new LocalStorageRepository(() => '2026-11-20');
    const auth = new LocalAuthService(repo);
    return render(
      <ToastProvider>
        <AuthProvider authService={auth}>
          <WorkspaceProvider repository={repo}>
            <Harness />
          </WorkspaceProvider>
        </AuthProvider>
      </ToastProvider>,
    );
  }

  it('scopes visibleProjects to member projects and blocks Staff direct completion & completed-task reopen', async () => {
    const user = userEvent.setup();
    mountApp();

    await user.click(screen.getByText('login-staff'));
    await waitFor(() => expect(screen.getByTestId('user-role')).toHaveTextContent('staff'));
    expect(screen.getByTestId('visible-projects')).toHaveTextContent('p1,p3');

    // Attempt direct completion of own in_progress task
    await user.click(screen.getByText('staff-complete-t102'));
    expect(screen.getByTestId('t102-status')).toHaveTextContent('in_progress');
    expect(await screen.findByText(/รอตรวจสอบ/)).toBeInTheDocument();

    // Attempt to reopen own completed task
    await user.click(screen.getByText('staff-reopen-t101'));
    expect(screen.getByTestId('t101-status')).toHaveTextContent('completed');
    expect(await screen.findByText(/อนุมัติเสร็จสิ้นแล้ว/)).toBeInTheDocument();

    // Staff cannot approve review task
    await user.click(screen.getByText('approve-t104'));
    expect(screen.getByTestId('t104-status')).toHaveTextContent('review');
  });

  it('allows Supervisor to approve and reject review tasks in visible projects', async () => {
    const user = userEvent.setup();
    mountApp();

    await user.click(screen.getByText('login-supervisor'));
    await waitFor(() => expect(screen.getByTestId('user-role')).toHaveTextContent('supervisor'));
    expect(screen.getByTestId('visible-projects')).toHaveTextContent('p1,p2');

    await user.click(screen.getByText('approve-t104'));
    await waitFor(() => expect(screen.getByTestId('t104-status')).toHaveTextContent('completed'));
  });

  it('allows Supervisor to reject review tasks back to in_progress', async () => {
    const user = userEvent.setup();
    mountApp();

    await user.click(screen.getByText('login-supervisor'));
    await waitFor(() => expect(screen.getByTestId('user-role')).toHaveTextContent('supervisor'));

    await user.click(screen.getByText('reject-t104'));
    await waitFor(() => expect(screen.getByTestId('t104-status')).toHaveTextContent('in_progress'));
  });

  it('catches rejected repository loadAll and mutation promises and surfaces Thai error toast (Important #6)', async () => {
    const user = userEvent.setup();
    const repo = new LocalStorageRepository(() => '2026-11-20');
    const auth = new LocalAuthService(repo);
    await auth.loginAsDemoUser('u2');

    // Wrap repository so updateTask rejects (simulating API / QuotaExceededError)
    const failingRepo = Object.assign(Object.create(Object.getPrototypeOf(repo)), repo, {
      updateTask: async () => {
        throw new Error('พื้นที่จัดเก็บเต็ม');
      },
    });

    render(
      <ToastProvider>
        <AuthProvider authService={auth}>
          <WorkspaceProvider repository={failingRepo}>
            <Harness />
          </WorkspaceProvider>
        </AuthProvider>
      </ToastProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('user-role')).toHaveTextContent('supervisor'));
    await user.click(screen.getByText('approve-t104'));

    expect(await screen.findByText(/พื้นที่จัดเก็บเต็ม/)).toBeInTheDocument();
  });
});
