import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocalStorageRepository } from '../../services/workspaceRepository';
import { LocalAuthService } from '../../services/authService';
import { ToastProvider } from '../ToastContext';
import { AuthProvider, useAuth } from '../AuthContext';
import { WorkspaceProvider, useWorkspace } from '../WorkspaceContext';

const newMilestone = {
  projectId: 'p1',
  title: 'เฟสจากเทสต์',
  ownerId: 'u2',
  startDate: '2026-12-01',
  endDate: '2026-12-10',
  progress: 10,
};

function Harness() {
  const { currentUser, loginAsDemoUser } = useAuth();
  const { visibleMilestones, createMilestone, updateMilestone, deleteMilestone } = useWorkspace();

  return (
    <div>
      <div data-testid="user-role">{currentUser?.role ?? 'none'}</div>
      <div data-testid="count">{visibleMilestones.length}</div>
      <div data-testid="titles">{visibleMilestones.map((m) => m.title).join('|')}</div>
      <div data-testid="m102-progress">
        {visibleMilestones.find((m) => m.id === 'm102')?.progress ?? 'hidden'}
      </div>
      <button type="button" onClick={() => loginAsDemoUser('u3')}>login-staff</button>
      <button type="button" onClick={() => loginAsDemoUser('u2')}>login-supervisor</button>
      <button type="button" onClick={() => createMilestone(newMilestone)}>create</button>
      <button type="button" onClick={() => updateMilestone('m102', { progress: 90 })}>update-m102</button>
      <button type="button" onClick={() => updateMilestone('m301', { progress: 90 })}>update-m301</button>
      <button type="button" onClick={() => deleteMilestone('m103')}>delete-m103</button>
    </div>
  );
}

describe('WorkspaceContext milestones', () => {
  let repo: LocalStorageRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new LocalStorageRepository(() => '2026-11-20');
  });

  function mountApp() {
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

  it('lets the owning supervisor create, update, and delete milestones in visible projects', async () => {
    const user = userEvent.setup();
    mountApp();

    await user.click(screen.getByText('login-supervisor'));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('6'));

    await user.click(screen.getByText('create'));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('7'));
    expect(screen.getByTestId('titles')).toHaveTextContent('เฟสจากเทสต์');

    await user.click(screen.getByText('update-m102'));
    await waitFor(() => expect(screen.getByTestId('m102-progress')).toHaveTextContent('90'));

    await user.click(screen.getByText('delete-m103'));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('6'));

    // Supervisor u2 is not part of p3, so m301 is neither visible nor editable
    await user.click(screen.getByText('update-m301'));
    expect(await screen.findByText(/ไม่มีสิทธิ์จัดการ Milestone/)).toBeInTheDocument();
    expect((await repo.loadAll()).milestones.find((m) => m.id === 'm301')?.progress).toBe(70);
  });

  it('shows staff their projects milestones but blocks every change', async () => {
    const user = userEvent.setup();
    mountApp();

    await user.click(screen.getByText('login-staff'));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('5'));

    await user.click(screen.getByText('create'));
    await user.click(screen.getByText('update-m102'));
    await user.click(screen.getByText('delete-m103'));
    expect((await screen.findAllByText(/ไม่มีสิทธิ์จัดการ Milestone/)).length).toBeGreaterThan(0);

    const snap = await repo.loadAll();
    expect(snap.milestones).toHaveLength(8);
    expect(snap.milestones.find((m) => m.id === 'm102')?.progress).toBe(65);
    expect(screen.getByTestId('count')).toHaveTextContent('5');
  });
});
