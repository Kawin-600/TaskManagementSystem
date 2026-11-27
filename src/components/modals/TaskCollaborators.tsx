import type { User } from '../../types/models';

interface Props {
  members: User[];
  ownerId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function TaskCollaborators({ members, ownerId, selected, onChange }: Props) {
  const candidates = members.filter(member => member.id !== ownerId);
  if (!ownerId || !candidates.length) return null;
  return (
    <fieldset className="rounded-xl border border-slate-200 px-3 pb-3">
      <legend className="px-1 font-semibold text-slate-700">ผู้ร่วมงาน (ไม่บังคับ)</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {candidates.map(member => (
          <label key={member.id} className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <input type="checkbox" checked={selected.includes(member.id)}
              onChange={e => onChange(e.target.checked ? [...selected, member.id] : selected.filter(id => id !== member.id))} />
            {member.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
