import { useMemo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { formatThaiDateShort } from '../../domain/dates';
import {
  MILESTONE_STATUS_LABELS,
  getMilestoneStatus,
  getProjectProgress,
  groupMilestonesByProject,
} from '../../domain/roadmap';
import type { Milestone } from '../../types/models';
import type { RoadmapViewProps } from './RoadmapBoard';
import { MILESTONE_STATUS_STYLES } from './roadmapStyles';

type RoadmapListProps = Omit<RoadmapViewProps, 'yearMonth'> & {
  onDelete: (milestone: Milestone) => void;
};

export function RoadmapList({
  todayStr,
  projects,
  milestones,
  users,
  canManageProject,
  onMilestoneClick,
  onDelete,
}: RoadmapListProps) {
  const groups = useMemo(
    () => groupMilestonesByProject(projects, milestones),
    [projects, milestones],
  );
  const userNames = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <th className="px-4 py-3 font-semibold">เฟส</th>
            <th className="px-3 py-3 font-semibold">ชื่อ Milestone</th>
            <th className="px-3 py-3 font-semibold">ผู้ดูแล</th>
            <th className="px-3 py-3 font-semibold">ช่วงเวลา</th>
            <th className="px-3 py-3 font-semibold">สถานะ</th>
            <th className="px-3 py-3 font-semibold">ความคืบหน้า</th>
            <th className="px-3 py-3 text-right font-semibold">จัดการ</th>
          </tr>
        </thead>
        {groups.map(({ project, milestones: projectMilestones }) => {
          const manageable = canManageProject(project.id);
          return (
            <tbody key={project.id}>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <td colSpan={7} className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="font-bold text-slate-800">{project.name}</span>
                    <span className="font-bold text-indigo-600">
                      {getProjectProgress(projectMilestones)}%
                    </span>
                  </div>
                </td>
              </tr>
              {projectMilestones.map((m) => {
                const status = getMilestoneStatus(m, todayStr);
                const styles = MILESTONE_STATUS_STYLES[status];
                return (
                  <tr
                    key={m.id}
                    data-testid={`roadmap-list-row-${m.id}`}
                    className="border-b border-slate-100"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 font-bold text-slate-600">
                      {m.phase === null ? 'ยังไม่จัด Phase' : `Phase ${m.phase}`}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{m.title}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                      {userNames.get(m.ownerId) ?? '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                      {formatThaiDateShort(m.startDate)} – {formatThaiDateShort(m.endDate)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${styles.badge}`}
                      >
                        {MILESTONE_STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${styles.dot}`}
                            style={{ width: `${m.progress}%` }}
                          />
                        </div>
                        <span className="w-9 text-right font-bold text-slate-700">
                          {m.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {manageable && (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            aria-label={`แก้ไข ${m.title}`}
                            onClick={() => onMilestoneClick(m)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`ลบ ${m.title}`}
                            onClick={() => onDelete(m)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
