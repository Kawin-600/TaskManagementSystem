import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LocalStorageRepository } from '../../services/workspaceRepository';
import { LocalAuthService } from '../../services/authService';
import { ToastProvider } from '../../state/ToastContext';
import { AuthProvider } from '../../state/AuthContext';
import { WorkspaceProvider } from '../../state/WorkspaceContext';
import { RoadmapBoard } from '../../components/schedule/RoadmapBoard';
import type { Milestone, Project, User } from '../../types/models';
import { GlobalSchedulePage } from '../GlobalSchedulePage';

async function mountSchedule(
  userId: string,
  prepare?: (repo: LocalStorageRepository) => Promise<void>,
) {
  localStorage.clear();
  const repo = new LocalStorageRepository(() => '2026-11-20');
  await prepare?.(repo);
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
  return { repo, user };
}

describe('Roadmap view on the global schedule page', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 20, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows stats, grouped bars and the today line for visible projects only', async () => {
    const { user } = await mountSchedule('u2');

    await waitFor(() => expect(screen.getByTestId('roadmap-stat-total')).toHaveTextContent('6'));
    expect(screen.getByTestId('roadmap-stat-completed')).toHaveTextContent('2');
    expect(screen.getByTestId('roadmap-stat-in-progress')).toHaveTextContent('1');
    expect(screen.getByTestId('roadmap-stat-delayed')).toHaveTextContent('1');

    expect(screen.getByText('กรอบเวลาแผนงาน: พฤศจิกายน – ธันวาคม 2569')).toBeInTheDocument();
    expect(screen.getByTestId('roadmap-bar-m102')).toHaveAttribute('data-status', 'in_progress');
    expect(screen.getByTestId('roadmap-bar-m202')).toHaveAttribute('data-status', 'delayed');
    expect(screen.getByTestId('roadmap-project-progress-p1')).toHaveTextContent('55%');
    expect(screen.getByTestId('roadmap-today-line')).toBeInTheDocument();

    // p3 is not visible to supervisor u2
    expect(screen.queryByTestId('roadmap-row-m301')).not.toBeInTheDocument();
    // task-only filters are hidden in roadmap mode
    expect(screen.queryByLabelText(/กรองสถานะ/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/กรองผู้รับผิดชอบ/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/กรองโปรเจค/), 'p2');
    expect(screen.getByTestId('roadmap-stat-total')).toHaveTextContent('3');
    expect(screen.queryByTestId('roadmap-row-m102')).not.toBeInTheDocument();
  });

  it('keeps rows but drops bars and the today line outside the two-month window', async () => {
    const { user } = await mountSchedule('u2');
    await screen.findByTestId('roadmap-bar-m101');

    await user.click(screen.getByRole('button', { name: /เดือนถัดไป/ }));
    await user.click(screen.getByRole('button', { name: /เดือนถัดไป/ }));

    expect(screen.getByText('กรอบเวลาแผนงาน: มกราคม – กุมภาพันธ์ 2570')).toBeInTheDocument();
    expect(screen.getByTestId('roadmap-row-m101')).toBeInTheDocument();
    expect(screen.queryByTestId('roadmap-bar-m101')).not.toBeInTheDocument();
    expect(screen.queryByTestId('roadmap-today-line')).not.toBeInTheDocument();
    // stats are not limited to the visible window
    expect(screen.getByTestId('roadmap-stat-total')).toHaveTextContent('6');
  });

  it('lets a project supervisor add, edit and delete milestones', async () => {
    const { user, repo } = await mountSchedule('u2');
    await screen.findByTestId('roadmap-bar-m102');

    // Add
    await user.click(screen.getByRole('button', { name: /เพิ่ม Milestone ใหม่/ }));
    const addDialog = await screen.findByRole('dialog', { name: 'เพิ่ม Milestone ใหม่' });

    await user.click(within(addDialog).getByRole('button', { name: 'เพิ่ม Milestone' }));
    expect(within(addDialog).getByRole('alert')).toHaveTextContent('กรุณาระบุชื่อ Milestone');

    await user.type(within(addDialog).getByLabelText(/ชื่อ Milestone/), 'ส่งมอบงานและอบรมผู้ใช้');
    fireEvent.change(within(addDialog).getByLabelText(/วันเริ่มต้น/), {
      target: { value: '2026-12-10' },
    });
    fireEvent.change(within(addDialog).getByLabelText(/วันสิ้นสุด/), {
      target: { value: '2026-12-01' },
    });
    await user.click(within(addDialog).getByRole('button', { name: 'เพิ่ม Milestone' }));
    expect(within(addDialog).getByRole('alert')).toHaveTextContent(
      'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น',
    );

    fireEvent.change(within(addDialog).getByLabelText(/วันสิ้นสุด/), {
      target: { value: '2026-12-20' },
    });
    await user.click(within(addDialog).getByRole('button', { name: 'เพิ่ม Milestone' }));

    await waitFor(() => expect(screen.getByTestId('roadmap-stat-total')).toHaveTextContent('7'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByText('ส่งมอบงานและอบรมผู้ใช้').length).toBeGreaterThan(0);

    // Edit by clicking a bar
    await user.click(screen.getByTestId('roadmap-bar-m102'));
    const editDialog = await screen.findByRole('dialog', { name: 'แก้ไข Milestone' });
    expect(within(editDialog).getByLabelText(/โปรเจค/)).toBeDisabled();
    fireEvent.change(within(editDialog).getByLabelText('ความคืบหน้า (%)'), {
      target: { value: '100' },
    });
    await user.click(within(editDialog).getByRole('button', { name: 'บันทึกการแก้ไข' }));

    await waitFor(() =>
      expect(screen.getByTestId('roadmap-bar-m102')).toHaveAttribute('data-status', 'completed'),
    );
    expect(screen.getByTestId('roadmap-stat-completed')).toHaveTextContent('3');

    // Delete from the list view
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: /รายการเฟสงาน/ }));
    const row = screen.getByTestId('roadmap-list-row-m103');
    expect(within(row).getByText('รอเริ่ม')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: /^ลบ / }));

    await waitFor(() => expect(screen.getByTestId('roadmap-stat-total')).toHaveTextContent('6'));
    expect((await repo.loadAll()).milestones.some((m) => m.id === 'm103')).toBe(false);
  });

  it('is read-only for staff', async () => {
    const { user } = await mountSchedule('u3');

    await waitFor(() => expect(screen.getByTestId('roadmap-stat-total')).toHaveTextContent('5'));
    expect(screen.queryByRole('button', { name: /เพิ่ม Milestone ใหม่/ })).not.toBeInTheDocument();

    const bar = screen.getByTestId('roadmap-bar-m102');
    expect(bar.tagName).toBe('DIV');
    await user.click(bar);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /รายการเฟสงาน/ }));
    expect(screen.queryByRole('button', { name: /^ลบ / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^แก้ไข / })).not.toBeInTheDocument();
  });

  it('shows an empty state when the selected projects have no milestones', async () => {
    await mountSchedule('u2', async (repo) => {
      for (const id of ['m101', 'm102', 'm103', 'm201', 'm202', 'm203']) {
        await repo.deleteMilestone(id);
      }
    });

    expect(await screen.findByText('ยังไม่มี Milestone ในโปรเจคที่เลือก')).toBeInTheDocument();
    expect(screen.getByTestId('roadmap-stat-total')).toHaveTextContent('0');
    expect(screen.getByRole('button', { name: /เพิ่ม Milestone ใหม่/ })).toBeInTheDocument();
  });
});

