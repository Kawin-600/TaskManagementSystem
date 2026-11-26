import { participatesInTask } from '../../domain/rbac';
import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { answerTaskQuestion, type AssistantReply } from '../../domain/taskAssistant';
import { formatThaiDateShort, getTodayStr } from '../../domain/dates';
import { useWorkspace } from '../../state/WorkspaceContext';
import { getThaiStatusName } from '../ui/Badges';

const suggestions = ['วันนี้ครบกำหนดส่งงานอะไร', 'มีงานไหนเกินกำหนด', 'ช่วยวางแผน 7 วัน', 'สรุปงานทีม'];

export function TaskAssistant({ userId, onOpenTaskDetail }: {
  userId: string;
  onOpenTaskDetail: (taskId: string) => void;
}) {
  const { visibleProjects, visibleTasks, isLoading } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<{ question: string; reply: AssistantReply; model?: string }[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, isLoading]);

  useEffect(() => {
    const history = historyRef.current;
    if (history) history.scrollTop = history.scrollHeight;
  }, [messages, open, pendingQuestion]);

  function close() {
    setOpen(false);
    toggleRef.current?.focus();
  }

  async function ask(value: string) {
    const question = value.trim();
    if (!question || isLoading || pendingQuestion) return;
    setDraft('');
    setPendingQuestion(question);
    const reply = answerTaskQuestion(question, visibleTasks, visibleProjects, userId);
    try {
      const projects = new Map(visibleProjects.map(({ id, name }) => [id, name]));
      const tasks = [...visibleTasks].sort((a, b) =>
        Number(b.status !== 'completed') - Number(a.status !== 'completed') ||
        Number(participatesInTask(b, userId)) - Number(participatesInTask(a, userId)) ||
        (a.dueDate || '9999').localeCompare(b.dueDate || '9999'),
      ).slice(0, 60).map((task) => ({
        title: task.title.slice(0, 120),
        project: projects.get(task.projectId)?.slice(0, 80),
        assignedToMe: participatesInTask(task, userId),
        status: task.status,
        priority: task.priority,
        startDate: task.startDate,
        dueDate: task.dueDate,
      }));
      const history = messages.filter((message) => message.model).slice(-4).flatMap((message) => [
        { role: 'user', text: message.question },
        { role: 'model', text: message.reply.text },
      ]);
      const response = await fetch('/api/task-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history,
          prompt: JSON.stringify({ question, today: getTodayStr(), visibleTaskCount: visibleTasks.length, tasks }),
        }),
        signal: AbortSignal.timeout(23000),
      });
      if (!response.ok) throw new Error('Gemini unavailable');
      const result = await response.json();
      if (typeof result.text !== 'string' || typeof result.model !== 'string') throw new Error('Invalid response');
      setMessages((previous) => [...previous, { question, reply: { text: result.text }, model: result.model }]);
    } catch {
      setMessages((previous) => [...previous, { question, reply }]);
    } finally {
      setPendingQuestion('');
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-30 sm:bottom-6 sm:right-6">
      {open && (
        <section
          id="task-assistant"
          aria-labelledby="task-assistant-title"
          onKeyDown={(event) => { if (event.key === 'Escape') close(); }}
          className="absolute bottom-14 right-0 flex h-[32rem] max-h-[calc(100dvh-6rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:w-96"
        >
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 id="task-assistant-title" className="text-sm font-semibold text-slate-900">ผู้ช่วยจัดการงาน</h2>
            <button type="button" onClick={close} aria-label="ปิดแชต" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </header>
          <div ref={historyRef} role="log" aria-label="บทสนทนา" className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
            <p className="text-slate-600">ถามเรื่องกำหนดส่ง สถานะงาน หรือให้ช่วยจัดลำดับงานได้เลย</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((question) => (
                <button key={question} type="button" disabled={isLoading} onClick={() => ask(question)}
                  className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-50">
                  {question}
                </button>
              ))}
            </div>
            {messages.map(({ question, reply, model }, index) => (
              <div key={index} className="space-y-2">
                <p className="ml-auto w-fit max-w-[90%] break-words rounded-xl bg-indigo-600 px-3 py-2 text-white">{question}</p>
                <div className="rounded-xl bg-slate-50 p-3 text-slate-800">
                  <p className="mb-1 text-xs text-slate-500">{model ?? 'Gemini ใช้งานไม่ได้ · คำตอบจากกฎในแอป'}</p>
                  <p className="whitespace-pre-line break-words">{reply.text}</p>
                  {!!reply.tasks?.length && (
                    <ol className="mt-2 space-y-1">
                      {reply.tasks.map(({ id }) => {
                        const task = visibleTasks.find((item) => item.id === id);
                        if (!task) return null;
                        return (
                          <li key={id}>
                            <button type="button" onClick={() => { close(); onOpenTaskDetail(id); }}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-indigo-300">
                              <span className="block break-words font-medium text-indigo-800">{task.title}</span>
                              <span className="text-xs text-slate-600">
                                {getThaiStatusName(task.status)} · {task.dueDate ? formatThaiDateShort(task.dueDate) : 'ยังไม่มีกำหนดส่ง'}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              </div>
            ))}
            {pendingQuestion && (
              <div className="space-y-2">
                <p className="ml-auto w-fit max-w-[90%] break-words rounded-xl bg-indigo-600 px-3 py-2 text-white">{pendingQuestion}</p>
                <p className="text-slate-500">Gemini กำลังตอบ…</p>
              </div>
            )}
          </div>
          <form className="flex gap-2 border-t border-slate-100 p-3" onSubmit={(event) => { event.preventDefault(); ask(draft); }}>
            <input ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={300}
              disabled={isLoading} placeholder={isLoading ? 'กำลังโหลดงาน…' : 'พิมพ์คำถามเกี่ยวกับงาน'}
              aria-label="คำถามเกี่ยวกับงาน"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            <button type="submit" disabled={isLoading || !!pendingQuestion || !draft.trim()} aria-label="ส่งคำถาม"
              className="rounded-lg bg-indigo-600 px-3 text-white hover:bg-indigo-700 disabled:opacity-40">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
      )}
      <button ref={toggleRef} type="button" aria-expanded={open} aria-controls={open ? 'task-assistant' : undefined}
        onClick={() => open ? close() : setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-indigo-700">
        <MessageCircle className="h-5 w-5" />
        ผู้ช่วยงาน
      </button>
    </div>
  );
}
