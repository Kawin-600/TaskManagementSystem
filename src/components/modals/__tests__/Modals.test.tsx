import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocalStorageRepository } from '../../../services/workspaceRepository';
import { LocalAuthService } from '../../../services/authService';
import { ToastProvider } from '../../../state/ToastContext';
import { AuthProvider } from '../../../state/AuthContext';
import { WorkspaceProvider } from '../../../state/WorkspaceContext';
import { CreateTaskModal } from '../CreateTaskModal';
import { TaskDetailModal } from '../TaskDetailModal';
import { ProjectFormModal } from '../ProjectFormModal';
import { ProjectMembersModal } from '../ProjectMembersModal';
import { CreateUserModal } from '../CreateUserModal';

async function setupUser(userId: string) {
  localStorage.clear();
  const repo = new LocalStorageRepository(() => '2026-11-20');
  const auth = new LocalAuthService(repo);
  await auth.loginAsDemoUser(userId);
  return { repo, auth };
}

function wrap(repo: LocalStorageRepository, auth: LocalAuthService, ui: JSX.Element) {
  return render(
    <ToastProvider>
      <AuthProvider authService={auth}>
        <WorkspaceProvider repository={repo}>{ui}</WorkspaceProvider>
      </AuthProvider>
    </ToastProvider>,
  );
}

