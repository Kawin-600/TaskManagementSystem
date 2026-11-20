import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import { PROJECT_COLORS } from '../../config/appConfig';
import { useAuth } from '../../state/AuthContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import type { Project } from '../../types/models';
import { AvatarCircle, RoleBadge } from '../ui/Badges';
import { Modal } from '../ui/Modal';

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project | null;
  onSaved?: (project: Project) => void;
}

export function ProjectFormModal({ isOpen, onClose, project, onSaved }: ProjectFormModalProps) {
  const { currentUser } = useAuth();
  const { users, createProject, updateProject } = useWorkspace();

  const eligibleSupervisors = users.filter((u) => u.role === 'admin' || u.role === 'supervisor');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string>(PROJECT_COLORS[0]);
  const [supervisorId, setSupervisorId] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !currentUser) return;
    setFormError(null);
    if (project) {
      setName(project.name);
      setDescription(project.description);
      setColor(project.color);
      setSupervisorId(project.supervisorId);
      setMemberIds(Array.from(new Set([project.supervisorId, ...project.memberIds])));
    } else {
      const defaultSup =
        currentUser.role === 'supervisor' || currentUser.role === 'admin'
          ? currentUser.id
          : eligibleSupervisors[0]?.id ?? '';
      setName('');
      setDescription('');
      setColor(PROJECT_COLORS[0]);
      setSupervisorId(defaultSup);
      setMemberIds(defaultSup ? [defaultSup] : []);
    }
  }, [isOpen, project, currentUser]);

  if (!currentUser) return null;

  const fallbackSupervisorId =
    project?.supervisorId ??
    (currentUser.role === 'supervisor' || currentUser.role === 'admin'
      ? currentUser.id
      : eligibleSupervisors[0]?.id ?? '');
  const effectiveSupervisorId = supervisorId || fallbackSupervisorId;

  const handleSupervisorChange = (nextSupId: string) => {
    setSupervisorId(nextSupId);
    setMemberIds((prev) => Array.from(new Set([nextSupId, ...prev])));
  };

  const toggleMember = (userId: string) => {
    if (userId === effectiveSupervisorId) return;
    setMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError('กรุณาระบุชื่อโปรเจค');
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      color,
      supervisorId: effectiveSupervisorId,
      memberIds: Array.from(new Set([effectiveSupervisorId, ...memberIds])),
    };

    const saved = project
      ? await updateProject(project.id, payload)
      : await createProject(payload);

    if (saved) {
      onSaved?.(saved);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={project ? 'แก้ไขข้อมูลโปรเจค' : 'สร้างโปรเจคใหม่'}
      subtitle="กำหนดชื่อ หัวหน้าผู้ดูแล สีประจำโปรเจค และสมาชิกที่เข้าถึงได้"
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
          <label htmlFor="prj-name" className="mb-1 block font-semibold text-slate-700">
            ชื่อโปรเจค *
          </label>
          <input
            id="prj-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น พัฒนาระบบ ERP คลังสินค้า"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-800 outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="prj-desc" className="mb-1 block font-semibold text-slate-700">
            คำอธิบายรายละเอียดโปรเจค
          </label>
          <textarea
            id="prj-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ระบุเป้าหมายและขอบเขตโปรเจค..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-800 outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="prj-supervisor" className="mb-1 block font-semibold text-slate-700">
            หัวหน้าผู้ดูแลโปรเจค *
          </label>
          <select
            id="prj-supervisor"
            value={effectiveSupervisorId}
            disabled={currentUser.role === 'supervisor' && !project}
            onChange={(e) => handleSupervisorChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 disabled:bg-slate-100"
          >
            {eligibleSupervisors.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="mb-1.5 block font-semibold text-slate-700">ธีมสีประจำโปรเจค</span>
          <div className="flex items-center gap-2.5">
            {PROJECT_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                aria-label={`เลือกสี ${hex}`}
                onClick={() => setColor(hex)}
                style={{ backgroundColor: hex }}
                className={`h-7 w-7 rounded-full transition ${
                  color === hex ? 'scale-110 ring-4 ring-indigo-200' : 'opacity-80 hover:opacity-100'
                }`}
              />
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block font-semibold text-slate-700">
            สมาชิกในโปรเจค (Member-Scoped)
          </span>
          <div className="max-h-44 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50">
            {users.map((u) => {
              const isSupervisor = u.id === effectiveSupervisorId;
              const checked = isSupervisor || memberIds.includes(u.id);
              return (
                <label
                  key={u.id}
                  className="flex cursor-pointer items-center justify-between px-3 py-2.5 hover:bg-white"
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isSupervisor}
                      onChange={() => toggleMember(u.id)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                    />
                    <AvatarCircle avatar={u.avatar} color={u.color} size="xs" />
                    <span className="font-medium text-slate-800">{u.name}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {isSupervisor && (
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                        หัวหน้าโปรเจค
                      </span>
                    )}
                    <RoleBadge role={u.role} />
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="rounded-xl bg-indigo-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            {project ? 'บันทึกการแก้ไข' : 'บันทึกโปรเจค'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
