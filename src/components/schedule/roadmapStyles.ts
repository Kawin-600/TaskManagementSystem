import type { MilestoneStatus } from '../../types/models';

export const MILESTONE_STATUS_ORDER: MilestoneStatus[] = [
  'completed',
  'in_progress',
  'delayed',
  'not_started',
];

export const MILESTONE_STATUS_STYLES: Record<
  MilestoneStatus,
  { track: string; fill: string; text: string; dot: string; badge: string }
> = {
  completed: {
    track: 'border-emerald-300 bg-emerald-100',
    fill: 'bg-emerald-300',
    text: 'text-emerald-900',
    dot: 'bg-emerald-500',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  in_progress: {
    track: 'border-indigo-300 bg-indigo-100',
    fill: 'bg-indigo-300',
    text: 'text-indigo-900',
    dot: 'bg-indigo-500',
    badge: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  },
  delayed: {
    track: 'border-rose-300 bg-rose-100',
    fill: 'bg-rose-300',
    text: 'text-rose-900',
    dot: 'bg-rose-500',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  not_started: {
    track: 'border-slate-300 bg-slate-100',
    fill: 'bg-slate-300',
    text: 'text-slate-700',
    dot: 'bg-slate-400',
    badge: 'border-slate-200 bg-slate-50 text-slate-600',
  },
};
