import { ENABLE_DEMO_AUTH, STORAGE_KEYS } from '../config/appConfig';
import type { User } from '../types/models';
import { defaultRepository, type WorkspaceRepository } from './workspaceRepository';

export interface AuthService {
  getSession(): Promise<User | null>;
  login(email: string, password: string): Promise<User>;
  loginAsDemoUser?(userId: string): Promise<User>;
  logout(): Promise<void>;
}

interface StoredSession {
  userId: string;
}

function readStoredSession(): StoredSession | null {
  const raw = localStorage.getItem(STORAGE_KEYS.session);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'userId' in parsed &&
      typeof (parsed as { userId: unknown }).userId === 'string'
    ) {
      return { userId: (parsed as { userId: string }).userId };
    }
    return null;
  } catch {
    return null;
  }
}

export class LocalAuthService implements AuthService {
  private readonly repository: WorkspaceRepository;

  constructor(repository: WorkspaceRepository = defaultRepository) {
    this.repository = repository;
  }

  async getSession(): Promise<User | null> {
    const session = readStoredSession();
    if (!session) return null;
    const { users } = await this.repository.loadAll();
    const user = users.find((u) => u.id === session.userId) ?? null;
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.session);
    }
    return user;
  }

  async login(email: string, password: string): Promise<User> {
    const { users } = await this.repository.loadAll();
    const normalizedEmail = email.trim().toLowerCase();
    const match = users.find(
      (u) => u.email.toLowerCase() === normalizedEmail && (u.password ?? '1234') === password,
    );
    if (!match) {
      throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
    }
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ userId: match.id }));
    return match;
  }

  async loginAsDemoUser(userId: string): Promise<User> {
    if (!ENABLE_DEMO_AUTH) {
      throw new Error('โหมดทดลองเข้าใช้งานถูกปิดอยู่');
    }
    const { users } = await this.repository.loadAll();
    const match = users.find((u) => u.id === userId);
    if (!match) {
      throw new Error('ไม่พบบัญชีตัวอย่างที่เลือก');
    }
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ userId: match.id }));
    return match;
  }

  async logout(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.session);
  }
}

export const defaultAuthService = new LocalAuthService(defaultRepository);
