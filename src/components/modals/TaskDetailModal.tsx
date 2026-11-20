import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { calculateDaysBetween } from '../../domain/dates';
import { tokenizeCommentText } from '../../domain/linkify';
import {
  canApproveOrRejectTask,
  canCommentOnTask,
  canDeleteTask,
  canEditTask,
  getAssignableMembers,
} from '../../domain/rbac';
import { useAuth } from '../../state/AuthContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import type { TaskPriority, TaskStatus } from '../../types/models';
import { AvatarCircle } from '../ui/Badges';
import { Modal } from '../ui/Modal';

interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
  const { currentUser } = useAuth();
  const {
    visibleTasks,
    visibleProjects,
    visibleMilestones,
    users,
    updateTask,
    approveTask,
    rejectTask,
    deleteTask,
    addComment,
  } = useWorkspace();

  const task = useMemo(
    () => (taskId ? visibleTasks.find((t) => t.id === taskId) ?? null : null),
    [taskId, visibleTasks],
  );
  const project = useMemo(
    () => (task ? visibleProjects.find((p) => p.id === task.projectId) ?? undefined : undefined),
    [task, visibleProjects],
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const taskIdKey = task?.id ?? null;

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description);
    setMilestoneId(task.milestoneId ?? '');
    setAssigneeId(task.assigneeId);
    setStatus(task.status);
    setPriority(task.priority);
    setStartDate(task.startDate);
    setDueDate(task.dueDate);
    setCommentInput('');
    setFormError(null);
    setConfirmingDelete(false);
    // Sync form only when switching to a different task, not when comments reload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskIdKey]);

  if (!task || !currentUser) return null;

  const editable = canEditTask(currentUser, task, project);
  const canApprove = canApproveOrRejectTask(currentUser, task, project);
  const deletable = canDeleteTask(currentUser, task, project);
  const commentable = canCommentOnTask(currentUser, task, project);
  const isStaffCompletedLock = currentUser.role === 'staff' && task.status === 'completed';
  const assignable = project ? getAssignableMembers(currentUser, project, users) : users;
  const assigneeOptions = assignable.some((u) => u.id === task.assigneeId)
    ? assignable
    : [...assignable, ...users.filter((u) => u.id === task.assigneeId)];
  const projectMilestones = visibleMilestones.filter(
    (milestone) => milestone.projectId === task.projectId,
  );

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!editable) return;
    if (!title.trim()) {
      setFormError('กรุณาระบุชื่องาน');
      return;
    }
    if (!startDate || !dueDate) {
      setFormError('กรุณาระบุวันเริ่มต้นและวันกำหนดส่ง');
      return;
    }
    if (dueDate < startDate) {
      setFormError('วันกำหนดส่งต้องไม่น้อยกว่าวันเริ่มต้น');
      return;
    }
    const updated = await updateTask(task.id, {
      title: title.trim(),
      description: description.trim(),
      milestoneId: milestoneId || null,
      assigneeId,
      status,
      priority,
      startDate,
      dueDate,
    });
    if (updated) {
      onClose();
    }
  };

  const handleApprove = async () => {
    const ok = await approveTask(task.id);
    if (ok) onClose();
  };

  const handleReject = async () => {
    const ok = await rejectTask(task.id);
    if (ok) onClose();
  };

  const handleDelete = async () => {
    const ok = await deleteTask(task.id);
    if (ok) onClose();
  };

  const handleAddComment = async () => {
    if (!commentInput.trim()) return;
    const ok = await addComment(task.id, commentInput);
    if (ok) setCommentInput('');
  };

  const durationDays =
    startDate && dueDate && dueDate >= startDate ? calculateDaysBetween(startDate, dueDate) : 0;

  return (
    <Modal
      isOpen={Boolean(task)}
      onClose={onClose}
      title={project?.name ?? 'รายละเอียดงาน'}
      headerAccent={project?.color ?? '#4f46e5'}
    >
      <div className="space-y-4 text-xs">
        {isStaffCompletedLock && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-emerald-800">
            <Lock className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              งานนี้ได้รับการอนุมัติเสร็จสิ้นแล้ว หากต้องการแก้ไขโปรดแจ้งหัวหน้างานหรือ Admin เพื่อเปิดงานใหม่
            </span>
          </div>
        )}

        {formError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSave} noValidate className="space-y-4">
          <div>
            <label htmlFor="edit-task-title" className="mb-1 block font-semibold text-slate-700">
              ชื่องาน *
            </label>
            <input
              id="edit-task-title"
              type="text"
              value={title}
              disabled={!editable}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-800 disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>

          <div>
            <label htmlFor="edit-task-desc" className="mb-1 block font-semibold text-slate-700">
              รายละเอียด
            </label>
            <textarea
              id="edit-task-desc"
              rows={2}
              value={description}
              disabled={!editable}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>

          <div>
            <label htmlFor="edit-task-milestone" className="mb-1 block font-semibold text-slate-700">
              Milestone (ไม่บังคับ)
            </label>
            <select
              id="edit-task-milestone"
              value={
                projectMilestones.some((milestone) => milestone.id === milestoneId)
                  ? milestoneId
                  : ''
              }
              disabled={!editable}
              onChange={(e) => setMilestoneId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="">ไม่เชื่อมกับ Milestone</option>
              {projectMilestones.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="edit-task-assignee" className="mb-1 block font-semibold text-slate-700">
                ผู้รับผิดชอบ
              </label>
              <select
                id="edit-task-assignee"
                value={assigneeId}
                disabled={!editable || currentUser.role === 'staff'}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="">ยังไม่มอบหมาย</option>
                {assigneeOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="edit-task-status" className="mb-1 block font-semibold text-slate-700">
                สถานะ
              </label>
              <select
                id="edit-task-status"
                value={status}
                disabled={!editable}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="todo">รอดำเนินการ</option>
                <option value="in_progress">กำลังทำ</option>
                <option value="review">รอตรวจสอบ (Review)</option>
                <option value="completed">เสร็จสิ้น</option>
              </select>
            </div>

            <div>
              <label htmlFor="edit-task-priority" className="mb-1 block font-semibold text-slate-700">
                ความสำคัญ
              </label>
              <select
                id="edit-task-priority"
                value={priority}
                disabled={!editable}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="low">ต่ำ</option>
                <option value="medium">ปานกลาง</option>
                <option value="high">สูง</option>
                <option value="urgent">ด่วนที่สุด</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-task-start" className="mb-1 block font-semibold text-slate-700">
                วันเริ่มต้น
              </label>
              <input
                id="edit-task-start"
                type="date"
                value={startDate}
                disabled={!editable}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-800 disabled:bg-slate-100"
              />
            </div>
            <div>
              <label htmlFor="edit-task-due" className="mb-1 block font-semibold text-slate-700">
                วันกำหนดส่ง {durationDays > 0 ? `(${durationDays} วัน)` : ''}
              </label>
              <input
                id="edit-task-due"
                type="date"
                value={dueDate}
                disabled={!editable}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-800 disabled:bg-slate-100"
              />
            </div>
          </div>

          {canApprove && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
              <div>
                <p className="font-bold text-amber-900">งานนี้อยู่ระหว่างรอการอนุมัติ</p>
                <p className="text-[11px] text-amber-700">ตรวจสอบผลงานและเลือกการอนุมัติได้ทันที</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApprove}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 font-bold text-white transition hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>อนุมัติงาน</span>
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 font-bold text-white transition hover:bg-rose-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>ส่งกลับแก้ไข</span>
                </button>
              </div>
            </div>
          )}

          {/* Footer Save / Delete */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            {deletable ? (
              confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-rose-600">
                    ยืนยันลบงานนี้?
                    {task.milestoneId && ' Milestone ที่เชื่อมอยู่จะถูกลบไปพร้อมกัน'}
                  </span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="rounded-lg bg-rose-600 px-2.5 py-1 font-bold text-white hover:bg-rose-700"
                  >
                    ลบเลย
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-slate-600"
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="inline-flex items-center gap-1 font-semibold text-rose-600 hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>ลบงานนี้</span>
                </button>
              )
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
              >
                ปิด
              </button>
              {editable && (
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-indigo-700"
                >
                  บันทึกการแก้ไข
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Comments Section */}
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <h4 className="flex items-center gap-2 font-bold text-slate-800">
            <MessageSquare className="h-4 w-4 text-indigo-500" />
            <span>ความคิดเห็น &amp; แนบลิงก์ส่งงาน ({task.comments.length})</span>
          </h4>

          <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
            {task.comments.length === 0 ? (
              <p className="py-2 text-center text-slate-400">ยังไม่มีความคิดเห็น</p>
            ) : (
              task.comments.map((comment) => {
                const author = users.find((u) => u.id === comment.userId);
                const segments = tokenizeCommentText(comment.text);
                return (
                  <div
                    key={comment.id}
                    className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AvatarCircle
                          avatar={author?.avatar ?? '?'}
                          color={author?.color}
                          size="xs"
                        />
                        <span className="font-semibold text-slate-800">
                          {author?.name ?? 'ผู้ใช้งาน'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {comment.createdAt.replace('T', ' ').slice(0, 16)}
                      </span>
                    </div>
                    <p className="break-words pl-7 text-slate-700">
                      {segments.map((seg, idx) =>
                        seg.type === 'link' ? (
                          <a
                            key={idx}
                            href={seg.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-indigo-600 underline hover:text-indigo-800"
                          >
                            {seg.value}
                          </a>
                        ) : (
                          <span key={idx}>{seg.value}</span>
                        ),
                      )}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {commentable && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                placeholder="พิมพ์ข้อความหรือวางลิงก์ส่งงาน (https://...)..."
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-800 outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddComment}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
              >
                <Send className="h-3.5 w-3.5" />
                <span>ส่ง</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
