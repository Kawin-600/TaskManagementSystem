import { describe, it, expect, beforeEach } from 'vitest';
import { STORAGE_KEYS } from '../../config/appConfig';
import { LocalStorageRepository } from '../workspaceRepository';
import { LocalAuthService } from '../authService';

describe('LocalAuthService', () => {
  let repo: LocalStorageRepository;
  let auth: LocalAuthService;

  beforeEach(() => {
    localStorage.clear();
    repo = new LocalStorageRepository();
    auth = new LocalAuthService(repo);
  });

  it('logs in with case-insensitive email and password, persists session, and restores via getSession()', async () => {
    const user = await auth.login('ADMIN@taskflow.local', '1234');
    expect(user.id).toBe('u1');
    expect(user.role).toBe('admin');

    const restored = await auth.getSession();
    expect(restored?.id).toBe('u1');
  });

  it('throws a Thai error message when credentials are invalid', async () => {
    await expect(auth.login('admin@taskflow.local', 'wrong')).rejects.toThrow(/อีเมลหรือรหัสผ่านไม่ถูกต้อง/);
    await expect(auth.login('missing@taskflow.local', '1234')).rejects.toThrow(/อีเมลหรือรหัสผ่านไม่ถูกต้อง/);
  });

  it('supports demo quick-login and clears session on logout()', async () => {
    const staff = await auth.loginAsDemoUser('u3');
    expect(staff.id).toBe('u3');
    expect((await auth.getSession())?.id).toBe('u3');

    await auth.logout();
    expect(await auth.getSession()).toBeNull();
  });

  it('returns null without throwing when session JSON in localStorage is corrupted (Review Focus #1)', async () => {
    localStorage.setItem(STORAGE_KEYS.session, '{not-valid-json');
    expect(await auth.getSession()).toBeNull();
  });
});
