import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';
import { addDays, getTodayStr } from '../../domain/dates';
import { canManageMilestones } from '../../domain/rbac';
import { getPhaseCount } from '../../domain/roadmap';
import { useAuth } from '../../state/AuthContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import type { Milestone } from '../../types/models';
import { Modal } from '../ui/Modal';

interface MilestoneFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestone?: Milestone | null;
  defaultProjectId?: string;
  /** Phase to preselect when adding; defaults to a new last phase. */
  defaultPhase?: number;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

const FIELD_CLASS =
  'w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-800 outline-none focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500';

export function MilestoneFormModal({
  isOpen,
  onClose,
  milestone,
  defaultProjectId,
  defaultPhase,
}: MilestoneFormModalProps) {
  const { currentUser } = useAuth();
  const {
    visibleProjects,
    visibleMilestones,
    users,
    createMilestone,
    updateMilestone,
    deleteMilestone,
  } = useWorkspace();

  const phaseCountOf = (pid: string) =>
    getPhaseCount(visibleMilestones.filter((m) => m.projectId === pid));

  const manageableProjects = useMemo(
    () =>
      currentUser ? visibleProjects.filter((p) => canManageMilestones(currentUser, p)) : [],
    [currentUser, visibleProjects],
  );

  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<number | null>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    setIsSaving(false);
    if (milestone) {
      setProjectId(milestone.projectId);
      setTitle(milestone.title);
      setOwnerId(milestone.ownerId);
      setStartDate(milestone.startDate);
      setEndDate(milestone.endDate);
      setProgress(milestone.progress);
      setPhase(milestone.phase);
    } else {
      const initialProject =
        manageableProjects.find((p) => p.id === defaultProjectId) ?? manageableProjects[0];
      const today = getTodayStr();
      setProjectId(initialProject?.id ?? '');
      setTitle('');
      setOwnerId(initialProject?.supervisorId ?? '');
      setStartDate(today);
      setEndDate(addDays(today, 13));
      setProgress(0);
      const nextPhase = initialProject ? phaseCountOf(initialProject.id) + 1 : 1;
      setPhase(defaultPhase && defaultPhase <= nextPhase ? defaultPhase : nextPhase);
    }
    // Reset only when the modal opens or targets a different milestone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, milestone]);

  if (!currentUser) return null;

  const project = visibleProjects.find((p) => p.id === projectId);
  const ownerOptions = project
    ? users.filter((u) => u.id === project.supervisorId || project.memberIds.includes(u.id))
    : [];

  const existingPhaseCount = projectId ? phaseCountOf(projectId) : 0;
  const phaseOptions = Array.from(
    { length: Math.max(existingPhaseCount + 1, phase ?? 1) },
    (_unused, index) => index + 1,
  );

  const handleProjectChange = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    const next = manageableProjects.find((p) => p.id === nextProjectId);
    const stillValid =
      next && (next.supervisorId === ownerId || next.memberIds.includes(ownerId));
    if (!stillValid) setOwnerId(next?.supervisorId ?? '');
    setPhase(phaseCountOf(nextProjectId) + 1);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!projectId) {
      setFormError('กรุณาเลือกโปรเจค');
      return;
    }
    if (!title.trim()) {
      setFormError('กรุณาระบุชื่อ Milestone');
      return;
    }
    if (!ownerId) {
      setFormError('กรุณาเลือกผู้ดูแล');
      return;
    }
    if (!startDate || !endDate) {
      setFormError('กรุณาระบุวันเริ่มต้นและวันสิ้นสุด');
      return;
    }
    if (endDate < startDate) {
      setFormError('วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น');
      return;
    }

    setIsSaving(true);
    const payload = {
      title: title.trim(),
      ownerId,
      startDate,
      endDate,
      progress: clampProgress(progress),
      phase,
    };
    const saved = milestone
      ? await updateMilestone(milestone.id, payload)
      : await createMilestone({ projectId, ...payload });
    setIsSaving(false);
    if (saved) onClose();
  };

  const handleDelete = async () => {
    if (!milestone) return;
    if (!window.confirm('ยืนยันลบ Milestone นี้และ Task ที่เชื่อมอยู่ทั้งหมดหรือไม่?')) return;
    const ok = await deleteMilestone(milestone.id);
    if (ok) onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={milestone ? 'แก้ไข Milestone' : 'เพิ่ม Milestone ใหม่'}
      subtitle="กำหนดเฟสงาน ผู้ดูแล ช่วงเวลา และความคืบหน้าของโปรเจค"
      headerAccent={project?.color}
    >
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
          <label htmlFor="ms-project" className="mb-1 block font-semibold text-slate-700">
            โปรเจค *
          </label>
          <select
            id="ms-project"
            value={projectId}
            disabled={Boolean(milestone)}
            onChange={(e) => handleProjectChange(e.target.value)}
            className={FIELD_CLASS}
          >
            {milestone && project && !manageableProjects.some((p) => p.id === project.id) && (
              <option value={project.id}>{project.name}</option>
            )}
            {manageableProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ms-title" className="mb-1 block font-semibold text-slate-700">
            ชื่อ Milestone *
          </label>
          <input
            id="ms-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="เช่น ทดสอบระบบ UAT และเปิดใช้งานจริง"
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <label htmlFor="ms-phase" className="mb-1 block font-semibold text-slate-700">
            Phase
          </label>
          <select
            id="ms-phase"
            value={phase ?? ''}
            onChange={(e) => setPhase(e.target.value ? Number(e.target.value) : null)}
            className={FIELD_CLASS}
          >
            <option value="">ยังไม่จัด Phase</option>
            {phaseOptions.map((n) => (
              <option key={n} value={n}>
                {n > existingPhaseCount ? `Phase ${n} (เปิดใหม่)` : `Phase ${n}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ms-owner" className="mb-1 block font-semibold text-slate-700">
            ผู้ดูแล *
          </label>
          <select
            id="ms-owner"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className={FIELD_CLASS}
          >
            {ownerOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ms-start" className="mb-1 block font-semibold text-slate-700">
              วันเริ่มต้น *
            </label>
            <input
              id="ms-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label htmlFor="ms-end" className="mb-1 block font-semibold text-slate-700">
              วันสิ้นสุด *
            </label>
            <input
              id="ms-end"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className={FIELD_CLASS}
            />
          </div>
        </div>

        <div>
          <label htmlFor="ms-progress" className="mb-1 block font-semibold text-slate-700">
            ความคืบหน้า (%)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              aria-label="แถบเลื่อนความคืบหน้า"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(clampProgress(Number(e.target.value)))}
              className="flex-1 accent-indigo-600"
            />
            <input
              id="ms-progress"
              type="number"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(clampProgress(Number(e.target.value)))}
              className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-right font-bold text-slate-800 outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
          {milestone ? (
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 font-semibold text-rose-600 transition hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              ลบ Milestone
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {milestone ? 'บันทึกการแก้ไข' : 'เพิ่ม Milestone'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
