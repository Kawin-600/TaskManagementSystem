import { useEffect, useState } from 'react';
import { useAuth } from '../state/AuthContext';
import { readTelegramReminder, requestTelegramSettings, saveTelegramReminder } from '../services/telegramSettings';

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

function TelegramReminderSettings({ userId }: { userId: string }) {
  const [rule, setRule] = useState(() => readTelegramReminder(userId));
  const [feedback, setFeedback] = useState('');
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      try {
        saveTelegramReminder(userId, rule);
        setFeedback(rule.enabled ? 'เปิดเตือนตามเวลาแล้ว' : 'ปิดการเตือนตามเวลาแล้ว');
      } catch {
        setFeedback('บันทึกการตั้งค่าเวลาไม่สำเร็จ');
      }
    }} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">เตือนก่อนถึงกำหนดส่ง</h2>
      <p className="text-sm text-slate-600">เตือนงานที่ยังไม่เสร็จและคุณรับผิดชอบ ตามเวลาของเครื่อง ขณะที่เปิดเว็บและล็อกอินอยู่</p>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" checked={rule.enabled} onChange={(event) => setRule({ ...rule, enabled: event.target.checked })} />
        เปิดการเตือนตามเวลา
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          เตือนล่วงหน้า
          <select value={rule.daysBefore} onChange={(event) => setRule({ ...rule, daysBefore: Number(event.target.value) })}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
            <option value={0}>วันครบกำหนด</option>
            {Array.from({ length: 30 }, (_, index) => index + 1).map((days) => (
              <option key={days} value={days}>{days} วัน</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          เวลาที่ส่ง
          <input type="time" required value={rule.time} onChange={(event) => setRule({ ...rule, time: event.target.value })}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
      </div>
      <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
        บันทึกเวลาเตือน
      </button>
      {feedback && <p role="status" className="text-sm text-slate-700">{feedback}</p>}
    </form>
  );
}

export function TelegramSettingsPage() {
  const { currentUser } = useAuth();
  if (!currentUser) return null;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-bold text-slate-900">ตั้งค่า Telegram</h1>
      <p className="text-sm text-slate-600">รับแจ้งเตือนงานของ {currentUser.name} ทางแชตส่วนตัวกับบอต</p>
      <TelegramSettings key={currentUser.id} userId={currentUser.id} />
      <TelegramReminderSettings key={`reminder-${currentUser.id}`} userId={currentUser.id} />
    </div>
  );
}
