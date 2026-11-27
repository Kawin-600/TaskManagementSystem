import { participatesInTask } from '../domain/rbac';
import { getTodayStr, isTaskOverdue } from '../domain/dates';
import { useWorkspace } from '../state/WorkspaceContext';
import { AvatarCircle, RoleBadge } from '../components/ui/Badges';

export function TeamWorkloadPage() {
  const { visibleTeamUsers, visibleTasks } = useWorkspace();
  const todayStr = getTodayStr();

  if (visibleTeamUsers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-400">
        ยังไม่มีข้อมูลสมาชิกในขอบเขตโปรเจคของคุณ
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      {visibleTeamUsers.map((member) => {
        const memberTasks = visibleTasks.filter((t) => participatesInTask(t, member.id));
        const completed = memberTasks.filter((t) => t.status === 'completed').length;
        const inProgress = memberTasks.filter((t) => t.status === 'in_progress').length;
        const review = memberTasks.filter((t) => t.status === 'review').length;
        const overdue = memberTasks.filter((t) => isTaskOverdue(t, todayStr)).length;
        const completionPct =
          memberTasks.length > 0 ? Math.round((completed / memberTasks.length) * 100) : 0;

        return (
          <div
            key={member.id}
            data-testid={`team-card-${member.id}`}
            className="flex flex-col justify-between space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-3.5">
              <AvatarCircle avatar={member.avatar} color={member.color} size="lg" />
              <div className="min-w-0 space-y-1">
                <h4 className="truncate text-sm font-bold text-slate-800">{member.name}</h4>
                <RoleBadge role={member.role} />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                <span>อัตราความสำเร็จ</span>
                <span className="font-bold text-slate-700">{completionPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>ภาระงานทั้งหมด:</span>
                <strong data-testid="total-tasks" className="font-bold text-slate-800">
                  {memberTasks.length} งาน
                </strong>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>เสร็จสิ้นแล้ว:</span>
                <strong className="font-bold">{completed} งาน</strong>
              </div>
              <div className="flex justify-between text-indigo-600">
                <span>กำลังทำ:</span>
                <strong className="font-bold">{inProgress} งาน</strong>
              </div>
              <div className="flex justify-between text-amber-600">
                <span>รอตรวจสอบ:</span>
                <strong className="font-bold">{review} งาน</strong>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>เลยกำหนด:</span>
                <strong className="font-bold">{overdue} งาน</strong>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