describe('Center Modals Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('CreateTaskModal updates live duration, blocks invalid dates/blank title preserving inputs (Review Focus #5)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { repo, auth } = await setupUser('u2');

    wrap(
      repo,
      auth,
      <CreateTaskModal isOpen={true} onClose={onClose} defaultProjectId="p1" defaultStartDate="2026-11-20" />,
    );

    await waitFor(() => expect(screen.getByText('5 วัน')).toBeInTheDocument());

    // Change dueDate before startDate -> invalid
    const titleInput = screen.getByLabelText(/หัวข้องาน/i) as HTMLInputElement;
    await user.type(titleInput, 'งานทดสอบวันที่');
    const dueInput = screen.getByLabelText(/วันกำหนดส่ง/i) as HTMLInputElement;
    fireEvent.change(dueInput, { target: { value: '2026-11-18' } });

    await user.click(screen.getByRole('button', { name: /บันทึกสร้างงาน/i }));
    expect(screen.getAllByText(/วันกำหนดส่งต้องไม่น้อยกว่าวันเริ่มต้น/).length).toBeGreaterThan(0);
    expect(onClose).not.toHaveBeenCalled();
    expect(titleInput.value).toBe('งานทดสอบวันที่');

    // Fix dueDate -> duration updates to 3 วัน, but test blank title blocked
    fireEvent.change(dueInput, { target: { value: '2026-11-22' } });
    expect(screen.getByText('3 วัน')).toBeInTheDocument();
    await user.clear(titleInput);
    await user.type(titleInput, '   ');
    await user.click(screen.getByRole('button', { name: /บันทึกสร้างงาน/i }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('lets a collaborator save their own detail without changing another collaborator’s entry', async () => {
    const { repo, auth } = await setupUser('u4');
    await repo.updateTask('t102', { collaboratorIds: ['u4', 'u2'] });
    await repo.saveCollaboratorDetail('t102', 'u2', 'ตรวจแบบ');
    wrap(repo, auth, <TaskDetailModal taskId="t102" onClose={vi.fn()} />);
    const field = await screen.findByLabelText('รายละเอียดเพิ่มเติมของฉัน');
    expect(screen.getByText('ตรวจแบบ')).toBeInTheDocument();
    fireEvent.change(field, { target: { value: 'จัดทำต้นฉบับ' } });
    await userEvent.click(screen.getByRole('button', { name: 'บันทึกรายละเอียดของฉัน' }));
    const task = (await repo.loadAll()).tasks.find(item => item.id === 't102');
    expect(task?.collaboratorDetails).toEqual({ u2: 'ตรวจแบบ', u4: 'จัดทำต้นฉบับ' });
  });

  it('shows staff the due date and status without planning controls', async () => {
    const { repo, auth } = await setupUser('u3');
    wrap(repo, auth, <TaskDetailModal taskId="t102" onClose={vi.fn()} />);
    expect(await screen.findByLabelText(/ชื่องาน/)).toBeEnabled();
    expect(screen.queryByLabelText(/Milestone/i)).not.toBeInTheDocument();
    expect(screen.queryByText('แผนการดำเนินงาน')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/วันเริ่มต้น/)).not.toBeInTheDocument();
    expect(screen.getByText(/^กำหนดส่ง/)).toBeInTheDocument();
    expect(screen.getByLabelText('สถานะ')).toBeEnabled();
  });

  it('TaskDetailModal locks completed tasks for Staff, allows safe linkified comments, and blocks javascript: links (Review Focus #5)', async () => {
    const user = userEvent.setup();
    const { repo, auth } = await setupUser('u3'); // Staff

    // t101 is Staff u3's own completed task
    wrap(repo, auth, <TaskDetailModal taskId="t101" onClose={vi.fn()} />);

    const titleInput = (await screen.findByLabelText(/ชื่องาน/i)) as HTMLInputElement;
    const statusSelect = screen.getByLabelText(/สถานะ/i) as HTMLSelectElement;
    expect(titleInput.disabled).toBe(true);
    expect(statusSelect.disabled).toBe(true);
    expect(screen.getByText(/หัวหน้างานหรือ Admin/)).toBeInTheDocument();

    // Comments remain enabled even on completed tasks
    const commentInput = screen.getByPlaceholderText(/พิมพ์ข้อความ/i);
    await user.type(
      commentInput,
      'ส่งลิงก์ https://figma.com/file/abc และ javascript:alert(1)',
    );
    await user.click(screen.getByRole('button', { name: /^ส่ง$/ }));

    const link = await screen.findByRole('link', { name: 'https://figma.com/file/abc' });
    expect(link).toHaveAttribute('href', 'https://figma.com/file/abc');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('link', { name: /javascript:/i })).not.toBeInTheDocument();
    expect(screen.getByText(/javascript:alert\(1\)/)).toBeInTheDocument();
  });

  it('TaskDetailModal lets Supervisor approve a review task directly', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { repo, auth } = await setupUser('u2');

    wrap(repo, auth, <TaskDetailModal taskId="t104" onClose={onClose} />);
    const approveBtn = await screen.findByRole('button', { name: /อนุมัติงาน/i });
    await user.click(approveBtn);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const after = await repo.loadAll();
    expect(after.tasks.find((t) => t.id === 't104')?.status).toBe('completed');
  });

  it('ProjectFormModal locks supervisor checkbox and ProjectMembersModal warns & reassigns removed member tasks', async () => {
    const user = userEvent.setup();
    const { repo, auth } = await setupUser('u2');

    const { unmount } = wrap(repo, auth, <ProjectFormModal isOpen={true} onClose={vi.fn()} />);
    const supCheckbox = await screen.findByLabelText(/วิภาวดี รักงาน/);
    expect(supCheckbox).toBeChecked();
    expect(supCheckbox).toBeDisabled();
    unmount();

    // ProjectMembersModal for Supervisor on p1: uncheck Staff u3 who owns active tasks
    const onCloseMembers = vi.fn();
    wrap(repo, auth, <ProjectMembersModal projectId="p1" onClose={onCloseMembers} />);

    const u3Box = await screen.findByLabelText(/กิตติพงษ์ ขยันยิ่ง/);
    await user.click(u3Box);
    expect(await screen.findByText(/จะถูกโอนให้หัวหน้าโปรเจคโดยอัตโนมัติ/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /บันทึกสมาชิก/i }));
    await waitFor(() => expect(onCloseMembers).toHaveBeenCalled());

    const after = await repo.loadAll();
    expect(after.projects.find((p) => p.id === 'p1')?.memberIds).not.toContain('u3');
    expect(after.tasks.filter((t) => t.projectId === 'p1' && t.assigneeId === 'u3')).toHaveLength(0);
  });

  it('ProjectMembersModal renders read-only for Staff and CreateUserModal creates a new user for Admin', async () => {
    const user = userEvent.setup();
    const { repo: repoStaff, auth: authStaff } = await setupUser('u3');
    const { unmount } = wrap(repoStaff, authStaff, <ProjectMembersModal projectId="p1" onClose={vi.fn()} />);
    await screen.findByText(/วิภาวดี รักงาน/);
    expect(screen.queryByRole('button', { name: /บันทึกสมาชิก/i })).not.toBeInTheDocument();
    unmount();

    const { repo: repoAdmin, auth: authAdmin } = await setupUser('u1');
    const onCloseUser = vi.fn();
    wrap(repoAdmin, authAdmin, <CreateUserModal isOpen={true} onClose={onCloseUser} />);

    await user.type(screen.getByLabelText(/ชื่อ-นามสกุล/i), 'อภิสิทธิ์ ขยันทำ');
    await user.type(screen.getByLabelText(/อีเมล/i), 'apisit@taskflow.local');
    await user.click(screen.getByRole('button', { name: /เพิ่มสมาชิก/i }));

    await waitFor(() => expect(onCloseUser).toHaveBeenCalled());
    const after = await repoAdmin.loadAll();
    expect(after.users.some((u) => u.email === 'apisit@taskflow.local')).toBe(true);
  });

  it('TaskDetailModal preserves unsaved task edits when posting a comment (Important #1)', async () => {
    const user = userEvent.setup();
    const { repo, auth } = await setupUser('u2');

    wrap(repo, auth, <TaskDetailModal taskId="t103" onClose={vi.fn()} />);

    const titleInput = (await screen.findByLabelText(/ชื่องาน/i)) as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, 'หัวข้องานที่ยังไม่กดบันทึก');

    const commentInput = screen.getByPlaceholderText(/พิมพ์ข้อความ/i);
    await user.type(commentInput, 'แนบความคืบหน้าครับ');
    await user.click(screen.getByRole('button', { name: /^ส่ง$/ }));

    expect(await screen.findByText('แนบความคืบหน้าครับ')).toBeInTheDocument();
    expect(titleInput.value).toBe('หัวข้องานที่ยังไม่กดบันทึก');
  });

  it('CreateTaskModal and TaskDetailModal block empty dates with Thai validation feedback (Important #4)', async () => {
    const user = userEvent.setup();
    const onCloseCreate = vi.fn();
    const { repo, auth } = await setupUser('u2');

    const { unmount } = wrap(
      repo,
      auth,
      <CreateTaskModal isOpen={true} onClose={onCloseCreate} defaultProjectId="p1" />,
    );

    const titleInput = await screen.findByLabelText(/หัวข้องาน/i);
    await user.type(titleInput, 'งานทดสอบวันว่าง');
    fireEvent.change(screen.getByLabelText(/วันเริ่มต้น/i), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: /บันทึกสร้างงาน/i }));

    expect(await screen.findByText(/กรุณาระบุวันเริ่มต้นและวันกำหนดส่ง/)).toBeInTheDocument();
    expect(onCloseCreate).not.toHaveBeenCalled();
    unmount();

    const onCloseDetail = vi.fn();
    wrap(repo, auth, <TaskDetailModal taskId="t103" onClose={onCloseDetail} />);
    await screen.findByLabelText(/ชื่องาน/i);
    fireEvent.change(screen.getByLabelText(/วันกำหนดส่ง/i), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: /บันทึกการแก้ไข/i }));

    expect(await screen.findByText(/กรุณาระบุวันเริ่มต้นและวันกำหนดส่ง/)).toBeInTheDocument();
    expect(onCloseDetail).not.toHaveBeenCalled();
  });

  it('ProjectFormModal and CreateUserModal show inline Thai validation on whitespace/invalid email and support edit mode (Important #4 & #8)', async () => {
    const user = userEvent.setup();
    const onCloseProj = vi.fn();
    const { repo, auth } = await setupUser('u1');

    const { unmount } = wrap(repo, auth, <ProjectFormModal isOpen={true} onClose={onCloseProj} />);
    const nameInput = (await screen.findByLabelText(/ชื่อโปรเจค/i)) as HTMLInputElement;
    await user.type(nameInput, '   ');
    await user.click(screen.getByRole('button', { name: /บันทึกโปรเจค/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/กรุณาระบุชื่อโปรเจค/);
    expect(onCloseProj).not.toHaveBeenCalled();
    unmount();

    // Edit existing project
    const snap = await repo.loadAll();
    const p1 = snap.projects.find((p) => p.id === 'p1')!;
    const onCloseEditProj = vi.fn();
    const { unmount: unmountEdit } = wrap(
      repo,
      auth,
      <ProjectFormModal isOpen={true} project={p1} onClose={onCloseEditProj} />,
    );
    const editName = (await screen.findByLabelText(/ชื่อโปรเจค/i)) as HTMLInputElement;
    await user.clear(editName);
    await user.type(editName, 'Mobile Banking 3.5');
    await user.click(screen.getByRole('button', { name: /บันทึกการแก้ไข/i }));
    await waitFor(() => expect(onCloseEditProj).toHaveBeenCalled());
    expect((await repo.loadAll()).projects.find((p) => p.id === 'p1')?.name).toBe('Mobile Banking 3.5');
    unmountEdit();

    // CreateUserModal whitespace & invalid email validation
    const onCloseUser = vi.fn();
    wrap(repo, auth, <CreateUserModal isOpen={true} onClose={onCloseUser} />);
    await user.type(screen.getByLabelText(/ชื่อ-นามสกุล/i), 'สมหญิง');
    await user.type(screen.getByLabelText(/อีเมล/i), 'invalid-email');
    await user.click(screen.getByRole('button', { name: /เพิ่มสมาชิก/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/อีเมลไม่ถูกต้อง/);
    expect(onCloseUser).not.toHaveBeenCalled();
  });

  it('TaskDetailModal saves edits and requires confirmation before deleting (Important #8)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { repo, auth } = await setupUser('u2');

    const { unmount } = wrap(repo, auth, <TaskDetailModal taskId="t103" onClose={onClose} />);
    const titleInput = (await screen.findByLabelText(/ชื่องาน/i)) as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, 'พัฒนาหน้าแรกเวอร์ชันใหม่');
    await user.click(screen.getByRole('button', { name: /บันทึกการแก้ไข/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await repo.loadAll()).tasks.find((t) => t.id === 't103')?.title).toBe('พัฒนาหน้าแรกเวอร์ชันใหม่');
    unmount();

    const onCloseDel = vi.fn();
    wrap(repo, auth, <TaskDetailModal taskId="t105" onClose={onCloseDel} />);
    await user.click(await screen.findByRole('button', { name: /ลบงานนี้/i }));
    expect(screen.getByText(/ยืนยันลบงานนี้/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /ลบเลย/i }));
    await waitFor(() => expect(onCloseDel).toHaveBeenCalled());
    expect((await repo.loadAll()).tasks.some((t) => t.id === 't105')).toBe(false);
  });
});
