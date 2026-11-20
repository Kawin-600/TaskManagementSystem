import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { addDays, calculateDaysBetween, getTodayStr } from '../../domain/dates';
import { getAssignableMembers } from '../../domain/rbac';
import { useAuth } from '../../state/AuthContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import type { TaskPriority } from '../../types/models';
import { Modal } from '../ui/Modal';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  defaultStartDate?: string;
}

export function CreateTaskModal({
  isOpen,
  onClose,
  defaultProjectId,
  defaultStartDate,
}: CreateTaskModalProps) {
  const { currentUser } = useAuth();
  const { visibleProjects, users, createTask } = useWorkspace();

  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [startDate, setStartDate] = useState(defaultStartDate || getTodayStr());
  const [dueDate, setDueDate] = useState(addDays(defaultStartDate || getTodayStr(), 4));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const baseStart = defaultStartDate || getTodayStr();
    setProjectId(defaultProjectId ?? '');
    setTitle('');
    setDescription('');
    setAssigneeId('');
    setPriority('medium');
    setStartDate(baseStart);
    setDueDate(addDays(baseStart, 4));
    setFormError(null);
  }, [isOpen, defaultProjectId, defaultStartDate]);

  const effectiveProjectId =
    projectId && visibleProjects.some((p) => p.id === projectId)
      ? projectId
      : visibleProjects[0]?.id ?? '';

  const selectedProject = useMemo(
    () => visibleProjects.find((p) => p.id === effectiveProjectId),
    [visibleProjects, effectiveProjectId],
  );

  const assignableMembers = useMemo(() => {
    if (!currentUser || !selectedProject) return [];
    return getAssignableMembers(currentUser, selectedProject, users);
  }, [currentUser, selectedProject, users]);

  const effectiveAssigneeId =
    currentUser?.role === 'staff'
      ? currentUser.id
      : assignableMembers.some((u) => u.id === assigneeId)
        ? assigneeId
        : assignableMembers[0]?.id ?? '';

  if (!currentUser) return null;

  const isInvalidDates = Boolean(startDate && dueDate && dueDate < startDate);
  const durationDays = isInvalidDates ? 0 : calculateDaysBetween(startDate, dueDate);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('กรุณาระบุหัวข้องาน');
      return;
    }
    if (!effectiveProjectId) {
      setFormError('กรุณาเลือกโปรเจค');
      return;
    }
    if (!startDate || !dueDate) {
      setFormError('กรุณาระบุวันเริ่มต้นและวันกำหนดส่ง');
      return;
    }
    if (dueDate < startDate) {
      setFormError('วันกำหนดส่งต้องไม่น้อยกว่าวันเริ่มต้น');
      return;
    }

    const created = await createTask({
      projectId: effectiveProjectId,
      title: title.trim(),
      description: description.trim(),
      assigneeId: effectiveAssigneeId,
      priority,
      startDate,
      dueDate,
    });
    if (created) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="สร้างงานใหม่" subtitle="กำหนดรายละเอียด ผู้รับผิดชอบ และระยะเวลาดำเนินงาน">
      <form onSubmit={handleSubmit} noValidate className="space-y-4 text-xs">
        {formError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div>
          <label htmlFor="create-task-project" className="mb-1 block font-semibold text-slate-700">
            โปรเจค *
          </label>
          <select
            id="create-task-project"
            value={effectiveProjectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
          >
            {visibleProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="create-task-title" className="mb-1 block font-semibold text-slate-700">
            หัวข้องาน *
          </label>
          <input
            id="create-task-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="เช่น พัฒนาหน้าชำระเงิน"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-800 outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="create-task-desc" className="mb-1 block font-semibold text-slate-700">
            รายละเอียดงาน
          </label>
          <textarea
            id="create-task-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="อธิบายรายละเอียดขอบเขตงาน..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-800 outline-none focus:border-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="create-task-assignee" className="mb-1 block font-semibold text-slate-700">
              ผู้รับผิดชอบ *
            </label>
            <select
              id="create-task-assignee"
              value={effectiveAssigneeId}
              disabled={currentUser.role === 'staff'}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              {assignableMembers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            {currentUser.role === 'staff' && (
              <p className="mt-1 text-[10px] text-slate-400">
                เจ้าหน้าที่สามารถสร้างงานให้ตนเองเท่านั้น
              </p>
            )}
          </div>

          <div>
            <label htmlFor="create-task-priority" className="mb-1 block font-semibold text-slate-700">
              ความสำคัญ *
            </label>
            <select
              id="create-task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800"
            >
              <option value="low">ต่ำ</option>
              <option value="medium">ปานกลาง</option>
              <option value="high">สูง</option>
              <option value="urgent">ด่วนที่สุด</option>
            </select>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="create-task-start" className="mb-1 block font-semibold text-indigo-900">
                วันเริ่มต้น (Start Date) *
              </label>
              <input
                id="create-task-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 font-medium text-slate-800"
              />
            </div>
            <div>
              <label htmlFor="create-task-due" className="mb-1 block font-semibold text-indigo-900">
                วันกำหนดส่ง (Due Date) *
              </label>
              <input
                id="create-task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 font-medium text-slate-800"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs font-semibold text-indigo-700">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              สรุประยะเวลาทำงาน:
            </span>
            {isInvalidDates ? (
              <span className="rounded-full bg-rose-600 px-2.5 py-1 font-mono text-[11px] text-white">
                วันกำหนดส่งต้องไม่น้อยกว่าวันเริ่มต้น
              </span>
            ) : (
              <span className="rounded-full bg-indigo-600 px-2.5 py-1 font-mono text-[11px] text-white">
                {durationDays} วัน
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="rounded-xl bg-indigo-600 px-5 py-2 font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            บันทึกสร้างงาน
          </button>
        </div>
      </form>
    </Modal>
  );
}