describe('RoadmapBoard', () => {
  const project: Project = {
    id: 'p1',
    name: 'ระบบ CRM',
    description: '',
    color: '#4f46e5',
    supervisorId: 'u2',
    memberIds: ['u2'],
  };
  const users: User[] = [
    { id: 'u2', name: 'วิภาวดี', email: 's@t', role: 'supervisor', avatar: 'วิ', color: 'indigo' },
  ];
  const make = (
    id: string,
    startDate: string,
    endDate: string,
    progress: number,
    phase: number,
  ): Milestone => ({
    id,
    projectId: 'p1',
    title: `เฟส ${id}`,
    ownerId: 'u2',
    startDate,
    endDate,
    progress,
    phase,
    createdAt: '2026-11-01',
  });
  const milestones = [
    make('a', '2026-11-01', '2026-11-12', 100, 1),
    make('b', '2026-11-13', '2026-11-27', 65, 2),
    make('c', '2026-11-28', '2026-12-15', 10, 3),
  ];

  it('averages project progress and only makes bars clickable for managers', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <RoadmapBoard
        yearMonth="2026-11"
        todayStr="2026-11-20"
        projects={[project]}
        milestones={milestones}
        users={users}
        canManageProject={() => true}
        onMilestoneClick={onClick}
      />,
    );

    expect(screen.getByTestId('roadmap-project-progress-p1')).toHaveTextContent('58%');
    expect(within(screen.getByTestId('roadmap-row-b')).getByText('Phase 2', { selector: 'span.shrink-0' })).toBeInTheDocument();
    await user.click(screen.getByTestId('roadmap-bar-b'));
    expect(onClick).toHaveBeenCalledWith(milestones[1]);

    onClick.mockClear();
    rerender(
      <RoadmapBoard
        yearMonth="2026-11"
        todayStr="2026-11-20"
        projects={[project]}
        milestones={milestones}
        users={users}
        canManageProject={() => false}
        onMilestoneClick={onClick}
      />,
    );
    await user.click(screen.getByTestId('roadmap-bar-b'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
