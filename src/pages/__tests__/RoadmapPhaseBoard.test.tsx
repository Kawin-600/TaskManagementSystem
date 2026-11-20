import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LocalStorageRepository } from '../../services/workspaceRepository';
import { LocalAuthService } from '../../services/authService';
import { ToastProvider } from '../../state/ToastContext';
import { AuthProvider } from '../../state/AuthContext';
import { WorkspaceProvider } from '../../state/WorkspaceContext';
import { GlobalSchedulePage } from '../GlobalSchedulePage';

async function mountPhaseBoard(userId: string) {
  localStorage.clear();
  const repo = new LocalStorageRepository(() => '2026-11-20');
  const auth = new LocalAuthService(repo);
  await auth.loginAsDemoUser(userId);
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <ToastProvider>
        <AuthProvider authService={auth}>
          <WorkspaceProvider repository={repo}>
            <GlobalSchedulePage onOpenCreateTask={vi.fn()} onOpenTaskDetail={vi.fn()} />
          </WorkspaceProvider>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
  await user.click(await screen.findByRole('button', { name: /แผนงาน \(Roadmap\)/ }));
  await user.click(screen.getByRole('button', { name: 'บอร์ดเฟส' }));
  await screen.findByTestId('phase-card-m101');
  return { repo, user };
}

function dragCardTo(cardId: string, columnTestId: string) {
  fireEvent.dragStart(screen.getByTestId(`phase-card-${cardId}`), {
    dataTransfer: { setData: vi.fn(), getData: () => cardId },
  });
  fireEvent.drop(screen.getByTestId(columnTestId), {
    dataTransfer: { getData: () => cardId },
  });
}

describe('Roadmap phase board', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 20, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows one column per phase and lets a supervisor drag cards between phases', async () => {
    const { user, repo } = await mountPhaseBoard('u2');

    const phase1 = screen.getByTestId('phase-col-p1-1');
    expect(within(phase1).getByText('Phase 1')).toBeInTheDocument();
    expect(within(phase1).getByTestId('phase-card-m101')).toBeInTheDocument();
    expect(within(screen.getByTestId('phase-col-p1-2')).getByTestId('phase-card-m102')).toBeInTheDocument();
    expect(screen.getByTestId('phase-col-p1-3')).toBeInTheDocument();

    // Two milestones can share Phase 1; the emptied phase closes up
    dragCardTo('m102', 'phase-col-p1-1');
    await waitFor(() =>
      expect(screen.getByTestId('phase-card-m102')).toHaveAttribute('data-phase', '1'),
    );
    const sharedPhase = screen.getByTestId('phase-col-p1-1');
    expect(within(sharedPhase).getByTestId('phase-card-m101')).toBeInTheDocument();
    expect(within(sharedPhase).getByTestId('phase-card-m102')).toBeInTheDocument();
    expect(screen.getByTestId('phase-card-m103')).toHaveAttribute('data-phase', '2');
    expect(screen.queryByTestId('phase-col-p1-3')).not.toBeInTheDocument();

    // Dropping on the dashed column opens a new last phase
    dragCardTo('m101', 'phase-col-p1-new');
    await waitFor(() =>
      expect(screen.getByTestId('phase-card-m101')).toHaveAttribute('data-phase', '3'),
    );

    // A card cannot be dropped into another project's phase
    dragCardTo('m201', 'phase-col-p1-1');
    await waitFor(async () =>
      expect((await repo.loadAll()).milestones.find((m) => m.id === 'm201')).toMatchObject({
        projectId: 'p2',
        phase: 1,
      }),
    );

    // The timeline labels follow the board
    await user.click(screen.getByRole('button', { name: 'ไทม์ไลน์ (Gantt)' }));
    expect(
      within(screen.getByTestId('roadmap-row-m102')).getAllByText('Phase 1').length,
    ).toBeGreaterThan(0);
    expect(
      within(screen.getByTestId('roadmap-row-m101')).getAllByText('Phase 3').length,
    ).toBeGreaterThan(0);
  });

  it('adds a milestone straight into the clicked phase', async () => {
    const { user } = await mountPhaseBoard('u2');

    await user.click(
      within(screen.getByTestId('phase-col-p2-2')).getByRole('button', { name: /เพิ่ม Milestone ใน Phase 2/ }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'เพิ่ม Milestone ใหม่' });
    expect(within(dialog).getByLabelText(/โปรเจค/)).toHaveValue('p2');
    expect(within(dialog).getByLabelText(/^Phase/)).toHaveValue('2');

    await user.type(within(dialog).getByLabelText(/ชื่อ Milestone/), 'ปรับแต่งโมเดลรอบสอง');
    await user.click(within(dialog).getByRole('button', { name: 'เพิ่ม Milestone' }));

    const phase2 = await screen.findByTestId('phase-col-p2-2');
    await waitFor(() =>
      expect(within(phase2).getByText('ปรับแต่งโมเดลรอบสอง')).toBeInTheDocument(),
    );
    expect(within(phase2).getByTestId('phase-card-m202')).toBeInTheDocument();
  });

  it('is read-only for staff', async () => {
    const { user, repo } = await mountPhaseBoard('u3');

    expect(screen.getByTestId('phase-card-m102')).toHaveAttribute('draggable', 'false');
    expect(screen.queryByTestId('phase-col-p1-new')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /เพิ่ม Milestone ใน Phase/ })).not.toBeInTheDocument();

    dragCardTo('m102', 'phase-col-p1-1');
    await user.click(screen.getByTestId('phase-card-m102'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect((await repo.loadAll()).milestones.find((m) => m.id === 'm102')?.phase).toBe(2);
  });
});
