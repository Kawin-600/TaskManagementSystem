import {
  defaultTelegramPreferences, telegramDigestKinds, telegramPriorities, telegramTopics, type TelegramPreferences,
  type buildTelegramDigest,
} from '../domain/telegramDigest';

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
  action: 'status' | 'save' | 'test' | 'clear' | 'digest',
  fields?: { token: string; chatId: string } | (ReturnType<typeof buildTelegramDigest> & { simulated?: boolean }),
  signal?: AbortSignal,
) {
  const response = await fetch('/api/task-notifications/telegram', {
    method: 'POST',
    headers: telegramHeaders(),
    body: JSON.stringify({ userId, action, ...fields }),
    signal: signal ?? AbortSignal.timeout(10000),
  });
  if (response.status === 409 && (action === 'test' || action === 'digest')) return { result: 'unconfigured' };
  if (!response.ok) {
    throw new Error(response.status === 400 ? 'ตรวจสอบรูปแบบ Bot Token และ Chat ID ส่วนตัว' : 'ติดต่อระบบตั้งค่า Telegram ไม่สำเร็จ');
  }
  return response.json();
}
const preferencesKey = (userId: string) => `taskflow.telegramPreferences.${userId}`;

export function readTelegramPreferences(userId: string): TelegramPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(preferencesKey(userId)) ?? 'null');
    if (Array.isArray(value?.digests) && Array.isArray(value.priorities) && Array.isArray(value.topics)) {
      const legacyTopics = ['created', 'assigned', 'dueDateChanged', 'statusChanged'];
      const selectedTopics = legacyTopics.every((topic) => value.topics.includes(topic)) &&
        !value.topics.includes('priorityChanged')
        ? [...value.topics, 'priorityChanged']
        : value.topics;
      return {
        digests: telegramDigestKinds.filter((kind) => value.digests.includes(kind)),
        priorities: telegramPriorities.filter((priority) => value.priorities.includes(priority)),
        topics: telegramTopics.filter((topic) => selectedTopics.includes(topic)),
      };
    }
  } catch {
    return defaultTelegramPreferences;
  }
  return defaultTelegramPreferences;
}

export function saveTelegramPreferences(userId: string, value: TelegramPreferences) {
  localStorage.setItem(preferencesKey(userId), JSON.stringify(value));
  window.dispatchEvent(new Event('taskflow:telegram-preferences'));
}
