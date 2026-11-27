import { useMemo } from 'react';
import { formatThaiDateShort } from '../../domain/dates';
import { getMilestoneBar, getProjectProgress, getRoadmapWeeks, getTodayLinePct, groupMilestonesByProject } from '../../domain/roadmap';
import type { Milestone, Project, User } from '../../types/models';

export interface RoadmapViewProps {
  yearMonth: string;
  todayStr: string;
  projects: Project[];
  milestones: Milestone[];
  users: User[];
  canManageProject: (projectId: string) => boolean;
  onMilestoneClick: (milestone: Milestone) => void;
}

export function RoadmapBoard({ yearMonth, todayStr, projects, milestones, users, canManageProject, onMilestoneClick }: RoadmapViewProps) {
  const weeks = useMemo(() => getRoadmapWeeks(yearMonth), [yearMonth]);
  const groups = useMemo(() => groupMilestonesByProject(projects, milestones), [projects, milestones]);
  const userNames = useMemo(() => new Map(users.map((user) => [user.id, user.name])), [users]);
  const todayPct = getTodayLinePct(todayStr, weeks);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1040px] text-xs">
        <div className="flex border-b border-slate-200 bg-slate-50">
          <div className="w-80 shrink-0 px-4 py-3 font-semibold text-slate-600">โปรเจค / Phase</div>
          <div className="grid flex-1 grid-cols-8">{weeks.map((week) => <div key={week.key} className="border-l border-slate-200 px-1 py-2 text-center"><p className="font-bold text-slate-700">{week.label}</p><p className="text-[10px] text-slate-400">{week.rangeLabel}</p></div>)}</div>
        </div>
        <div className="relative">
          {groups.map(({ project, milestones: projectMilestones }) => {
            const phases = [...new Set(projectMilestones.map((m) => m.phase))].sort((a, b) => (a ?? Infinity) - (b ?? Infinity));
            return <div key={project.id}>
              <div className="flex border-b border-slate-200 bg-slate-50/70">
                <div className="flex w-80 shrink-0 items-center gap-2 px-4 py-2.5"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} /><span className="min-w-0 flex-1 truncate font-bold text-slate-800">{project.name}</span><span data-testid={`roadmap-project-progress-${project.id}`} className="font-bold text-indigo-600">{getProjectProgress(projectMilestones)}%</span></div><div className="flex-1 border-l border-slate-200" />
              </div>
              {phases.map((phase) => {
                const items = projectMilestones.filter((m) => m.phase === phase).sort((a, b) => a.startDate.localeCompare(b.startDate));
                const label = phase === null ? 'ยังไม่จัด Phase' : `Phase ${phase}`;
                const startDate = items.reduce((date, m) => m.startDate < date ? m.startDate : date, items[0].startDate);
                const endDate = items.reduce((date, m) => m.endDate > date ? m.endDate : date, items[0].endDate);
                const progress = Math.round(items.reduce((sum, m) => sum + m.progress, 0) / items.length);
                const bar = getMilestoneBar({ startDate, endDate }, weeks);
                return <div key={phase ?? 'unassigned'} className="flex border-b border-slate-200">
                  <div className="w-80 shrink-0 space-y-2 px-4 py-3">
                    <div className="flex items-center gap-2"><span className="rounded-md bg-indigo-50 px-2 py-1 font-bold text-indigo-700">{label}</span><span className="text-slate-400">{items.length} Milestone</span></div>
                    {items.map((m) => <div key={m.id} className="border-l-2 border-indigo-100 pl-2">
                      {canManageProject(project.id) ? <button type="button" onClick={() => onMilestoneClick(m)} title={m.title} className="block max-w-full truncate text-left font-semibold text-slate-800 hover:text-indigo-700 hover:underline">{m.title}</button> : <span title={m.title} className="block truncate font-semibold text-slate-800">{m.title}</span>}
                      <div className="mt-1 flex justify-between gap-2 text-[10px] text-slate-400"><span className="truncate">ผู้ดูแล: {userNames.get(m.ownerId) ?? '-'}</span><span className="shrink-0">{formatThaiDateShort(m.startDate)} – {formatThaiDateShort(m.endDate)}</span></div>
                    </div>)}
                  </div>
                  <div className="relative flex-1"><div className="pointer-events-none absolute inset-0 grid grid-cols-8">{weeks.map((w) => <div key={w.key} className="border-l border-slate-100" />)}</div>
                    {bar && <div title={`${label}: ${formatThaiDateShort(startDate)} – ${formatThaiDateShort(endDate)}`} style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }} className="absolute top-1/2 flex h-7 min-w-[44px] -translate-y-1/2 items-center justify-between overflow-hidden rounded-lg border border-indigo-200 bg-indigo-50 px-2 text-[10px] font-bold text-indigo-800"><span className="absolute inset-y-0 left-0 bg-indigo-200" style={{ width: `${progress}%` }} /><span className="relative truncate">{label}</span><span className="relative shrink-0">{progress}%</span></div>}
                  </div>
                </div>;
              })}
            </div>;
          })}
          {todayPct !== null && <div className="pointer-events-none absolute inset-y-0 left-80 right-0"><div data-testid="roadmap-today-line" className="absolute inset-y-0 border-l-2 border-dashed border-slate-400/80" style={{ left: `${todayPct}%` }} /></div>}
        </div>
      </div>
    </div>
  );
}
