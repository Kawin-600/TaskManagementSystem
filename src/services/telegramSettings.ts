import { defaultTelegramReminder, type TelegramReminder } from '../domain/telegramReminder';

export function telegramHeaders() {
  const key = 'taskflow.telegramWorkspace';
  let workspace = localStorage.getItem(key);
  if (!workspace) {
    workspace = crypto.randomUUID();
    localStorage.setItem(key, workspace);
  }
  return { 'Content-Type': 'application/json', 'X-TaskFlow-Workspace': workspace };
}

export async function requestTelegramSettings(
  userId: string,
  action: 'status' | 'save' | 'test' | 'clear',
  fields?: { token: string; chatId: string },
  signal?: AbortSignal,
) {
  const response = await fetch('/api/task-notifications/telegram', {
    method: 'POST',
    headers: telegramHeaders(),
    body: JSON.stringify({ userId, action, ...fields }),
    signal: signal ?? AbortSignal.timeout(10000),
  });
  if (response.status === 409 && action === 'test') return { result: 'unconfigured' };
  if (!response.ok) {
    throw new Error(response.status === 400 ? 'ตรวจสอบรูปแบบ Bot Token และ Chat ID ส่วนตัว' : 'ติดต่อระบบตั้งค่า Telegram ไม่สำเร็จ');
  }
  return response.json();
}
const reminderKey = (userId: string) => `taskflow.telegramReminder.${userId}`;

export function readTelegramReminder(userId: string): TelegramReminder {
  try {
    const rule = JSON.parse(localStorage.getItem(reminderKey(userId)) ?? 'null');
    if (typeof rule?.enabled === 'boolean' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.time) &&
        Number.isInteger(rule.daysBefore) && rule.daysBefore >= 0 && rule.daysBefore <= 30) return rule;
  } catch {
    return defaultTelegramReminder;
  }
  return defaultTelegramReminder;
}

export function saveTelegramReminder(userId: string, rule: TelegramReminder) {
  localStorage.setItem(reminderKey(userId), JSON.stringify(rule));
  window.dispatchEvent(new Event('taskflow:telegram-reminder'));
}
