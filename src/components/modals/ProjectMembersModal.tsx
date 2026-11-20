import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Users } from 'lucide-react';
import { canManageProject } from '../../domain/rbac';
import { useAuth } from '../../state/AuthContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import { AvatarCircle, RoleBadge } from '../ui/Badges';
import { Modal } from '../ui/Modal';

interface ProjectMembersModalProps {
  projectId: string | null;
  onClose: () => void;
}

export function ProjectMembersModal({ projectId, onClose }: ProjectMembersModalProps) {
  const { currentUser } = useAuth();
  const { visibleProjects, visibleTasks, users, updateProjectMembers } = useWorkspace();

  const project = useMemo(
    () => (projectId ? visibleProjects.find((p) => p.id === projectId) ?? null : null),
    [projectId, visibleProjects],
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!project) return;
    setSelectedIds(Array.from(new Set([project.supervisorId, ...project.memberIds])));
  }, [project]);

  if (!project || !currentUser) return null;

  const canManage = canManageProject(currentUser, project);
  const projectTasks = visibleTasks.filter((t) => t.projectId === project.id);

  const removedIds = project.memberIds.filter(
    (id) => id !== project.supervisorId && !selectedIds.includes(id),
  );
  const affectedTasksCount = projectTasks.filter((t) => removedIds.includes(t.assigneeId)).length;

  const toggleMember = (userId: string) => {
    if (!canManage || userId === project.supervisorId) return;
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleSave = async () => {
    const ok = await updateProjectMembers(project.id, selectedIds);
    if (ok) onClose();
  };

  const displayUsers = canManage
    ? users
    : users.filter((u) => project.memberIds.includes(u.id) || u.id === project.supervisorId);

  return (
    <Modal
      isOpen={Boolean(project)}
      onClose={onClose}
      title={`สมาชิกโปรเจค: ${project.name}`}
      subtitle={
        canManage
          ? 'เลือกสมาชิกที่สามารถมองเห็นและทำงานในโปรเจคนี้ได้'
          : 'รายชื่อสมาชิกที่เข้าร่วมในโปรเจคนี้'
      }
      headerAccent={project.color}
      size="md"
    >
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-slate-600">
          <span className="flex items-center gap-2 font-semibold">
            <Users className="h-4 w-4 text-indigo-500" />
            สมาชิกที่เลือกอยู่
          </span>
          <span className="font-bold text-slate-800">{selectedIds.length} คน</span>
        </div>

        <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {displayUsers.map((u) => {
            const isSupervisor = u.id === project.supervisorId;
            const checked = isSupervisor || selectedIds.includes(u.id);
            const taskCount = projectTasks.filter((t) => t.assigneeId === u.id).length;

            return (
              <label
                key={u.id}
                className={`flex items-center justify-between px-3.5 py-2.5 ${
                  canManage && !isSupervisor ? 'cursor-pointer hover:bg-slate-50' : ''
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {canManage && (
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isSupervisor}
                      onChange={() => toggleMember(u.id)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                    />
                  )}
                  <AvatarCircle avatar={u.avatar} color={u.color} size="sm" />
                  <div>
                    <p className="font-semibold text-slate-800">{u.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {taskCount > 0 ? `รับผิดชอบ ${taskCount} งานในโปรเจคนี้` : 'ไม่มีงานค้างในโปรเจคนี้'}
                    </p>
                  </div>
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

        {canManage && affectedTasksCount > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              งานของสมาชิกที่นำออกจำนวน <strong>{affectedTasksCount} งาน</strong> จะถูกโอนให้หัวหน้าโปรเจคโดยอัตโนมัติเมื่อบันทึก
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
          >
            ปิด
          </button>
          {canManage && (
            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl bg-indigo-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              บันทึกสมาชิก
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
