import { Shield, UserCheck, User } from 'lucide-react';
import { ENABLE_DEMO_AUTH } from '../../config/appConfig';
import type { User as AppUser, UserRole } from '../../types/models';

interface DemoQuickLoginProps {
  users: AppUser[];
  isSubmitting: boolean;
  onQuickLogin: (userId: string) => void;
}

const ROLE_BUTTON_META: Array<{
  role: UserRole;
  label: string;
  style: string;
  Icon: typeof Shield;
}> = [
  {
    role: 'admin',
    label: 'Admin',
    style: 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100',
    Icon: Shield,
  },
  {
    role: 'supervisor',
    label: 'หัวหน้างาน',
    style: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
    Icon: UserCheck,
  },
  {
    role: 'staff',
    label: 'เจ้าหน้าที่',
    style: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    Icon: User,
  },
];

export function DemoQuickLogin({ users, isSubmitting, onQuickLogin }: DemoQuickLoginProps) {
  if (!ENABLE_DEMO_AUTH) return null;

  return (
    <div className="mt-6 border-t border-dashed border-slate-200 pt-5">
      <p className="mb-2.5 text-center text-xs font-medium text-slate-500">
        ทดลองเข้าใช้งานด่วน (Demo Mode · รหัสผ่านเริ่มต้น: 1234)
      </p>
      <div className="grid grid-cols-3 gap-2">
        {ROLE_BUTTON_META.map(({ role, label, style, Icon }) => {
          const sample = users.find((u) => u.role === role);
          if (!sample) return null;
          return (
            <button
              key={role}
              type="button"
              disabled={isSubmitting}
              onClick={() => onQuickLogin(sample.id)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all disabled:opacity-50 ${style}`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              <span className="max-w-full truncate text-[10px] font-normal opacity-75">
                {sample.name.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
