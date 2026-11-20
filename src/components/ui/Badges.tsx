import type { TaskPriority, TaskStatus, UserRole } from '../../types/models';

const STATUS_NAMES: Record<TaskStatus, string> = {
  todo: 'รอดำเนินการ',
  in_progress: 'กำลังทำ',
  review: 'รอตรวจสอบ',
  completed: 'เสร็จสิ้น',
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  todo: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  review: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const PRIORITY_NAMES: Record<TaskPriority, string> = {
  low: 'ต่ำ',
  medium: 'ปานกลาง',
  high: 'สูง',
  urgent: 'ด่วนที่สุด',
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-sky-100 text-sky-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-rose-100 text-rose-700',
};

const ROLE_NAMES: Record<UserRole, string> = {
  admin: 'Admin',
  supervisor: 'หัวหน้างาน',
  executive: 'ผู้บริหาร',
  staff: 'เจ้าหน้าที่',
};

const ROLE_STYLES: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  supervisor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  executive: 'bg-sky-100 text-sky-700 border-sky-200',
  staff: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const AVATAR_BG: Record<string, string> = {
  purple: 'bg-purple-600',
  indigo: 'bg-indigo-600',
  emerald: 'bg-emerald-600',
  amber: 'bg-amber-600',
  rose: 'bg-rose-600',
  sky: 'bg-sky-600',
};

export function getThaiStatusName(status: TaskStatus): string {
  return STATUS_NAMES[status];
}

export function getThaiRoleName(role: UserRole): string {
  return ROLE_NAMES[role];
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status]}`}
    >
      {STATUS_NAMES[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold ${PRIORITY_STYLES[priority]}`}
    >
      {PRIORITY_NAMES[priority]}
    </span>
  );
}

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${ROLE_STYLES[role]}`}
    >
      {ROLE_NAMES[role]}
    </span>
  );
}

export function AvatarCircle({
  avatar,
  color = 'indigo',
  size = 'md',
}: {
  avatar: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    xs: 'h-5 w-5 text-[9px]',
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-11 w-11 text-sm',
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-sm ${AVATAR_BG[color] ?? 'bg-indigo-600'} ${sizes[size]}`}
    >
      {avatar}
    </span>
  );
}
