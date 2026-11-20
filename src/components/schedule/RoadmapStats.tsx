import type { MilestoneStats } from '../../domain/roadmap';

interface RoadmapStatsProps {
  stats: MilestoneStats;
}

export function RoadmapStats({ stats }: RoadmapStatsProps) {
  const cards = [
    {
      key: 'total',
      label: 'เป้าหมายทั้งหมด (Milestones)',
      value: stats.total,
      box: 'border-slate-200 bg-white',
      labelColor: 'text-slate-500',
      valueColor: 'text-slate-900',
    },
    {
      key: 'completed',
      label: 'บรรลุเป้าหมายแล้ว',
      value: stats.completed,
      box: 'border-slate-200 bg-white',
      labelColor: 'text-emerald-600',
      valueColor: 'text-emerald-600',
    },
    {
      key: 'in-progress',
      label: 'กำลังดำเนินการ',
      value: stats.inProgress,
      box: 'border-slate-200 bg-white',
      labelColor: 'text-indigo-600',
      valueColor: 'text-indigo-600',
    },
    {
      key: 'delayed',
      label: 'ล่าช้ากว่าแผน (Delayed)',
      value: stats.delayed,
      box: 'border-rose-200 bg-rose-50',
      labelColor: 'text-rose-600',
      valueColor: 'text-rose-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.key} className={`rounded-2xl border p-4 shadow-sm ${card.box}`}>
          <p className={`text-xs font-semibold ${card.labelColor}`}>{card.label}</p>
          <p
            data-testid={`roadmap-stat-${card.key}`}
            className={`mt-1 text-2xl font-bold ${card.valueColor}`}
          >
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
