import { useMemo } from 'react';
import { formatThaiDateShort } from '../../domain/dates';
import {
  MILESTONE_STATUS_LABELS,
  getMilestoneBar,
  getMilestoneStatus,
  getProjectProgress,
  getRoadmapWeeks,
  getTodayLinePct,
  groupMilestonesByProject,
} from '../../domain/roadmap';
import type { Milestone, Project, User } from '../../types/models';
import { MILESTONE_STATUS_STYLES } from './roadmapStyles';

export interface RoadmapViewProps {
  yearMonth: string;
  todayStr: string;
  projects: Project[];
  milestones: Milestone[];
  users: User[];
  canManageProject: (projectId: string) => boolean;
  onMilestoneClick: (milestone: Milestone) => void;
}

const LABEL_COLUMN = 'w-80 shrink-0';

export function RoadmapBoard({
  yearMonth,
  todayStr,
  projects,
  milestones,
  users,
  canManageProject,
  onMilestoneClick,
}: RoadmapViewProps) {
  const weeks = useMemo(() => getRoadmapWeeks(yearMonth), [yearMonth]);
  const groups = useMemo(
    () => groupMilestonesByProject(projects, milestones),
    [projects, milestones],
  );
  const userNames = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const todayPct = getTodayLinePct(todayStr, weeks);

  const weekGrid = (
    <div className="pointer-events-none absolute inset-0 grid grid-cols-8">
      {weeks.map((w) => (
        <div key={w.key} className="border-l border-slate-100" />
      ))}
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1040px] text-xs">
        {/* Header */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <div className={`${LABEL_COLUMN} px-4 py-3 font-semibold text-slate-600`}>
            โปรเจค / เฟสงาน (Milestones)
          </div>
          <div className="grid flex-1 grid-cols-8">
            {weeks.map((w) => (
              <div key={w.key} className="border-l border-slate-200 px-1 py-2 text-center">
                <p className="font-bold text-slate-700">{w.label}</p>
                <p className="text-[10px] text-slate-400">{w.rangeLabel}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="relative">
          {groups.map(({ project, milestones: projectMilestones }) => {
            const manageable = canManageProject(project.id);
            return (
              <div key={project.id}>
                <div className="flex border-b border-slate-200 bg-slate-50/70">
                  <div className={`${LABEL_COLUMN} flex items-center gap-2 px-4 py-2.5`}>
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="min-w-0 flex-1 truncate font-bold text-slate-800">
                      {project.name}
                    </span>
                    <span
                      data-testid={`roadmap-project-progress-${project.id}`}
                      className="font-bold text-indigo-600"
                    >
                      {getProjectProgress(projectMilestones)}%
                    </span>
                  </div>
                  <div className="flex-1 border-l border-slate-200" />
                </div>

                {projectMilestones.map((m) => {
                  const status = getMilestoneStatus(m, todayStr);
                  const styles = MILESTONE_STATUS_STYLES[status];
                  const bar = getMilestoneBar(m, weeks);
                  const phaseLabel = `Phase ${m.phase}`;
                  const barLabel = `${phaseLabel} ${m.title} — ${MILESTONE_STATUS_LABELS[status]} ${m.progress}%`;
                  const barClass = `absolute top-1/2 flex h-7 min-w-[44px] -translate-y-1/2 items-center justify-between gap-2 overflow-hidden rounded-lg border px-2 text-[10px] font-bold ${styles.track} ${styles.text}`;
                  const barStyle = bar
                    ? { left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }
                    : undefined;
                  const barContent = (
                    <>
                      <span
                        aria-hidden="true"
                        className={`absolute inset-y-0 left-0 ${styles.fill}`}
                        style={{ width: `${m.progress}%` }}
                      />
                      <span className="relative truncate">{phaseLabel}</span>
                      <span className="relative shrink-0">{m.progress}%</span>
                    </>
                  );

                  return (
                    <div
                      key={m.id}
                      data-testid={`roadmap-row-${m.id}`}
                      className="flex border-b border-slate-100"
                    >
                      <div className={`${LABEL_COLUMN} px-4 py-2.5`}>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                            {phaseLabel}
                          </span>
                          {manageable ? (
                            <button
                              type="button"
                              data-testid={`roadmap-title-${m.id}`}
                              onClick={() => onMilestoneClick(m)}
                              title={m.title}
                              className="min-w-0 truncate text-left font-semibold text-slate-800 hover:text-indigo-700 hover:underline"
                            >
                              {m.title}
                            </button>
                          ) : (
                            <span title={m.title} className="min-w-0 truncate font-semibold text-slate-800">
                              {m.title}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                          <span className="truncate">
                            ผู้ดูแล: {userNames.get(m.ownerId) ?? '-'}
                          </span>
                          <span className="shrink-0">
                            {formatThaiDateShort(m.startDate)} – {formatThaiDateShort(m.endDate)}
                          </span>
                        </div>
                      </div>
                      <div className="relative min-h-[52px] flex-1">
                        {weekGrid}
                        {bar &&
                          (manageable ? (
                            <button
                              type="button"
                              data-testid={`roadmap-bar-${m.id}`}
                              data-status={status}
                              aria-label={`แก้ไข ${barLabel}`}
                              title={barLabel}
                              onClick={() => onMilestoneClick(m)}
                              className={`${barClass} cursor-pointer transition hover:brightness-95`}
                              style={barStyle}
                            >
                              {barContent}
                            </button>
                          ) : (
                            <div
                              data-testid={`roadmap-bar-${m.id}`}
                              data-status={status}
                              title={barLabel}
                              className={barClass}
                              style={barStyle}
                            >
                              {barContent}
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {todayPct !== null && (
            <div className="pointer-events-none absolute inset-y-0 left-80 right-0">
              <div
                data-testid="roadmap-today-line"
                className="absolute inset-y-0 border-l-2 border-dashed border-slate-400/80"
                style={{ left: `${todayPct}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
