import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowRight, Trash2, Pencil, Clock, Download, FileSpreadsheet } from 'lucide-react';
import { canCreateProject, canManageProject } from '../domain/rbac';
import { useAuth } from '../state/AuthContext';
import { useWorkspace } from '../state/WorkspaceContext';
import type { Project } from '../types/models';
import { AvatarCircle } from '../components/ui/Badges';
import { Modal } from '../components/ui/Modal';
import { ExcelProjectImportModal } from '../components/modals/ExcelProjectImportModal';
import { exportProjectsToExcel } from '../services/excelProjectExport';
import { getTodayStr } from '../domain/dates';
import { useToast } from '../state/ToastContext';

interface ProjectsOverviewPageProps {
  onOpenCreateProject: () => void;
  onOpenEditProject: (project: Project) => void;
}

export function ProjectsOverviewPage({
  onOpenCreateProject,
  onOpenEditProject,
}: ProjectsOverviewPageProps) {
  const { currentUser } = useAuth();
  const { visibleProjects, visibleTasks, users, deleteProject } = useWorkspace();
  const { showToast } = useToast();
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (!currentUser) return null;

  const handleConfirmDelete = async () => {
    if (!deletingProject) return;
    await deleteProject(deletingProject.id);
    setDeletingProject(null);
  };

  const handleExport = async () => {
    if (visibleProjects.length === 0 || isExporting) return;
    setIsExporting(true);
    try {
      await exportProjectsToExcel(
        visibleProjects,
        visibleTasks,
        users,
        `TaskFlow-projects-${getTodayStr()}.xlsx`,
      );
      showToast(`ส่งออก ${visibleProjects.length} โปรเจค และ ${visibleTasks.length} งานเรียบร้อยแล้ว`, 'success');
    } catch {
      showToast('ส่งออกไฟล์ Excel ไม่สำเร็จ', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-bold text-slate-800">
            โปรเจคทั้งหมด ({visibleProjects.length})
          </h3>
          <p className="text-xs text-slate-500">
            คลิกที่โปรเจคเพื่อเข้าสู่พื้นที่ทำงาน Kanban / List / Timeline / Calendar
          </p>
        </div>

        {canCreateProject(currentUser) && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={visibleProjects.length === 0 || isExporting}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>{isExporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>นำเข้า Excel</span>
            </button>
            <button
              type="button"
              onClick={onOpenCreateProject}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              <span>สร้างโปรเจคใหม่</span>
            </button>
          </div>
        )}
      </div>

      {visibleProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-400">
          ยังไม่มีโปรเจคที่คุณมีสิทธิ์เข้าถึง
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleProjects.map((project) => {
            const prjTasks = visibleTasks.filter((t) => t.projectId === project.id);
            const doneTasks = prjTasks.filter((t) => t.status === 'completed').length;
            const reviewCount = prjTasks.filter((t) => t.status === 'review').length;
            const pct = prjTasks.length > 0 ? Math.round((doneTasks / prjTasks.length) * 100) : 0;
            const supervisor = users.find((u) => u.id === project.supervisorId);
            const members = users.filter((u) => project.memberIds.includes(u.id));
            const manageable = canManageProject(currentUser, project);

            return (
              <div
                key={project.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="h-2" style={{ backgroundColor: project.color }} />

                <div className="flex flex-1 flex-col justify-between space-y-4 p-5">
                  <div>
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <Link
                        to={`/projects/${project.id}`}
                        className="text-base font-bold leading-snug text-slate-800 transition hover:text-indigo-600"
                      >
                        {project.name}
                      </Link>
                      {reviewCount > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          <Clock className="h-3 w-3" />
                          รอตรวจ {reviewCount}
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">
                      {project.description || 'ไม่มีคำอธิบายเพิ่มเติม'}
                    </p>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-500">ความคืบหน้า</span>
                      <span className="font-bold text-slate-800">{pct}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: project.color }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1.5">
                        {members.slice(0, 4).map((m) => (
                          <span key={m.id} className="rounded-full ring-2 ring-white">
                            <AvatarCircle avatar={m.avatar} color={m.color} size="xs" />
                          </span>
                        ))}
                      </div>
                      <span className="text-[11px]">
                        หัวหน้า:{' '}
                        <strong className="font-semibold text-slate-700">
                          {supervisor ? supervisor.name.split(' ')[0] : '-'}
                        </strong>
                      </span>
                    </div>
                    <span className="font-medium text-slate-400">{prjTasks.length} งาน</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
                  <Link
                    to={`/projects/${project.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    <span>เข้าสู่ Workspace</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>

                  {manageable && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="แก้ไขโปรเจค"
                        onClick={() => onOpenEditProject(project)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-indigo-600"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="ลบโปรเจค"
                        onClick={() => setDeletingProject(project)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={Boolean(deletingProject)}
        onClose={() => setDeletingProject(null)}
        title="ยืนยันการลบโปรเจค"
        size="md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            คุณแน่ใจหรือไม่ว่าต้องการลบโปรเจค{' '}
            <strong className="text-slate-900">{deletingProject?.name}</strong> พร้อมงานทั้งหมดภายในโปรเจคนี้?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletingProject(null)}
              className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700"
            >
              ลบโปรเจค
            </button>
          </div>
        </div>
      </Modal>

      <ExcelProjectImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
    </div>
  );
}
