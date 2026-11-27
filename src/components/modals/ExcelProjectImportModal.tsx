import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { AlertCircle, FileSpreadsheet, Upload } from 'lucide-react';
import { useAuth } from '../../state/AuthContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import { parseProjectExcel, splitOwnerNames, type ExcelProjectPreview } from '../../services/excelProjectImport';
import { Modal } from '../ui/Modal';

interface ExcelProjectImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExcelProjectImportModal({ isOpen, onClose }: ExcelProjectImportModalProps) {
  const { currentUser } = useAuth();
  const { importProjects, users } = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExcelProjectPreview | null>(null);
  const [selectedProjectNames, setSelectedProjectNames] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [ownerAssignments, setOwnerAssignments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setFile(null);
    setPreview(null);
    setSelectedProjectNames(new Set());
    setError(null);
    setOwnerAssignments({});
    setIsReading(false);
    setIsImporting(false);
  }, [isOpen]);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(null);
    setSelectedProjectNames(new Set());
    setError(null);
    if (!selected) return;
    setIsReading(true);
    try {
      const parsed = await parseProjectExcel(await selected.arrayBuffer());
      const assignments: Record<string, string> = {};
      for (const project of parsed.projects) for (const task of project.tasks) {
        for (const owner of splitOwnerNames(task.ownerName)) {
        const matches = users.filter((user) => user.excelAlias?.trim().toLocaleLowerCase() === owner.toLocaleLowerCase());
        assignments[owner] = matches.length === 1 ? matches[0].id : currentUser?.id ?? '';
        }
      }
      setOwnerAssignments(assignments);
      setPreview(parsed);
      setSelectedProjectNames(new Set(parsed.projects.map((project) => project.name)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อ่านไฟล์ Excel ไม่สำเร็จ');
    } finally {
      setIsReading(false);
      event.target.value = '';
    }
  };

  const handleImport = async () => {
    if (!currentUser || !file || !preview) return;
    const selectedProjects = preview.projects.filter((project) => selectedProjectNames.has(project.name));
    if (selectedProjects.length === 0) {
      setError('กรุณาเลือกอย่างน้อย 1 โปรเจค');
      return;
    }
    setIsImporting(true);
    const result = await importProjects({
      projects: selectedProjects.map((project) => ({ ...project, tasks: project.tasks.map((task) => ({
        ...task,
        assigneeId: ownerAssignments[splitOwnerNames(task.ownerName)[0]] || currentUser.id,
        collaboratorIds: splitOwnerNames(task.ownerName).slice(1).map((owner) => ownerAssignments[owner] || currentUser.id),
      })) })),
      supervisorId: currentUser.id,
      sourceName: file.name,
    });
    setIsImporting(false);
    if (result) onClose();
  };

  const selectedProjects = preview?.projects.filter((project) => selectedProjectNames.has(project.name)) ?? [];
  const selectedTaskCount = selectedProjects.reduce((total, project) => total + project.tasks.length, 0);
  const ownerNames = [...new Set(selectedProjects.flatMap((project) => project.tasks.flatMap((task) => splitOwnerNames(task.ownerName))))];

  const toggleProject = (projectName: string) => {
    setSelectedProjectNames((current) => {
      const next = new Set(current);
      if (next.has(projectName)) next.delete(projectName);
      else next.add(projectName);
      return next;
    });
    setError(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="นำเข้าโปรเจคจาก Excel"
      subtitle="ประเภท = ชื่อโปรเจค, Module = Module, Task = งาน, เพิ่มเติม = รายละเอียดเพิ่มเติม"
      size="lg"
    >
      <div className="space-y-4 text-xs">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFile}
          className="hidden"
          aria-label="เลือกไฟล์ Excel"
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isReading || isImporting}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-7 text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-60"
        >
          <FileSpreadsheet className="h-8 w-8" />
          <span className="font-bold">{isReading ? 'กำลังอ่านไฟล์...' : 'เลือกไฟล์ Excel'}</span>
          <span className="text-[11px] text-indigo-500">รองรับไฟล์ .xlsx และ .xls</span>
        </button>

        {file && <p className="truncate text-slate-500">ไฟล์: {file.name}</p>}

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {preview && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-slate-800">ตัวอย่างข้อมูลจากชีต {preview.sheetName}</p>
                <p className="mt-0.5 text-slate-500">
                  เลือกแล้ว {selectedProjects.length}/{preview.projects.length} โปรเจค และ {selectedTaskCount} งาน
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedProjectNames(new Set(preview.projects.map((project) => project.name)))}
                  className="font-semibold text-indigo-600 hover:underline"
                >
                  เลือกทั้งหมด
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedProjectNames(new Set())}
                  className="font-semibold text-slate-500 hover:underline"
                >
                  ยกเลิกทั้งหมด
                </button>
              </div>
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {preview.projects.map((project) => (
                <label
                  key={project.name}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white px-3 py-2 transition ${
                    selectedProjectNames.has(project.name)
                      ? 'border-indigo-300 ring-1 ring-indigo-100'
                      : 'border-slate-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedProjectNames.has(project.name)}
                    onChange={() => toggleProject(project.name)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-indigo-600"
                    aria-label={`เลือกโปรเจค ${project.name}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-bold text-slate-700">{project.name}</span>
                      <span className="shrink-0 text-slate-400">{project.tasks.length} งาน</span>
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-slate-500">
                      {project.tasks.map((task) => task.title).filter((title, index, all) => all.indexOf(title) === index).join(', ')}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {preview && ownerNames.length > 0 && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <p className="font-bold text-slate-800">จับคู่ Owner จาก Excel</p>
            <p className="text-slate-500">Owner คนแรกเป็นผู้รับผิดชอบหลัก คนที่เหลือเป็นผู้มีส่วนร่วม โดยคั่นชื่อด้วย , ; / หรือขึ้นบรรทัดใหม่ ชื่อที่ไม่พบหรือซ้ำกันกำหนดเป็นผู้นำเข้า โปรดตรวจสอบก่อนนำเข้า</p>
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {ownerNames.map((owner) => {
                const matches = users.filter((user) => user.excelAlias?.trim().toLocaleLowerCase() === owner.toLocaleLowerCase());
                return <label key={owner} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-700">{owner} {matches.length !== 1 && <span className="text-amber-700">({matches.length ? 'ชื่อซ้ำ' : 'ไม่พบชื่อ'})</span>}</span>
                  <select aria-label={`ผู้รับผิดชอบสำหรับ ${owner}`} value={ownerAssignments[owner] ?? currentUser?.id ?? ''} onChange={(event) => setOwnerAssignments((current) => ({ ...current, [owner]: event.target.value }))} className="rounded-lg border border-slate-200 px-2 py-1.5">
                    {users.map((user) => <option key={user.id} value={user.id}>{user.name}{user.excelAlias ? ` (${user.excelAlias})` : ''}</option>)}
                  </select>
                </label>;
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!preview || selectedProjects.length === 0 || isImporting}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {isImporting ? 'กำลังนำเข้า...' : 'ยืนยันนำเข้า'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
