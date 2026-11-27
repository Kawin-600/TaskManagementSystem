import { participatesInTask } from '../../domain/rbac';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Layers,
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  CalendarRange,
  Users,
  ShieldCheck,
  LogOut,
  Bell,
} from 'lucide-react';
import { canAccessAdmin, canManageUsers } from '../../domain/rbac';
import { useAuth } from '../../state/AuthContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import { AvatarCircle, RoleBadge } from '../ui/Badges';

interface IconRailProps {
  onNavigate?: () => void;
}

export function IconRail({ onNavigate }: IconRailProps) {
  const { currentUser, logout } = useAuth();
  const { visibleTasks } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [accountOpen]);

  if (!currentUser) return null;

  const myActiveCount = visibleTasks.filter(
    (t) => participatesInTask(t, currentUser.id) && t.status !== 'completed',
  ).length;

  const navItems = [
    { to: '/', label: 'แดชบอร์ด', Icon: LayoutDashboard, match: (p: string) => p === '/' },
    {
      to: '/my-tasks',
      label: 'งานของฉัน',
      Icon: CheckSquare,
      badge: myActiveCount,
      match: (p: string) => p.startsWith('/my-tasks'),
    },
    {
      to: '/projects',
      label: 'โปรเจค',
      Icon: FolderKanban,
      match: (p: string) => p.startsWith('/projects'),
    },
    {
      to: '/schedule',
      label: 'ปฏิทิน & ไทม์ไลน์รวม',
      Icon: CalendarRange,
      match: (p: string) => p.startsWith('/schedule'),
    },
    {
      to: '/team',
      label: 'ทีมงาน & ภาระงาน',
      Icon: Users,
      match: (p: string) => p.startsWith('/team'),
    },
  ];

  if (canManageUsers(currentUser)) {
    navItems.push({
      to: '/admin/users',
      label: canAccessAdmin(currentUser) ? 'จัดการระบบ' : 'จัดการผู้ใช้',
      Icon: ShieldCheck,
      match: (p: string) => p.startsWith('/admin'),
    });
  }

  const handleLogout = async () => {
    setAccountOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside
      aria-label="แถบนำทางหลัก"
      className="flex h-full w-16 shrink-0 flex-col items-center justify-between bg-slate-900 py-3 text-slate-400"
    >
      <div className="flex flex-col items-center gap-4">
        <Link
          to="/"
          onClick={onNavigate}
          title="TaskFlow Pro"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 text-white shadow-lg shadow-indigo-950/50 transition hover:scale-105"
        >
          <Layers className="h-5 w-5" />
        </Link>

        <nav aria-label="เมนูหลัก" className="flex flex-col items-center gap-1.5">
          {navItems.map(({ to, label, Icon, badge, match }) => {
            const active = match(location.pathname);
            return (
              <Link
                key={to}
                to={to}
                onClick={onNavigate}
                title={label}
                aria-label={label}
                className={`group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                  active
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/40'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5" />
                {badge !== undefined && badge > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-slate-900">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
                <span className="pointer-events-none absolute left-14 z-40 hidden whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-white shadow-lg group-hover:block">
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div ref={popoverRef} className="relative">
        <button
          type="button"
          aria-label="บัญชีผู้ใช้"
          onClick={() => setAccountOpen((prev) => !prev)}
          className="rounded-full p-0.5 ring-2 ring-transparent transition hover:ring-indigo-400"
          title={`${currentUser.name} (${currentUser.email})`}
        >
          <AvatarCircle avatar={currentUser.avatar} color={currentUser.color} size="md" />
        </button>

        {accountOpen && (
          <div className="absolute bottom-0 left-14 z-50 w-60 rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-2xl">
            <div className="flex items-center gap-3 pb-3">
              <AvatarCircle avatar={currentUser.avatar} color={currentUser.color} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800">{currentUser.name}</p>
                <p className="truncate text-[11px] text-slate-500">{currentUser.email}</p>
              </div>
            </div>
            <div className="mb-3">
              <RoleBadge role={currentUser.role} />
            </div>
            <Link to="/settings/telegram" onClick={() => { setAccountOpen(false); onNavigate?.(); }}
              className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-slate-100">
              <Bell className="h-3.5 w-3.5" />
              ตั้งค่าการแจ้งเตือน
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
