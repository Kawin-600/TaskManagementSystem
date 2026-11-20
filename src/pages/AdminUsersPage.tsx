import { useState } from 'react';
import { UserPlus, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { ENABLE_DEMO_AUTH } from '../config/appConfig';
import { canDeleteUser, canModifyUserRole } from '../domain/rbac';
import { useAuth } from '../state/AuthContext';
import { useWorkspace } from '../state/WorkspaceContext';
import type { User, UserRole } from '../types/models';
import { AvatarCircle, getThaiRoleName } from '../components/ui/Badges';
import { Modal } from '../components/ui/Modal';

interface AdminUsersPageProps {
  onOpenCreateUser: () => void;
}

export function AdminUsersPage({ onOpenCreateUser }: AdminUsersPageProps) {
  const { currentUser } = useAuth();
  const { users, projects, tasks, updateUserRole, deleteUser, resetSampleData } = useWorkspace();

  const [pendingDemotion, setPendingDemotion] = useState<{
    user: User;
    newRole: UserRole;
    supervisedProjectNames: string[];
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<User | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  if (!currentUser) return null;

  const handleRoleSelect = async (user: User, nextRole: UserRole) => {
    if (!canModifyUserRole(currentUser, user.id) || user.role === nextRole) return;
    const supervised = projects.filter((p) => p.supervisorId === user.id);

    if (nextRole === 'staff' && supervised.length > 0) {
      setPendingDemotion({
        user,
        newRole: nextRole,
        supervisedProjectNames: supervised.map((p) => p.name),
      });
      return;
    }

    await updateUserRole(user.id, nextRole);
  };

  const handleConfirmDemotion = async () => {
    if (!pendingDemotion) return;
    await updateUserRole(pendingDemotion.user.id, pendingDemotion.newRole);
    setPendingDemotion(null);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteUser(pendingDelete.id);
    setPendingDelete(null);
  };

  const handleConfirmReset = async () => {
    await resetSampleData();
    setConfirmingReset(false);
  };

  const deleteSupervisedCount = pendingDelete
    ? projects.filter((p) => p.supervisorId === pendingDelete.id).length
    : 0;
  const deleteAssignedCount = pendingDelete
    ? tasks.filter((t) => t.assigneeId === pendingDelete.id).length
    : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-800">
              ผู้ใช้งานทั้งหมดในระบบ ({users.length})
            </h3>
            <p className="text-xs text-slate-500">
              จัดการสิทธิ์บทบาทและบัญชีเข้าสู่ระบบสำหรับสมาชิกในองค์กร
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCreateUser}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <UserPlus className="h-4 w-4" />
            <span>เพิ่มผู้ใช้งานใหม่</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {users.map((u) => {
            const isSelf = u.id === currentUser.id;
            const roleEditable = canModifyUserRole(currentUser, u.id);
            const deletable = canDeleteUser(currentUser, u.id);

            return (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <AvatarCircle avatar={u.avatar} color={u.color} size="md" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    aria-label={`เปลี่ยนบทบาท ${u.name}`}
                    value={u.role}
                    disabled={!roleEditable}
                    onChange={(e) => handleRoleSelect(u, e.target.value as UserRole)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="admin">Admin</option>
                    <option value="supervisor">หัวหน้างาน</option>
                    <option value="staff">เจ้าหน้าที่</option>
                  </select>

                  {isSelf ? (
                    <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                      บัญชีปัจจุบัน
                    </span>
                  ) : (
                    deletable && (
                      <button
                        type="button"
                        aria-label={`ลบผู้ใช้ ${u.name}`}
                        title="ลบผู้ใช้งาน"
                        onClick={() => setPendingDelete(u)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Discreet Demo Maintenance Panel */}
      {ENABLE_DEMO_AUTH && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-xs">
          <div>
            <p className="font-semibold text-slate-700">โหมดข้อมูลตัวอย่าง (Local Demo Storage)</p>
            <p className="text-slate-500">
              รีเซ็ตผู้ใช้งาน โปรเจค และงานทั้งหมดกลับเป็นชุดข้อมูลตัวอย่างเริ่มต้นอิงวันที่ปัจจุบัน
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmingReset(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-600"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>รีเซ็ตข้อมูลตัวอย่าง</span>
          </button>
        </div>
      )}

      {/* Demotion Confirmation Modal */}
      <Modal
        isOpen={Boolean(pendingDemotion)}
        onClose={() => setPendingDemotion(null)}
        title="ยืนยันการเปลี่ยนบทบาทหัวหน้าโปรเจค"
        size="md"
      >
        <div className="space-y-4 text-xs">
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="font-semibold">
                {pendingDemotion?.user.name} กำลังเป็นหัวหน้าดูแลอยู่{' '}
                {pendingDemotion?.supervisedProjectNames.length} โปรเจค
              </p>
              <p>
                การเปลี่ยนบทบาทเป็น {pendingDemotion ? getThaiRoleName(pendingDemotion.newRole) : ''}{' '}
                จะทำการโอนสิทธิ์ดูแลโปรเจคต่อไปนี้ให้คุณ ({currentUser.name}) โดยอัตโนมัติ (และยังเก็บ{' '}
                {pendingDemotion?.user.name} ไว้เป็นสมาชิกในโปรเจคเดิม):
              </p>
              <ul className="list-disc pl-5 font-medium">
                {pendingDemotion?.supervisedProjectNames.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingDemotion(null)}
              className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleConfirmDemotion}
              className="rounded-xl bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700"
            >
              ยืนยันเปลี่ยนบทบาท
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="ยืนยันการลบผู้ใช้งาน"
        size="md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            คุณต้องการลบผู้ใช้งาน <strong className="text-slate-900">{pendingDelete?.name}</strong>{' '}
            ออกจากระบบใช่หรือไม่?
          </p>
          {(deleteSupervisedCount > 0 || deleteAssignedCount > 0) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
              ระบบจะโอนสิทธิ์ดูแลโปรเจค ({deleteSupervisedCount} โปรเจค) ให้คุณ และโอนงานที่ค้าง (
              {deleteAssignedCount} งาน) ให้หัวหน้าของแต่ละโปรเจคโดยอัตโนมัติ
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700"
            >
              ยืนยันลบผู้ใช้งาน
            </button>
          </div>
        </div>
      </Modal>

      {/* Demo Reset Confirmation Modal */}
      <Modal
        isOpen={confirmingReset}
        onClose={() => setConfirmingReset(false)}
        title="ยืนยันการรีเซ็ตข้อมูลตัวอย่าง"
        size="md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            ข้อมูลผู้ใช้งาน โปรเจค และงานทั้งหมดที่แก้ไขไว้ในเครื่องนี้จะถูกล้างและกลับเป็นชุดข้อมูลตัวอย่างเริ่มต้น
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleConfirmReset}
              className="rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700"
            >
              รีเซ็ตข้อมูล
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
