import { participatesInTask } from './rbac';
import { addDays, formatThaiDateShort, getTodayStr } from './dates';
import type { Project, Task, TaskPriority } from '../types/models';

export interface AssistantReply {
  text: string;
  tasks?: Task[];
}

const priority: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function answerTaskQuestion(
  question: string,
  tasks: Task[],
  projects: Project[],
  userId: string,
  today = getTodayStr(),
): AssistantReply {
  const query = question.trim().toLowerCase();
  const project = [...projects]
    .sort((a, b) => b.name.length - a.name.length)
    .find(({ name }) => name.trim() && query.includes(name.toLowerCase()));
  const team = /ทีม|ทุกคน|ทุกโครงการ|ทุกโปรเจกต์/.test(query);
  const scope = project ? project.name : team ? 'ทีมที่คุณเข้าถึงได้' : 'ของคุณ';
  const scoped = tasks.filter((task) =>
    project ? task.projectId === project.id : team || participatesInTask(task, userId),
  );
  const pending = scoped.filter((task) => task.status !== 'completed');
  const overdue = pending.filter((task) => task.dueDate && task.dueDate < today);
  const planning = /แผน|จัดลำดับ|เริ่ม|ทำอะไรก่อน|ตัดสินใจ/.test(query);
  const todayOnly = /วันนี้/.test(query);
  const week = /สัปดาห์|7 วัน/.test(query);
  const limit = 5;

  const show = (label: string, items: Task[], compare: (a: Task, b: Task) => number): AssistantReply => ({
    text: `${label} (${scope}) ${items.length} งาน${items.length > limit ? ` แสดง ${limit} งานแรก` : ''}`,
    tasks: [...items].sort(compare).slice(0, limit),
  });
  const byDeadline = (a: Task, b: Task) =>
    (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || priority[a.priority] - priority[b.priority];

  if (planning) {
    const cutoff = week ? addDays(today, 6) : today;
    const ready = pending.filter((task) => (!task.startDate || task.startDate <= cutoff) && task.status !== 'review');
    const reviews = pending.filter((task) => task.status === 'review').length;
    const reply = show(week ? 'แผน 7 วันข้างหน้า' : 'ลำดับงานที่เริ่มได้วันนี้', ready, (a, b) => {
      const bucket = (task: Task) => task.dueDate && task.dueDate < today ? 0
        : task.dueDate && task.dueDate <= cutoff ? 1 : 2;
      return bucket(a) - bucket(b) || priority[a.priority] - priority[b.priority] || byDeadline(a, b);
    });
    if (ready.length) reply.text += '\nเริ่มจากงานแรก แล้วตรวจว่ามีงานใดต้องประสานคนอื่นก่อนลงมือ';
    if (reviews) reply.text += `\nมีอีก ${reviews} งานรอตรวจ ควรติดตามผลกับผู้ตรวจ`;
    return reply;
  }
  if (/เลยกำหนด|เกินกำหนด|ค้างส่ง/.test(query)) return show('งานเกินกำหนด', overdue, byDeadline);
  if (/รอตรวจ|รออนุมัติ/.test(query)) {
    return show('งานรอตรวจ', pending.filter((task) => task.status === 'review'), byDeadline);
  }
  if (todayOnly || week || /ใกล้ครบกำหนด/.test(query)) {
    const cutoff = todayOnly ? today : addDays(today, 6);
    const due = pending.filter((task) => task.dueDate >= today && task.dueDate <= cutoff);
    const reply = show(todayOnly ? 'งานครบกำหนดวันนี้' : 'งานครบกำหนดใน 7 วัน', due, byDeadline);
    if (overdue.length) reply.text += `\nมีงานเกินกำหนดอีก ${overdue.length} งาน`;
    return reply;
  }
  const matchingTask = [...tasks]
    .sort((a, b) => b.title.length - a.title.length)
    .find((task) => task.title.trim() && query.includes(task.title.toLowerCase()));
  if (matchingTask) {
    const date = matchingTask.dueDate ? formatThaiDateShort(matchingTask.dueDate) : 'ยังไม่ระบุ';
    return { text: `กำหนดส่ง ${date}`, tasks: [matchingTask] };
  }
  if (project || /สรุป|สถานะ|ภาพรวม/.test(query)) {
    const inProgress = pending.filter((task) => task.status === 'in_progress').length;
    const review = pending.filter((task) => task.status === 'review').length;
    return {
      text: `สรุปงาน (${scope}) ทั้งหมด ${scoped.length} งาน\nรอเริ่ม ${pending.length - inProgress - review} · กำลังทำ ${inProgress} · รอตรวจ ${review} · เสร็จแล้ว ${scoped.length - pending.length}\nเกินกำหนด ${overdue.length} งาน`,
    };
  }
  return { text: 'ลองถามว่า “วันนี้ครบกำหนดส่งงานอะไร” “สรุปงานทีม” หรือ “ช่วยวางแผน 7 วัน” ระบุชื่อโปรเจกต์เพื่อดูเฉพาะงานในโปรเจกต์นั้นได้' };
}
