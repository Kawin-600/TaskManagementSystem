import { useEffect, useState } from 'react';
import { useAuth } from '../state/AuthContext';
import { useWorkspace } from '../state/WorkspaceContext';
import { getThaiStatusName } from '../components/ui/Badges';
import { readTelegramPreferences, requestTelegramSettings, saveTelegramPreferences } from '../services/telegramSettings';
import {
  buildTelegramDigest, selectTelegramDigestTasks, telegramDigestKinds, telegramDigestLabels,
  telegramPriorities, telegramPriorityLabels, telegramTopics, type TelegramDigestKind,
} from '../domain/telegramDigest';
import { taskNotificationMessages } from '../domain/taskNotifications';

function TelegramSettings({ userId }: { userId: string }) {
  const [configured, setConfigured] = useState<boolean>();
  const [token, setToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    requestTelegramSettings(userId, 'status', undefined, controller.signal)
      .then((result) => setConfigured(result.configured === true))
      .catch(() => { if (!controller.signal.aborted) setFeedback('โหลดการตั้งค่า Telegram ไม่สำเร็จ'); });
    return () => controller.abort();
  }, [userId]);

  async function update(action: 'save' | 'test' | 'clear') {
    setBusy(true);
    setFeedback('');
    try {
      const result = await requestTelegramSettings(userId, action, action === 'save' ? { token, chatId } : undefined);
      if (action === 'test') {
        setFeedback(result.result === 'accepted'
          ? 'Telegram ตอบรับข้อความทดสอบแล้ว ลองเปิดแชตกับบอต'
          : 'ส่งข้อความทดสอบไม่สำเร็จ ตรวจสอบ Token, Chat ID และกด Start กับบอตก่อน');
      } else {
        setConfigured(result.configured === true);
        setToken('');
        setChatId('');
        setFeedback(action === 'save' ? 'บันทึกการตั้งค่าแล้ว' : 'ลบการตั้งค่าแล้ว');
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void update('save'); }}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-600">
        {configured === undefined ? 'กำลังตรวจการตั้งค่า…' : configured ? 'มีการตั้งค่าส่วนตัวแล้ว' : 'ยังไม่มีการตั้งค่าส่วนตัว'}
      </p>
      <label className="block text-sm font-medium text-slate-700">
        Bot Token
        <input type="password" autoComplete="off" required maxLength={128} value={token}
          onChange={(event) => setToken(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Chat ID ส่วนตัว
        <input inputMode="numeric" autoComplete="off" required maxLength={16} value={chatId}
          onChange={(event) => setChatId(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !token.trim() || !chatId.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">บันทึก</button>
        {configured && (
          <>
            <button type="button" disabled={busy} onClick={() => void update('test')}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">ส่งข้อความทดสอบ</button>
            <button type="button" disabled={busy} onClick={() => void update('clear')}
              className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700 disabled:opacity-50">ลบการตั้งค่า</button>
          </>
        )}
      </div>
      <p role="status" className="text-sm text-slate-700">{feedback}</p>
    </form>
  );
}

function TelegramChecklist<T extends string>({ title, options, labels, selected, onChange }: {
  title: string;
  options: readonly T[];
  labels: Record<T, string>;
  selected: T[];
  onChange: (values: T[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold text-slate-900">{title}</legend>
      {options.map((option) => (
        <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={selected.includes(option)} onChange={(event) =>
            onChange(event.target.checked ? [...selected, option] : selected.filter((value) => value !== option))
          } />
          {labels[option]}
        </label>
      ))}
    </fieldset>
  );
}

function TelegramConditionSettings({ userId }: { userId: string }) {
  const { visibleTasks, isLoading } = useWorkspace();
  const [preferences, setPreferences] = useState(() => readTelegramPreferences(userId));
  const [feedback, setFeedback] = useState('');
  const [simulating, setSimulating] = useState<TelegramDigestKind | null>(null);
  const [simulationFeedback, setSimulationFeedback] = useState('');

  async function simulate(kind: TelegramDigestKind) {
    const time = kind === 'pending' ? '08:00' : '17:00';
    setSimulating(kind);
    setSimulationFeedback('');
    try {
      const tasks = selectTelegramDigestTasks(visibleTasks, userId, preferences.priorities, kind, new Date());
      const result = await requestTelegramSettings(userId, 'digest', {
        ...buildTelegramDigest(kind, tasks, getThaiStatusName),
        simulated: true,
      });
      if (result.result === 'accepted') {
        setSimulationFeedback(`Telegram ตอบรับข้อความจำลองรอบ ${time} แล้ว (${tasks.length} งาน)`);
      } else if (result.result === 'unconfigured') {
        setSimulationFeedback('บันทึก Bot Token และ Chat ID ของบัญชีนี้ก่อนจำลองรอบส่ง');
      } else {
        setSimulationFeedback(`ส่งข้อความจำลองรอบ ${time} ไม่สำเร็จ`);
      }
    } catch {
      setSimulationFeedback('ติดต่อระบบแจ้งเตือน Telegram ไม่สำเร็จ');
    } finally {
      setSimulating(null);
    }
  }

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      try {
        saveTelegramPreferences(userId, preferences);
        setFeedback('บันทึกเงื่อนไขแล้ว');
      } catch {
        setFeedback('บันทึกเงื่อนไขไม่สำเร็จ');
      }
    }} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">กำหนดเงื่อนไขการแจ้งเตือน</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TelegramChecklist title="แจ้งทันทีเมื่อ" options={telegramTopics}
          labels={{ ...taskNotificationMessages, statusChanged: 'มีการเปลี่ยนสถานะงาน' }} selected={preferences.topics}
          onChange={(topics) => setPreferences({ ...preferences, topics })} />
        <TelegramChecklist title="ความสำคัญของงาน" options={telegramPriorities}
          labels={telegramPriorityLabels} selected={preferences.priorities}
          onChange={(priorities) => setPreferences({ ...preferences, priorities })} />
      </div>
      <TelegramChecklist title="สรุปรายวัน" options={telegramDigestKinds} labels={telegramDigestLabels}
        selected={preferences.digests} onChange={(digests) => setPreferences({ ...preferences, digests })} />
      <p className="text-sm text-slate-600">สรุปเฉพาะงานที่คุณรับผิดชอบ ใช้เวลาของเครื่อง และต้องเปิดเว็บพร้อมล็อกอินไว้</p>
      <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
        บันทึกเงื่อนไข
      </button>
      {feedback && <p role="status" className="text-sm text-slate-700">{feedback}</p>}
      <div className="space-y-2 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap gap-2">
          {telegramDigestKinds.map((kind) => (
            <button key={kind} type="button" onClick={() => void simulate(kind)}
              disabled={isLoading || simulating !== null || !preferences.priorities.length}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50">
              {simulating === kind ? 'กำลังส่ง…' : `จำลองรอบ ${kind === 'pending' ? '08:00' : '17:00'}`}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-600">ส่งข้อความทดสอบเข้า Telegram ทันที โดยใช้ระดับความสำคัญที่เลือกตอนนี้</p>
        {simulationFeedback && <p role="status" className="text-sm text-slate-700">{simulationFeedback}</p>}
      </div>
    </form>
  );
}

export function TelegramSettingsPage() {
  const { currentUser } = useAuth();
  const { users, updateExcelAlias } = useWorkspace();
  const user = users.find((item) => item.id === currentUser?.id);
  const [alias, setAlias] = useState('');
  useEffect(() => { setAlias(user?.excelAlias ?? ''); }, [user?.id, user?.excelAlias]);
  if (!currentUser) return null;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-bold text-slate-900">ตั้งค่าบัญชีและ Telegram</h1>
      <form onSubmit={(event) => { event.preventDefault(); void updateExcelAlias(alias); }} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label htmlFor="excel-alias" className="block text-sm font-semibold text-slate-700">ชื่อเล่นที่ใช้ใน Excel</label>
        <p className="text-xs text-slate-500">ใช้จับคู่กับคอลัมน์ Owner ตอนนำเข้างาน</p>
        <input id="excel-alias" value={alias} onChange={(event) => setAlias(event.target.value)} maxLength={100} className="block w-full rounded-lg border border-slate-300 px-3 py-2" />
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">บันทึกชื่อ</button>
      </form>
      <p className="text-sm text-slate-600">รับแจ้งเตือนงานของ {currentUser.name} ทางแชตส่วนตัวกับบอต</p>
      <TelegramSettings key={currentUser.id} userId={currentUser.id} />
      <TelegramConditionSettings key={`conditions-${currentUser.id}`} userId={currentUser.id} />
    </div>
  );
}
