import type { Connect, Plugin } from 'vite';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { taskNotificationMessages, type TaskNotificationEvent } from '../src/domain/taskNotifications';

export function taskNotifications(env: Record<string, string>): Plugin {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_CHAT_IDS, LINE_CHANNEL_ACCESS_TOKEN, LINE_RECIPIENT_ID } = env;
  const personalChats = new Map<string, string>();
  const storage = resolve('.taskflow-notifications');
  type TelegramAccount = { token: string; chatId: string };
  async function readAccount(path: string): Promise<TelegramAccount | null> {
    try {
      return JSON.parse(await readFile(path, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }
  const sendTelegram = async (account: TelegramAccount, message: string) => {
    const response = await fetch(`https://api.telegram.org/bot${account.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: account.chatId, text: message }),
      signal: AbortSignal.timeout(8000),
    });
    return response.ok && (await response.json()).ok === true ? 'accepted' : 'failed';
  };
  if (TELEGRAM_CHAT_IDS) {
    try {
      const parsed: unknown = JSON.parse(TELEGRAM_CHAT_IDS);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      for (const [userId, chatId] of Object.entries(parsed)) {
        if (!userId || typeof chatId !== 'string' || !/^[1-9]\d{0,15}$/.test(chatId)) throw new Error();
        personalChats.set(userId, chatId);
      }
    } catch {
      personalChats.clear();
      console.warn('Invalid TELEGRAM_CHAT_IDS. Configure a JSON object mapping user IDs to private Telegram chat IDs.');
    }
  }

  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    const settings = req.url === '/api/task-notifications/telegram';
    if (!settings && req.url !== '/api/task-notifications') return next();

    const reply = (status: number, data?: object) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(data ? JSON.stringify(data) : undefined);
    };
    const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');
    const sameOrigin = !req.headers.origin || req.headers.origin === `http://${req.headers.host}`;
    const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(req.headers.host ?? '');
    if (!loopback || !localHost || !sameOrigin || req.headers['sec-fetch-site'] === 'cross-site') return reply(403);
    if (req.method !== 'POST') return reply(405);
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') return reply(415);
    let payload: {
      events?: unknown; test?: unknown; task?: unknown; assigneeId?: unknown;
      userId?: unknown; action?: unknown; token?: unknown; chatId?: unknown;
    } | null;
    try {
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 8192) return reply(413);
        chunks.push(chunk);
      }
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return reply(400);
    }
    const test = payload?.test === true;
    const assigneeId = typeof payload?.assigneeId === 'string' ? payload.assigneeId : '';
    const workspace = req.headers['x-taskflow-workspace'];
    const accountId = settings ? payload?.userId : assigneeId;
    const accountPath = typeof workspace === 'string' &&
      /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(workspace) &&
      typeof accountId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(accountId)
      ? resolve(storage, `${workspace}.${Buffer.from(accountId).toString('hex')}.json`)
      : undefined;
    let account: TelegramAccount | null = null;
    try {
      if (accountPath && !test) account = await readAccount(accountPath);
      if (settings) {
        if (!accountPath) return reply(400);
        if (payload?.action === 'status') return reply(200, { configured: Boolean(account) });
        if (payload?.action === 'test') {
          if (!account) return reply(409);
          try {
            return reply(200, { result: await sendTelegram(account, 'TaskFlow Pro · ข้อความทดสอบการแจ้งเตือน') });
          } catch {
            return reply(200, { result: 'failed' });
          }
        }
        if (payload?.action === 'clear') {
          await rm(accountPath, { force: true });
          return reply(200, { configured: false });
        }
        if (payload?.action !== 'save') return reply(400);
        const token = typeof payload.token === 'string' ? payload.token.trim() : '';
        const chatId = typeof payload.chatId === 'string' ? payload.chatId.trim() : '';
        if (!/^\d{1,20}:[a-zA-Z0-9_-]{15,100}$/.test(token) || !/^[1-9]\d{0,15}$/.test(chatId)) return reply(400);
        await mkdir(storage, { recursive: true, mode: 0o700 });
        const temporary = resolve(storage, `${randomUUID()}.tmp`);
        try {
          await writeFile(temporary, JSON.stringify({ token, chatId }), { mode: 0o600, flag: 'wx' });
          await rename(temporary, accountPath);
        } finally {
          await rm(temporary, { force: true });
        }
        return reply(200, { configured: true });
      }
    } catch {
      if (settings) return reply(500);
    }
    const reminder = Array.isArray(payload?.events) && payload.events.includes('dueReminder');
    const telegramChatId = test ? TELEGRAM_CHAT_ID : reminder ? undefined : personalChats.get(assigneeId);
    const sendToLine = !test && !reminder && LINE_CHANNEL_ACCESS_TOKEN && LINE_RECIPIENT_ID;
    if (!account && TELEGRAM_BOT_TOKEN && telegramChatId) {
      account = { token: TELEGRAM_BOT_TOKEN, chatId: telegramChatId };
    }
    if (!account && !sendToLine) {
      return reply(204);
    }
    const rawEvents = test ? ['created'] : payload?.events;
    if (!Array.isArray(rawEvents) || !rawEvents.length ||
        rawEvents.some((event) => typeof event !== 'string' || !Object.hasOwn(taskNotificationMessages, event))) {
      return reply(400);
    }

    const events = [...new Set<TaskNotificationEvent>(rawEvents)];
    const task = test ? { title: 'สรุปรายงานประจำเดือน', assignee: 'เมย์ (ตัวอย่าง)', dueDate: '25 พ.ย. 2569' } : payload?.task;
    const field = (key: 'title' | 'assignee' | 'dueDate', fallback: string) => {
      const value = task && typeof task === 'object' ? (task as Record<string, unknown>)[key] : undefined;
      return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 180) || fallback : fallback;
    };
    const message = [
      test ? 'TaskFlow Pro · ข้อความทดสอบ' : 'TaskFlow Pro',
      '',
      ...events.map((event) => `📌 ${taskNotificationMessages[event]}`),
      '',
      `งาน: ${field('title', 'ไม่ระบุ')}`,
      `ผู้รับผิดชอบ: ${field('assignee', 'ยังไม่ได้มอบหมาย')}`,
      `กำหนดส่ง: ${field('dueDate', 'ไม่ระบุ')}`,
    ].join('\n');
    const send = async (url: string, body: object, token?: string) => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(8000),
        });
        return response.ok ? 'accepted' : 'failed';
      } catch {
        return 'failed';
      }
    };

    const [telegram, line] = await Promise.all([
      account
        ? sendTelegram(account, message).catch(() => 'failed')
        : 'disabled',
      sendToLine
        ? send('https://api.line.me/v2/bot/message/push', {
          to: LINE_RECIPIENT_ID,
          messages: [{ type: 'text', text: message }],
        }, LINE_CHANNEL_ACCESS_TOKEN)
        : 'disabled',
    ]);
    return reply(200, { telegram, line });
  };

  return {
    name: 'local-task-notifications',
    config: () => ({ server: { fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.taskflow-notifications/**'] } } }),
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}
