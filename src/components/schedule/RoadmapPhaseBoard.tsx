import { useMemo, useState, type DragEvent } from 'react';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { formatThaiDateShort } from '../../domain/dates';
import {
  MILESTONE_STATUS_LABELS,
  getMilestoneStatus,
  getPhaseCount,
  getProjectProgress,
  groupMilestonesByPhase,
} from '../../domain/roadmap';
import type { Milestone } from '../../types/models';
import type { RoadmapViewProps } from './RoadmapBoard';
import { MILESTONE_STATUS_STYLES } from './roadmapStyles';

type RoadmapPhaseBoardProps = Omit<RoadmapViewProps, 'yearMonth'> & {
  onMovePhase: (milestone: Milestone, phase: number) => void;
  onAddInPhase: (projectId: string, phase: number) => void;
};

export function RoadmapPhaseBoard({
  todayStr,
  projects,
  milestones,
  users,
  canManageProject,
  onMilestoneClick,
  onMovePhase,
  onAddInPhase,
}: RoadmapPhaseBoardProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const userNames = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  const sections = useMemo(
    () =>
      projects
        .map((project) => {
          const projectMilestones = milestones.filter((m) => m.projectId === project.id);
          return {
            project,
            projectMilestones,
            phases: groupMilestonesByPhase(projectMilestones),
            phaseCount: getPhaseCount(projectMilestones),
          };
        })
        .filter((section) => section.projectMilestones.length > 0),
    [projects, milestones],
  );

  const handleDrop = (e: DragEvent<HTMLDivElement>, projectId: string, phase: number) => {
    e.preventDefault();
    setDragOverKey(null);
    const id = draggedId || e.dataTransfer?.getData('text/plain');
    setDraggedId(null);
    const milestone = milestones.find((m) => m.id === id);
    // A card only moves between phases of its own project.
    if (!milestone || milestone.projectId !== projectId || milestone.phase === phase) return;
    onMovePhase(milestone, phase);
  };

  return (
    <div className="space-y-6 p-4">
      {sections.map(({ project, projectMilestones, phases, phaseCount }) => {
        const manageable = canManageProject(project.id);
        const dropProps = (phase: number, key: string) =>
          manageable
            ? {
                onDragOver: (e: DragEvent<HTMLDivElement>) => {
                  e.preventDefault();
                  setDragOverKey(key);
                },
                onDragLeave: () => setDragOverKey(null),
                onDrop: (e: DragEvent<HTMLDivElement>) => handleDrop(e, project.id, phase),
              }
            : {};

        return (
          <section key={project.id} aria-label={project.name}>
            <div className="mb-3 flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <h4 className="min-w-0 truncate font-bold text-slate-800">{project.name}</h4>
              <span className="text-xs font-bold text-indigo-600">
                {getProjectProgress(projectMilestones)}%
              </span>
            </div>

            <div className="flex items-stretch gap-4 overflow-x-auto pb-2">
              {phases.map(({ phase, milestones: phaseMilestones }) => {
                const key = `${project.id}-${phase}`;
                return (
                  <div
                    key={key}
                    data-testid={`phase-col-${project.id}-${phase}`}
                    {...dropProps(phase, key)}
                    className={`flex w-72 shrink-0 flex-col rounded-2xl border p-3 transition ${
                      dragOverKey === key
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-sm font-bold text-slate-800">Phase {phase}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {phaseMilestones.length}
                        </span>
                        {manageable && (
                          <button
                            type="button"
                            aria-label={`เพิ่ม Milestone ใน Phase ${phase} ของ ${project.name}`}
                            onClick={() => onAddInPhase(project.id, phase)}
                            className="rounded-lg p-1 text-slate-500 hover:bg-white hover:text-indigo-700"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-2.5">
                      {phaseMilestones.map((m) => {
                        const status = getMilestoneStatus(m, todayStr);
                        const styles = MILESTONE_STATUS_STYLES[status];
                        return (
                          <div
                            key={m.id}
                            data-testid={`phase-card-${m.id}`}
                            data-phase={m.phase}
                            draggable={manageable}
                            onDragStart={(e) => {
                              if (!manageable) {
                                e.preventDefault();
                                return;
                              }
                              setDraggedId(m.id);
                              e.dataTransfer?.setData('text/plain', m.id);
                            }}
                            onDragEnd={() => {
                              setDraggedId(null);
                              setDragOverKey(null);
                            }}
                            onClick={() => manageable && onMilestoneClick(m)}
                            className={`rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm transition ${
                              manageable
                                ? 'cursor-grab hover:border-indigo-300 hover:shadow active:cursor-grabbing'
                                : ''
                            } ${draggedId === m.id ? 'opacity-50' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-bold leading-snug text-slate-800">{m.title}</p>
                              <span
                                className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${styles.badge}`}
                              >
                                {MILESTONE_STATUS_LABELS[status]}
                              </span>
                            </div>
                            <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
                              <CalendarIcon className="h-3 w-3" />
                              {formatThaiDateShort(m.startDate)} – {formatThaiDateShort(m.endDate)}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full ${styles.dot}`}
                                  style={{ width: `${m.progress}%` }}
                                />
                              </div>
                              <span className="w-9 text-right font-bold text-slate-700">
                                {m.progress}%
                              </span>
                            </div>
                            <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                              ผู้ดูแล: {userNames.get(m.ownerId) ?? '-'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {manageable && (
                <div
                  data-testid={`phase-col-${project.id}-new`}
                  {...dropProps(phaseCount + 1, `${project.id}-new`)}
                  className={`flex w-56 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 text-center text-xs transition ${
                    dragOverKey === `${project.id}-new`
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-500'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onAddInPhase(project.id, phaseCount + 1)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    เพิ่ม Phase {phaseCount + 1}
                  </button>
                  <span>หรือลากการ์ดมาวางเพื่อเปิด Phase ใหม่</span>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
