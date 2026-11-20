import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import { useWorkspace } from '../../state/WorkspaceContext';
import { useAuth } from '../../state/AuthContext';
import type { UserRole } from '../../types/models';
import { Modal } from '../ui/Modal';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CreateUserModal({ isOpen, onClose }: CreateUserModalProps) {
  const { createUser } = useWorkspace();
  const { currentUser } = useAuth();
  const canChooseRole = currentUser?.role === 'admin';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [password, setPassword] = useState('1234');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setEmail('');
    setRole('staff');
    setPassword('1234');
    setFormError(null);
  }, [isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError('กรุณาระบุชื่อ-นามสกุล');
      return;
    }
    if (!email.trim() || !SIMPLE_EMAIL_REGEX.test(email.trim())) {
      setFormError('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }
    const created = await createUser({
      name: name.trim(),
      email: email.trim(),
      role: canChooseRole ? role : 'staff',
      password: password.trim() || '1234',
    });
    if (created) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="เพิ่มผู้ใช้งานใหม่"
      subtitle="สร้างบัญชีพร้อมกำหนดสิทธิ์การใช้งานในระบบ"
      size="md"
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
          <label htmlFor="user-name" className="mb-1 block font-semibold text-slate-700">
            ชื่อ-นามสกุล *
          </label>
          <input
            id="user-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น อภิสิทธิ์ ขยันทำ"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-800 outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="user-email" className="mb-1 block font-semibold text-slate-700">
            อีเมลสำหรับเข้าสู่ระบบ *
          </label>
          <input
            id="user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@taskflow.local"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-800 outline-none focus:border-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="user-role" className="mb-1 block font-semibold text-slate-700">
              บทบาทสิทธิ์ใช้งาน
            </label>
            {canChooseRole ? (
              <select
                id="user-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800"
              >
                <option value="staff">เจ้าหน้าที่ (Staff)</option>
                <option value="supervisor">หัวหน้างาน (Supervisor)</option>
                <option value="executive">ผู้บริหาร (Executive)</option>
                <option value="admin">Admin (ผู้ดูแลระบบ)</option>
              </select>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 font-medium text-slate-600">
                เจ้าหน้าที่ (Staff)
              </div>
            )}
          </div>

          <div>
            <label htmlFor="user-password" className="mb-1 block font-semibold text-slate-700">
              รหัสผ่านเริ่มต้น
            </label>
            <input
              id="user-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="1234"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-800 outline-none focus:border-indigo-500"
            />
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
            เพิ่มสมาชิก
          </button>
        </div>
      </form>
    </Modal>
  );
}
