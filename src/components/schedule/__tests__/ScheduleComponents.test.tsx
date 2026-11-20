import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Project, Task, User } from '../../../types/models';
import { CalendarBoard } from '../CalendarBoard';
import { TimelineGantt } from '../TimelineGantt';

const projects: Project[] = [
  { id: 'p1', name: 'Mobile Banking', description: '', color: '#4f46e5', supervisorId: 'u2', memberIds: ['u2', 'u3'] },
];

const users: User[] = [
  { id: 'u2', name: 'วิภาวดี รักงาน', email: 's@t.local', role: 'supervisor', avatar: 'วิ', color: 'indigo' },
  { id: 'u3', name: 'กิตติพงษ์ ขยันยิ่ง', email: 'k@t.local', role: 'staff', avatar: 'กต', color: 'emerald' },
];

const makeTask = (id: string, title: string, startDate: string, dueDate: string, status: Task['status'] = 'in_progress'): Task => ({
  id,
  projectId: 'p1',
  title,
  description: '',
  assigneeId: 'u3',
  status,
  priority: 'medium',
  startDate,
  dueDate,
  createdAt: startDate,
  comments: [],
});

describe('ScheduleComponents (CalendarBoard & TimelineGantt)', () => {
  it('CalendarBoard packs non-overlapping tasks into one lane row, shows overflow modal for >3 lanes, and respects canAddTaskOnDate', async () => {
    const user = userEvent.setup();
    const onTaskClick = vi.fn();
    const onAddTaskOnDate = vi.fn();

    const tasks = [
      makeTask('t1', 'งานต้นสัปดาห์', '2026-11-01', '2026-11-02'),
      makeTask('t2', 'งานปลายสัปดาห์', '2026-11-05', '2026-11-06'),
      makeTask('t3', 'งานซ้อน 2', '2026-11-02', '2026-11-05'),
      makeTask('t4', 'งานซ้อน 3', '2026-11-02', '2026-11-04'),
      makeTask('t5', 'งานล้นแถว 4', '2026-11-02', '2026-11-03'),
    ];

    const { rerender } = render(
      <CalendarBoard
        yearMonth="2026-11"
        todayStr="2026-11-20"
        tasks={tasks}
        projects={projects}
        canAddTaskOnDate={false}
        onTaskClick={onTaskClick}
        onAddTaskOnDate={onAddTaskOnDate}
      />,
    );

    // Both t1 and t2 share lane 0 -> single grid row
    const lane0 = screen.getAllByTestId('calendar-lane')[0];
    expect(lane0).toHaveTextContent('งานต้นสัปดาห์');
    expect(lane0).toHaveTextContent('งานปลายสัปดาห์');
    expect(screen.queryByTitle(/เพิ่มงานวันที่/)).not.toBeInTheDocument();

    // Overflow button opens modal showing the 4th lane task
    const overflowBtn = screen.getByRole('button', { name: /\+ อีก 1 งาน/ });
    await user.click(overflowBtn);
    expect(await screen.findByText('งานล้นแถว 4')).toBeInTheDocument();
    await user.click(screen.getByText('งานล้นแถว 4'));
    expect(onTaskClick).toHaveBeenCalledWith('t5');

    // When canAddTaskOnDate=true, hover add buttons appear
    rerender(
      <CalendarBoard
        yearMonth="2026-11"
        todayStr="2026-11-20"
        tasks={tasks}
        projects={projects}
        canAddTaskOnDate={true}
        onTaskClick={onTaskClick}
        onAddTaskOnDate={onAddTaskOnDate}
      />,
    );
    await user.click(screen.getByTitle('เพิ่มงานวันที่ 2026-11-20'));
    expect(onAddTaskOnDate).toHaveBeenCalledWith('2026-11-20');
  });

  it('TimelineGantt renders Today indicator line, triggers zoom/colorMode callbacks, and handles task clicks', async () => {
    const user = userEvent.setup();
    const onZoomChange = vi.fn();
    const onColorModeChange = vi.fn();
    const onTaskClick = vi.fn();

    const tasks = [makeTask('t1', 'พัฒนาหน้าแรก', '2026-11-10', '2026-11-22', 'review')];

    render(
      <TimelineGantt
        yearMonth="2026-11"
        todayStr="2026-11-20"
        tasks={tasks}
        projects={projects}
        users={users}
        zoom="normal"
        colorMode="status"
        onZoomChange={onZoomChange}
        onColorModeChange={onColorModeChange}
        onTaskClick={onTaskClick}
      />,
    );

    expect(screen.getByTestId('gantt-today-line')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'กว้าง' }));
    expect(onZoomChange).toHaveBeenCalledWith('wide');

    await user.click(screen.getByRole('button', { name: 'ตามโปรเจค' }));
    expect(onColorModeChange).toHaveBeenCalledWith('project');

    const bar = screen.getByTestId('gantt-bar-t1');
    expect(bar).toHaveStyle({ backgroundColor: '#f59e0b' });
    await user.click(bar);
    expect(onTaskClick).toHaveBeenCalledWith('t1');
  });
});
