# TaskFlow Pro Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build TaskFlow Pro, a modular Thai-language internal task and project management web application for a small organization with Focused Dual-Rail navigation, Center Modals, Member-Scoped 3-role RBAC, and a swappable `AuthService` / `WorkspaceRepository` layer ready for future real authentication and backend integration.

**Architecture:** React + TypeScript + Vite + Tailwind CSS SPA separated into four clean layers: pure domain logic (`src/domain/`: RBAC, Thai BE dates, calendar/Gantt layout math, safe comment linkification), async service interfaces (`src/services/`: `AuthService` and `WorkspaceRepository` backed by `localStorage` in v1), React Context state orchestration (`src/state/`), and Focused Dual-Rail UI components/pages (`src/components/`, `src/pages/`). UI components never read/write `localStorage` directly and share stateless `CalendarBoard` and `TimelineGantt` views across both Project Workspace and Global Schedule with isolated view state.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Tailwind CSS 3, `react-router-dom` 6, `lucide-react`, Vitest, `@testing-library/react`, `@testing-library/user-event`, `jsdom`.

**Spec:** `docs/superpowers/specs/2026-11-20-taskflow-pro-website-design.md`

## Global Constraints

- Thai-language UI (`lang="th"`), Google Fonts `Prompt` (headings/UI) and `Sarabun` (body/tables) with system Thai sans fallback, Buddhist Era date formatting (e.g., `20 พ.ย. 69`, `พฤศจิกายน 2569`), Thai weekday headers (`อาทิตย์`–`เสาร์`).
- Runs locally on Node.js v20+ and npm v10+ (`npm run dev`, `npm test`, `npm run build`).
- Never modify or delete `promt/design.html`; keep `.superpowers/`, `node_modules/`, and `dist/` in `.gitignore`.
- No direct `localStorage` access inside React components or pages — all persistence goes through `AuthService` and `WorkspaceRepository`.
- Visual palette: Dark Slate-900 (`#0f172a`) Icon Rail, Slate-50 (`#f8fafc`) page canvas, White (`#ffffff`) cards with Slate-200 borders, Indigo-600 (`#4f46e5`) primary accent, Emerald (`#10b981`) completed, Amber (`#f59e0b`) review, Rose (`#f43f5e`) overdue.
- Desktop-first layout with responsive slide-over drawer navigation on viewports `< 768px`.

## Review Focus

1. **Corrupted or partial `localStorage` data on boot:** Malformed JSON or legacy prototype keys in `localStorage` must fall back cleanly to valid seed state / logged-out session without throwing runtime errors (pinned in Task 2).
2. **Direct URL navigation to unauthorized routes or hidden projects:** A Staff or Supervisor manually opening `/admin/users`, `/admin/rbac`, or `/projects/<non-member-id>` must be blocked/redirected with zero leak of hidden project or admin data (pinned in Task 4).
3. **Cross-month tasks & horizontal multi-day lane packing on Calendar/Gantt:** Tasks starting before month start or ending after month end must clamp cleanly to visible bounds while still displaying full duration (`N วัน`), and non-overlapping tasks within the same week must share the same horizontal lane row (pinned in Task 6).
4. **Member removal, supervisor demotion, and user deletion cascades:** Every cascade must keep `supervisorId ∈ memberIds` without duplicates, leave zero orphaned `assigneeId`/`supervisorId` references, and disable self-demotion and self-deletion for the active Admin (pinned in Tasks 2 & 8).
5. **Unsafe comment URLs and invalid modal form inputs:** Comment linkification must only linkify safe `http://` and `https://` URLs (ignoring `javascript:` / raw HTML), and submitting `dueDate < startDate` or blank titles must block submission with Thai feedback without clearing form inputs (pinned in Task 5).

---

## File Structure

```text
.gitignore
index.html
package.json
postcss.config.js
tailwind.config.js
tsconfig.json
tsconfig.app.json
vite.config.ts
src/
  main.tsx
  index.css
  App.tsx
  config/appConfig.ts
  types/models.ts
  domain/
    dates.ts
    rbac.ts
    linkify.ts
    scheduleLayout.ts
  services/
    seedData.ts
    authService.ts
    workspaceRepository.ts
  state/
    ToastContext.tsx
    AuthContext.tsx
    WorkspaceContext.tsx
  components/
    ui/
      Modal.tsx
      Badges.tsx
    auth/
      DemoQuickLogin.tsx
    layout/
      IconRail.tsx
      ContextualSubPanel.tsx
      Topbar.tsx
      AppShell.tsx
    modals/
      CreateTaskModal.tsx
      TaskDetailModal.tsx
      ProjectFormModal.tsx
      ProjectMembersModal.tsx
      CreateUserModal.tsx
    schedule/
      CalendarBoard.tsx
      TimelineGantt.tsx
    workspace/
      KanbanBoard.tsx
      TaskListTable.tsx
  pages/
    LoginPage.tsx
    DashboardPage.tsx
    MyTasksPage.tsx
    ProjectsOverviewPage.tsx
    ProjectWorkspacePage.tsx
    GlobalSchedulePage.tsx
    TeamWorkloadPage.tsx
    AdminUsersPage.tsx
    AdminRbacPage.tsx
```

---

### Task 1: Project Scaffold, Domain Types, Date Utilities, Linkifier & Member-Scoped RBAC Engine

**Files:**
- Create: `.gitignore`, `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tailwind.config.js`, `postcss.config.js`, `src/index.css`, `src/main.tsx`, `src/test/setup.ts`
- Create: `src/config/appConfig.ts`, `src/types/models.ts`, `src/domain/dates.ts`, `src/domain/linkify.ts`, `src/domain/rbac.ts`
- Test: `src/domain/__tests__/dates.test.ts`, `src/domain/__tests__/linkify.test.ts`, `src/domain/__tests__/rbac.test.ts`

**Interfaces:**
- Consumes: none (foundation task)
- Produces:
  - `src/config/appConfig.ts`: `ENABLE_DEMO_AUTH: boolean`, `PROJECT_COLORS: readonly string[]`, `STORAGE_KEYS: { users: string; projects: string; tasks: string; session: string }`
  - `src/types/models.ts`: `UserRole`, `TaskStatus`, `TaskPriority`, `User`, `Project`, `TaskComment`, `Task`, `CreateTaskInput`, `UpdateTaskInput`, `CreateProjectInput`, `UpdateProjectInput`, `CreateUserInput`
  - `src/domain/dates.ts`: `getTodayStr(now?: Date): string`, `addDays(dateStr: string, delta: number): string`, `calculateDaysBetween(startDateStr: string, dueDateStr: string): number`, `isTaskOverdue(task: Pick<Task, 'dueDate' | 'status'>, todayStr?: string): boolean`, `formatThaiDateShort(dateStr: string): string`, `formatThaiDateFull(dateStr: string): string`, `getThaiMonthYearString(yearMonthStr: string): string`, `getMonthYearStr(dateStr: string): string`, `shiftMonth(yearMonthStr: string, delta: number): string`
  - `src/domain/linkify.ts`: `CommentSegment` (`{ type: 'text'; value: string } | { type: 'link'; value: string; href: string }`), `tokenizeCommentText(text: string): CommentSegment[]`
  - `src/domain/rbac.ts`: `getVisibleProjects(user: User, projects: Project[]): Project[]`, `canViewProject(user: User, project: Project): boolean`, `canCreateProject(user: User): boolean`, `canManageProject(user: User, project: Project): boolean`, `getVisibleTasks(user: User, projects: Project[], tasks: Task[]): Task[]`, `canCreateTaskInProject(user: User, project: Project): boolean`, `getAssignableMembers(user: User, project: Project, allUsers: User[]): User[]`, `canEditTask(user: User, task: Task, project?: Project): boolean`, `validateTaskStatusTransition(user: User, task: Task, newStatus: TaskStatus, project?: Project): { allowed: boolean; reason?: string }`, `canApproveOrRejectTask(user: User, task: Task, project?: Project): boolean`, `canDeleteTask(user: User, task: Task, project?: Project): boolean`, `canCommentOnTask(user: User, task: Task, project?: Project): boolean`, `getVisibleTeamUsers(user: User, projects: Project[], allUsers: User[]): User[]`, `canAccessAdmin(user: User): boolean`, `canModifyUserRole(actingUser: User, targetUserId: string): boolean`, `canDeleteUser(actingUser: User, targetUserId: string): boolean`

- [ ] **Step 1: Initialize Git repository and Vite + React + TypeScript + Tailwind + Vitest scaffold**

Create `.gitignore` (ignoring `node_modules/`, `dist/`, `.superpowers/`, `*.local`), `package.json`, `index.html` (with `lang="th"`, Prompt + Sarabun Google Fonts, title `TaskFlow Pro - ระบบจัดการงานองค์กร`), `vite.config.ts` (configuring Vitest with `environment: 'jsdom'`, `setupFiles: './src/test/setup.ts'`, `globals: true`), `tsconfig.json`, `tsconfig.app.json`, `tailwind.config.js` (fontFamily `sans: ['Prompt', 'Sarabun', 'sans-serif']`), `postcss.config.js`, `src/index.css`, `src/test/setup.ts` (`import '@testing-library/jest-dom/vitest'`), `src/config/appConfig.ts`, and `src/types/models.ts`. Run `git init` (if not already a git repo) and `npm install`.

Run: `npm install && npx tsc --noEmit`
Expected: dependencies install cleanly and `tsc` exits 0 (with minimal placeholder `src/main.tsx`).

- [ ] **Step 2: Write failing tests for dates, linkify, and Member-Scoped RBAC**

Create `src/domain/__tests__/dates.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  addDays, calculateDaysBetween, isTaskOverdue,
  formatThaiDateShort, formatThaiDateFull, getThaiMonthYearString, shiftMonth,
} from '../dates';

describe('dates domain', () => {
  it('calculates inclusive days between dates', () => {
    expect(calculateDaysBetween('2026-11-20', '2026-11-20')).toBe(1);
    expect(calculateDaysBetween('2026-11-20', '2026-11-24')).toBe(5);
  });

  it('adds days and shifts months across year boundaries', () => {
    expect(addDays('2026-11-29', 3)).toBe('2026-12-02');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('formats Thai Buddhist Era short, full, and month-year strings', () => {
    expect(formatThaiDateShort('2026-11-20')).toBe('20 พ.ย. 69');
    expect(formatThaiDateFull('2026-11-20')).toBe('20 พฤศจิกายน 2569');
    expect(getThaiMonthYearString('2026-11')).toBe('พฤศจิกายน 2569');
  });

  it('marks non-completed tasks with dueDate < today as overdue', () => {
    expect(isTaskOverdue({ dueDate: '2026-11-19', status: 'in_progress' }, '2026-11-20')).toBe(true);
    expect(isTaskOverdue({ dueDate: '2026-11-19', status: 'completed' }, '2026-11-20')).toBe(false);
    expect(isTaskOverdue({ dueDate: '2026-11-20', status: 'todo' }, '2026-11-20')).toBe(false);
  });
});
```

Create `src/domain/__tests__/linkify.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { tokenizeCommentText } from '../linkify';

describe('tokenizeCommentText', () => {
  it('splits safe http and https URLs into link segments while keeping text', () => {
    const res = tokenizeCommentText('ส่งไฟล์แล้ว https://drive.google.com/file/1 และ http://example.com/a ครับ');
    expect(res).toEqual([
      { type: 'text', value: 'ส่งไฟล์แล้ว ' },
      { type: 'link', value: 'https://drive.google.com/file/1', href: 'https://drive.google.com/file/1' },
      { type: 'text', value: ' และ ' },
      { type: 'link', value: 'http://example.com/a', href: 'http://example.com/a' },
      { type: 'text', value: ' ครับ' },
    ]);
  });

  it('keeps javascript: URIs and HTML tags as plain text (Review Focus #5)', () => {
    const raw = 'ลอง javascript:alert(1) หรือ <script>alert(1)</script>';
    expect(tokenizeCommentText(raw)).toEqual([{ type: 'text', value: raw }]);
  });
});
```

Create `src/domain/__tests__/rbac.test.ts` testing:
- `getVisibleProjects` / `getVisibleTasks` / `getVisibleTeamUsers`: Admin sees all; Supervisor sees only projects where `supervisorId === me` or `me ∈ memberIds`; Staff sees only projects where `me ∈ memberIds` and never receives tasks/teammates from hidden projects.
- `canManageProject`: Admin on any project; Supervisor ONLY where `project.supervisorId === me` (not merely a member of someone else's project); Staff always `false`.
- `canCreateTaskInProject` & `getAssignableMembers`: Admin & Supervisor can assign any member of a visible project; Staff can create inside member projects with assignable members restricted strictly to `[staffUser]`.
- `canEditTask` & `validateTaskStatusTransition`:
  - Staff can edit and move own non-completed tasks across `todo` / `in_progress` / `review`.
  - Staff is blocked from moving any task to `completed` (returns Thai reason mentioning `รอตรวจสอบ`).
  - Staff is **locked** from editing or reopening/moving their own task once `task.status === 'completed'` (returns `{ allowed: false }`).
  - Staff cannot edit or move another colleague's task.
  - Supervisor & Admin can edit, approve (`review → completed`), reject (`review → in_progress`), reopen (`completed → in_progress`), and delete tasks in visible projects (and Supervisor cannot act on hidden projects).
- `canCommentOnTask`: Staff can comment on any task in member projects including `completed` tasks, but NOT on tasks in hidden projects.
- `canAccessAdmin`, `canModifyUserRole`, `canDeleteUser`: Admin only; `canModifyUserRole(admin, admin.id)` and `canDeleteUser(admin, admin.id)` both return `false`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/domain/__tests__`
Expected: FAIL with missing modules `../dates`, `../linkify`, `../rbac`.

- [ ] **Step 4: Implement `dates.ts`, `linkify.ts`, and `rbac.ts`**

- Implement `src/domain/dates.ts` using pure UTC-safe `YYYY-MM-DD` string parsing (split `y-m-d` into `new Date(y, m - 1, d)` so local timezone offsets never shift dates by 1 day).
- Implement `src/domain/linkify.ts` matching `https?://[^\s<>"]+` with trailing punctuation cleanup, returning only safe `text` and `link` tokens.
- Implement `src/domain/rbac.ts` enforcing every rule from Spec Section 5.4 verbatim.

- [ ] **Step 5: Run tests and typecheck to verify pass**

Run: `npx vitest run src/domain/__tests__ && npx tsc --noEmit`
Expected: PASS (all domain tests pass, 0 TypeScript errors).

- [ ] **Step 6: Commit**

```bash
git add .gitignore package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.app.json tailwind.config.js postcss.config.js src/
git commit -m "feat: scaffold Vite React TS app with domain dates, linkify, and RBAC engine"
```

---

### Task 2: Dynamic Seed Data, `AuthService` & `WorkspaceRepository` (with Atomic Cascades)

**Files:**
- Create: `src/services/seedData.ts`, `src/services/authService.ts`, `src/services/workspaceRepository.ts`
- Test: `src/services/__tests__/authService.test.ts`, `src/services/__tests__/workspaceRepository.test.ts`

**Interfaces:**
- Consumes: `src/types/models.ts`, `src/config/appConfig.ts`, `src/domain/dates.ts`
- Produces:
  - `src/services/seedData.ts`: `createSeedData(todayStr?: string): { users: User[]; projects: Project[]; tasks: Task[] }`
  - `src/services/authService.ts`:
    - `export interface AuthService { getSession(): Promise<User | null>; login(email: string, password: string): Promise<User>; loginAsDemoUser?(userId: string): Promise<User>; logout(): Promise<void>; }`
    - `export class LocalAuthService implements AuthService`
  - `src/services/workspaceRepository.ts`:
    - `export interface WorkspaceSnapshot { users: User[]; projects: Project[]; tasks: Task[]; }`
    - `export interface WorkspaceRepository { loadAll(): Promise<WorkspaceSnapshot>; createProject(input: CreateProjectInput): Promise<Project>; updateProject(projectId: string, input: UpdateProjectInput): Promise<Project>; updateProjectMembers(projectId: string, memberIds: string[]): Promise<{ project: Project; reassignedTaskCount: number }>; deleteProject(projectId: string): Promise<void>; createTask(input: CreateTaskInput): Promise<Task>; updateTask(taskId: string, input: UpdateTaskInput): Promise<Task>; deleteTask(taskId: string): Promise<void>; addComment(taskId: string, userId: string, text: string): Promise<Task>; createUser(input: CreateUserInput): Promise<User>; updateUserRole(userId: string, newRole: UserRole, actingAdminId: string): Promise<{ user: User; transferredProjectIds: string[] }>; deleteUser(userId: string, actingAdminId: string): Promise<{ transferredProjectIds: string[]; reassignedTaskCount: number }>; resetSampleData?(): Promise<WorkspaceSnapshot>; }`
    - `export class LocalStorageRepository implements WorkspaceRepository`

- [ ] **Step 1: Write failing tests for `authService` and `workspaceRepository`**

Create `src/services/__tests__/authService.test.ts`:
- `login(email, password)` matches case-insensitive email and password, persists session, and `getSession()` restores the current user from repository users.
- `login` throws Thai error message on wrong email/password.
- `loginAsDemoUser(userId)` signs in without password when `ENABLE_DEMO_AUTH` is enabled; `logout()` clears session.
- **Review Focus #1:** Corrupt JSON in `STORAGE_KEYS.session` returns `null` from `getSession()` without throwing.

Create `src/services/__tests__/workspaceRepository.test.ts`:
- `loadAll()` seeds 4 Thai users (`นพดล ใจดี` admin, `วิภาวดี รักงาน` supervisor, `กิตติพงษ์ ขยันยิ่ง` staff, `สมชาย สายลุย` staff), 3 projects with distinct `memberIds` (Project 3 excludes Supervisor `u2`; Project 1 & 2 give distinct member sets so Member-Scoped visibility is immediately visible), and 12 tasks whose dates anchor dynamically around `todayStr` (producing active overdue, review, in-progress, and upcoming tasks).
- **Review Focus #1:** Malformed JSON or non-array data in `localStorage` under `STORAGE_KEYS.users`/`projects`/`tasks` falls back cleanly to fresh seed data without throwing.
- `createProject` always ensures `supervisorId` is included inside `memberIds` (no duplicates).
- **Review Focus #4 (Member removal cascade):** `updateProjectMembers` rejects removing `supervisorId` (keeps supervisor in `memberIds`), and when removing a member who owns tasks in that project, reassigns those tasks to `project.supervisorId` and reports `reassignedTaskCount`.
- **Review Focus #4 (Supervisor demotion cascade):** `updateUserRole(u2, 'staff', u1)` atomically transfers `supervisorId` of all projects supervised by `u2` to `u1`, adds `u1` to those projects' `memberIds` (deduplicated), and keeps `u2` in `memberIds`. Rejects `userId === actingAdminId`.
- **Review Focus #4 (User deletion cascade):** `deleteUser(u2, u1)` removes `u2` from all `memberIds`, transfers supervised projects to `u1`, reassigns `u2`'s tasks to each project's new supervisor, and rejects `userId === actingAdminId`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/__tests__`
Expected: FAIL with missing modules `../authService` and `../workspaceRepository`.

- [ ] **Step 3: Implement `seedData.ts`, `authService.ts`, and `workspaceRepository.ts`**

- Implement `createSeedData(todayStr = getTodayStr())` computing task `startDate`/`dueDate` offsets relative to `todayStr` (e.g., `-14d..-10d` completed, `-8d..-2d` overdue in-progress, `-4d..+2d` review, `-3d..+5d` in-progress, `+2d..+8d` todo) and setting default demo password (`1234`) + realistic Thai emails (`admin@taskflow.local`, `supervisor@taskflow.local`, `kittipong@taskflow.local`, `somchai@taskflow.local`).
- Implement `LocalStorageRepository` with defensive `safeParseArray` helper and atomic multi-entity updates for project member removal, supervisor demotion, and user deletion.
- Implement `LocalAuthService` reading user list from `WorkspaceRepository` and persisting only `{ userId }` in `STORAGE_KEYS.session` (so role updates reflect live on reload).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/__tests__ && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/
git commit -m "feat: add dynamic seed data, AuthService, and WorkspaceRepository with atomic cascades"
```

---

### Task 3: App Contexts (`ToastContext`, `AuthContext`, `WorkspaceContext`) & UI Primitives (`Modal`, `Badges`)

**Files:**
- Create: `src/state/ToastContext.tsx`, `src/state/AuthContext.tsx`, `src/state/WorkspaceContext.tsx`
- Create: `src/components/ui/Modal.tsx`, `src/components/ui/Badges.tsx`
- Test: `src/state/__tests__/WorkspaceContext.test.tsx`, `src/components/ui/__tests__/Modal.test.tsx`

**Interfaces:**
- Consumes: `src/types/models.ts`, `src/domain/rbac.ts`, `src/services/authService.ts`, `src/services/workspaceRepository.ts`
- Produces:
  - `src/state/ToastContext.tsx`: `ToastType` (`'success' | 'error' | 'warning' | 'info'`), `ToastProvider`, `useToast(): { showToast(message: string, type?: ToastType): void }`
  - `src/state/AuthContext.tsx`: `AuthProvider({ authService, children })`, `useAuth(): { currentUser: User | null; isLoading: boolean; login(email: string, password: string): Promise<void>; loginAsDemoUser(userId: string): Promise<void>; logout(): Promise<void>; refreshSession(): Promise<void> }`
  - `src/state/WorkspaceContext.tsx`: `WorkspaceProvider({ repository, children })`, `useWorkspace(): { users: User[]; projects: Project[]; tasks: Task[]; visibleProjects: Project[]; visibleTasks: Task[]; visibleTeamUsers: User[]; isLoading: boolean; createProject; updateProject; updateProjectMembers; deleteProject; createTask; updateTask; moveTaskStatus; approveTask; rejectTask; deleteTask; addComment; createUser; updateUserRole; deleteUser; resetSampleData }`
  - `src/components/ui/Modal.tsx`: `Modal({ isOpen, onClose, title, subtitle?, headerAccent?, size?: 'md' | 'lg', children })`
  - `src/components/ui/Badges.tsx`: `StatusBadge({ status })`, `PriorityBadge({ priority })`, `RoleBadge({ role })`, `AvatarCircle({ avatar, color, size? })`, `getThaiStatusName(status)`, `getThaiRoleName(role)`

- [ ] **Step 1: Write failing tests for `Modal` and `WorkspaceContext`**

Create `src/components/ui/__tests__/Modal.test.tsx`:
- Renders `role="dialog"` with `title` when `isOpen=true` and renders nothing when `isOpen=false`.
- Calls `onClose` when pressing `Escape`, clicking the close (`✕`) button, or clicking the backdrop (does NOT close when clicking inside the modal panel).

Create `src/state/__tests__/WorkspaceContext.test.tsx`:
- Exposes `visibleProjects` and `visibleTasks` strictly scoped to the logged-in user via `rbac.ts`.
- `moveTaskStatus`: when logged in as Staff moving own task to `'completed'`, blocks repository call, leaves status unchanged, and shows a warning toast containing `รอตรวจสอบ`.
- `moveTaskStatus`: when logged in as Staff trying to reopen a `'completed'` task, blocks repository call and shows an error/warning toast.
- `approveTask` / `rejectTask`: transitions `review → completed` and `review → in_progress` for Supervisor/Admin and rejects Staff attempts.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ui/__tests__/Modal.test.tsx src/state/__tests__/WorkspaceContext.test.tsx`
Expected: FAIL with missing modules.

- [ ] **Step 3: Implement `ToastContext`, `AuthContext`, `WorkspaceContext`, `Modal`, and `Badges`**

- `ToastContext`: manages toast queue with 3.5s auto-dismiss and renders fixed top-right toast container.
- `AuthContext`: accepts `authService` prop (defaulting to singleton `LocalAuthService`), calls `getSession()` on mount.
- `WorkspaceContext`: loads snapshot from `repository`, computes memoized `visibleProjects`, `visibleTasks`, `visibleTeamUsers` using `currentUser` from `useAuth()`, and guards every mutation with `rbac.ts` before invoking `repository` + emitting Thai toast feedback.
- `Modal`: Center Modal with dimmed slate backdrop, `Escape` key listener, scrollable body (`max-h-[90vh]`), and smooth entrance.
- `Badges`: Thai labels matching Spec Section 5.3 colors (`รอดำเนินการ`, `กำลังทำ`, `รอตรวจสอบ`, `เสร็จสิ้น`; `ต่ำ`, `ปานกลาง`, `สูง`, `ด่วนที่สุด`; `Admin`, `หัวหน้างาน`, `เจ้าหน้าที่`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/ui/__tests__/Modal.test.tsx src/state/__tests__/WorkspaceContext.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/ src/components/ui/
git commit -m "feat: add Toast/Auth/Workspace contexts and Center Modal + Badge primitives"
```

---

### Task 4: Login Page, Focused Dual-Rail App Shell & Route Access Guards

**Files:**
- Create: `src/components/auth/DemoQuickLogin.tsx`, `src/pages/LoginPage.tsx`
- Create: `src/components/layout/IconRail.tsx`, `src/components/layout/ContextualSubPanel.tsx`, `src/components/layout/Topbar.tsx`, `src/components/layout/AppShell.tsx`
- Create: `src/App.tsx` (with `ProtectedRoute`, `AdminRoute`, `ProjectAccessGuard` and placeholder page slots wired up for Tasks 7–8)
- Test: `src/components/layout/__tests__/LoginAndShell.test.tsx`

**Interfaces:**
- Consumes: `AuthContext`, `WorkspaceContext`, `ToastContext`, `Badges`, `rbac.ts`, `dates.ts`, `appConfig.ts`
- Produces:
  - `src/pages/LoginPage.tsx`: `LoginPage`
  - `src/components/layout/AppShell.tsx`: `AppShell({ onOpenCreateTask, onOpenTaskDetail, onOpenCreateProject }: { onOpenCreateTask: (opts?: { projectId?: string; startDate?: string }) => void; onOpenTaskDetail: (taskId: string) => void; onOpenCreateProject: () => void })` (renders `<Outlet />`)
  - `src/App.tsx`: `AppRoutes` (testable router tree accepting `MemoryRouter` in tests) + default `App`

- [ ] **Step 1: Write failing tests for Login, Dual-Rail Shell, Topbar Search/Attention Pill & Route Guards**

Create `src/components/layout/__tests__/LoginAndShell.test.tsx`:
- Unauthenticated visit to `/` redirects to `/login` showing email/password form and `DemoQuickLogin` 3-role buttons (Admin, หัวหน้างาน, เจ้าหน้าที่).
- Submitting valid credentials or clicking a Demo Quick-Login button signs in and renders the Focused Dual-Rail shell; clicking avatar → `ออกจากระบบ` returns to `/login`.
- **Dual-Rail Sub-Panel behavior:** On `/`, Contextual Sub-Panel is hidden; on `/projects` and `/projects/:id`, Contextual Sub-Panel shows `โปรเจคของฉัน` and clicking `ซ่อนแผง` collapses it while revealing an expand button in Topbar.
- **Review Focus #2 (Route Access Guards):**
  - When logged in as Staff (`u3`): Admin icon is NOT rendered in Icon Rail; directly navigating to `/admin/users` or `/admin/rbac` displays unauthorized/redirect view with zero user-management controls rendered.
  - When logged in as Supervisor (`u2`, not a member of Project 3): Project 3 does NOT appear in Sub-Panel or Topbar Quick Search, and directly navigating to `/projects/p3` renders access-denied / redirects to `/projects` with zero Project 3 tasks rendered.
- **Topbar Attention Indicator Pill:**
  - For Admin/Supervisor: shows `รอตรวจ N` pill; clicking opens Review Queue popover listing pending `review` tasks across visible projects and clicking an item invokes `onOpenTaskDetail(taskId)`.
  - For Staff: shows `เลยกำหนด N` pill (when > 0) and clicking navigates to `/my-tasks?filter=overdue`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/__tests__/LoginAndShell.test.tsx`
Expected: FAIL with missing modules.

- [ ] **Step 3: Implement `DemoQuickLogin`, `LoginPage`, `IconRail`, `ContextualSubPanel`, `Topbar`, `AppShell`, and `App.tsx`**

- `DemoQuickLogin`: returns `null` when `!ENABLE_DEMO_AUTH`; otherwise renders isolated 3-role quick-login buttons (picking first sample user of each role).
- `IconRail`: 64px dark `#0f172a` rail, TaskFlow emblem, 5 core icons (`แดชบอร์ด`, `งานของฉัน` with pending/overdue badge, `โปรเจค`, `ปฏิทิน & ไทม์ไลน์รวม`, `ทีมงาน & ภาระงาน`) + conditional 6th `จัดการระบบ` icon for Admin only, bottom avatar opening Account Popover (Name, RoleBadge, Email, `ออกจากระบบ`).
- `ContextualSubPanel`: 224px collapsible panel rendering visible `โปรเจคของฉัน` (with review count dots + `+` button for Admin/Supervisor + `ซ่อนแผง`) on `/projects*`, and Admin sub-links (`จัดการผู้ใช้งาน`, `ตารางสิทธิ์ (RBAC Matrix)`) on `/admin*`.
- `Topbar`: 56px white bar with mobile drawer trigger (`< 768px`), sub-panel re-open button when collapsed, dynamic route title/subtitle, Quick Search input + live dropdown across `visibleProjects` and `visibleTasks`, Attention Indicator Pill (`รอตรวจ N` popover for Admin/Supervisor; `เลยกำหนด N` link to `/my-tasks?filter=overdue` for Staff), dynamic `วันนี้: <Thai full date>` badge, and `+ สร้างงาน` button (disabled when `visibleProjects.length === 0`).
- `App.tsx`: `ProtectedRoute`, `AdminRoute` (checks `canAccessAdmin`), and `ProjectAccessGuard` (checks `visibleProjects.some(p => p.id === projectId)`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/layout/__tests__/LoginAndShell.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/ src/components/layout/ src/pages/LoginPage.tsx src/App.tsx
git commit -m "feat: implement LoginPage, Focused Dual-Rail AppShell, Topbar search/review popover, and route guards"
```

---

### Task 5: Center Modals Suite (Tasks, Projects, Project Members, Users)

**Files:**
- Create: `src/components/modals/CreateTaskModal.tsx`, `src/components/modals/TaskDetailModal.tsx`, `src/components/modals/ProjectFormModal.tsx`, `src/components/modals/ProjectMembersModal.tsx`, `src/components/modals/CreateUserModal.tsx`
- Test: `src/components/modals/__tests__/Modals.test.tsx`

**Interfaces:**
- Consumes: `Modal`, `Badges`, `WorkspaceContext`, `AuthContext`, `rbac.ts`, `dates.ts`, `linkify.ts`, `appConfig.ts`
- Produces:
  - `CreateTaskModal({ isOpen, onClose, defaultProjectId?, defaultStartDate? })`
  - `TaskDetailModal({ taskId: string | null, onClose })`
  - `ProjectFormModal({ isOpen, onClose, project?: Project | null })`
  - `ProjectMembersModal({ projectId: string | null, onClose })`
  - `CreateUserModal({ isOpen, onClose })`

- [ ] **Step 1: Write failing tests for all 5 Center Modals**

Create `src/components/modals/__tests__/Modals.test.tsx`:
- **CreateTaskModal & Review Focus #5:**
  - Live duration badge updates from `5 วัน` when changing `startDate`/`dueDate`.
  - Submitting `dueDate < startDate` or whitespace-only title blocks save, displays Thai validation message (`วันกำหนดส่งต้องไม่น้อยกว่าวันเริ่มต้น`), and preserves entered inputs.
  - When logged in as Staff: assignee dropdown is locked to Staff user only; changing project filters assignee options to that project's members for Admin/Supervisor.
- **TaskDetailModal & Review Focus #5:**
  - For Admin/Supervisor viewing a `review` task: shows `อนุมัติงาน` and `ส่งกลับแก้ไข` buttons; clicking `อนุมัติงาน` moves task to `completed` and closes modal.
  - For Staff viewing own `completed` task: title, description, priority, dates, and status inputs are all `disabled`, notice states that only หัวหน้างาน/Admin can reopen, and comment input remains enabled.
  - Posting a comment containing `https://figma.com/file/abc` renders an `<a href="https://figma.com/file/abc" target="_blank" rel="noopener noreferrer">`, whereas `javascript:alert(1)` renders strictly as plain text with zero `<a>` tag.
- **ProjectFormModal & ProjectMembersModal:**
  - Supervisor checkbox is checked and disabled (cannot uncheck supervisor).
  - Removing a member who owns active tasks displays a warning showing the affected task count and reassigns those tasks to `supervisorId` on confirm.
  - For Staff, `ProjectMembersModal` renders members read-only with no Save/Remove controls.
- **CreateUserModal:** creates user with name, email, role, password and closes cleanly.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/modals/__tests__/Modals.test.tsx`
Expected: FAIL with missing modal modules.

- [ ] **Step 3: Implement all 5 Center Modals**

- `CreateTaskModal`: visible projects dropdown, title, description, project-member assignee dropdown (`getAssignableMembers`), priority, start/due dates with live duration badge (`calculateDaysBetween`), client-side validation preserving form values.
- `TaskDetailModal`: checks `canEditTask`, `canApproveOrRejectTask`, `canDeleteTask`, `canCommentOnTask`; shows locked banner when `currentUser.role === 'staff' && task.status === 'completed'`; renders comments using `tokenizeCommentText` so safe URLs are clickable links; confirms before deleting task.
- `ProjectFormModal`: handles both Create and Edit modes with `PROJECT_COLORS` radio swatches, supervisor select (`admin` / `supervisor`), and member checkboxes with `supervisorId` auto-checked & locked.
- `ProjectMembersModal`: shows member list with task counts per member in that project; if `canManageProject`, lets Admin/Supervisor check/uncheck members (supervisor locked), warns when unchecked members own tasks (`งานของสมาชิกที่นำออก N งานจะถูกโอนให้หัวหน้าโปรเจคโดยอัตโนมัติ`), and saves via `updateProjectMembers`.
- `CreateUserModal`: name, email (uniqueness validation), role (`staff`/`supervisor`/`admin`), initial password (default `1234` hint).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/modals/__tests__/Modals.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/
git commit -m "feat: implement Center Modals for tasks, projects, project members, and users"
```

---

### Task 6: Shared Schedule Engine (`scheduleLayout`, `CalendarBoard`, `TimelineGantt`)

**Files:**
- Create: `src/domain/scheduleLayout.ts`, `src/components/schedule/CalendarBoard.tsx`, `src/components/schedule/TimelineGantt.tsx`
- Test: `src/domain/__tests__/scheduleLayout.test.ts`, `src/components/schedule/__tests__/ScheduleComponents.test.tsx`

**Interfaces:**
- Consumes: `src/types/models.ts`, `src/domain/dates.ts`, `Modal`, `Badges`
- Produces:
  - `src/domain/scheduleLayout.ts`:
    - `CalendarDayCell`, `CalendarBarPlacement` (`{ task: Task; startCol: number; endCol: number; spanCols: number; isStartInWeek: boolean; isEndInWeek: boolean }`), `CalendarWeekRow` (`{ days: CalendarDayCell[]; lanes: CalendarBarPlacement[][] }`)
    - `buildCalendarWeeks(yearMonth: string, todayStr: string): CalendarDayCell[][]`
    - `packWeekLanes(weekDays: CalendarDayCell[], tasks: Task[]): CalendarBarPlacement[][]`
    - `GanttDayColumn`, `GanttBarBounds` (`{ startIdx: number; endIdx: number; leftPx: number; widthPx: number; isVisible: boolean }`)
    - `buildGanttDays(yearMonth: string, todayStr: string): GanttDayColumn[]`
    - `computeGanttBarBounds(task: Pick<Task, 'startDate' | 'dueDate'>, dayColumns: GanttDayColumn[], colWidth: number): GanttBarBounds`
  - `src/components/schedule/CalendarBoard.tsx`: `CalendarBoard({ yearMonth, todayStr, tasks, projects, canAddTaskOnDate, onTaskClick, onAddTaskOnDate })`
  - `src/components/schedule/TimelineGantt.tsx`: `TimelineGantt({ yearMonth, todayStr, tasks, projects, users, zoom, colorMode, onZoomChange, onColorModeChange, onTaskClick })`

- [ ] **Step 1: Write failing tests for `scheduleLayout` and `CalendarBoard` / `TimelineGantt`**

Create `src/domain/__tests__/scheduleLayout.test.ts`:
- **Review Focus #3 (Horizontal lane packing):** Given two non-overlapping tasks within the same week (`2026-11-02..2026-11-03` and `2026-11-05..2026-11-06`), `packWeekLanes` places BOTH in `lanes[0]` (only 1 lane total, not 2!) with accurate `startCol`/`endCol` indices (`1..2` and `4..5`).
- Given two overlapping tasks in the same week, `packWeekLanes` places them in `lanes[0]` and `lanes[1]`.
- **Review Focus #3 (Cross-month clamping):** A task spanning `2026-10-28..2026-12-05` viewed in `2026-11` clamps to `startIdx = 0`, `endIdx = 29` in `computeGanttBarBounds` with `isVisible = true`, and in `packWeekLanes` sets `isStartInWeek = false`, `isEndInWeek = false` on interior weeks.
- A task completely outside the viewed month returns `isVisible = false`.

Create `src/components/schedule/__tests__/ScheduleComponents.test.tsx`:
- `CalendarBoard`: renders non-overlapping week tasks inside a single CSS grid lane row (`grid-template-columns: repeat(7, minmax(0, 1fr))`), displays full task duration (`N วัน`), renders `+ อีก N งาน` when lanes exceed 3 and opens overflow modal listing all tasks on click, and hides date `+` buttons when `canAddTaskOnDate` is `false`.
- `TimelineGantt`: renders vertical Today line when `todayStr` falls in `yearMonth`, updates column width on zoom click (`กะทัดรัด`/`ปกติ`/`กว้าง`), switches bar coloring between project color and status color, and calls `onTaskClick(task.id)` when clicking a task bar.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/__tests__/scheduleLayout.test.ts src/components/schedule/__tests__/ScheduleComponents.test.tsx`
Expected: FAIL with missing modules.

- [ ] **Step 3: Implement `scheduleLayout.ts`, `CalendarBoard.tsx`, and `TimelineGantt.tsx`**

- `scheduleLayout.ts`: greedy interval packing per week row (`lanes[l]` accepts a bar if `bar.startCol > lastBar.endCol` after sorting by `startCol` asc, `spanCols` desc).
- `CalendarBoard`: renders each lane as a 7-column CSS grid row (`grid-cols-7`) where each bar uses `gridColumn: ${startCol + 1} / span ${spanCols}` — fixing the `design.html` vertical stacking bug completely! Includes clickable overflow Center Modal for weeks with `> 3` lanes.
- `TimelineGantt`: sticky left task info column (`w-64 md:w-80`), horizontal scrollable day grid (`colWidth`: compact 36px / normal 46px / wide 60px), Today red vertical line with `วันนี้` pill, weekend shading, and overdue rose highlight ring.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domain/__tests__/scheduleLayout.test.ts src/components/schedule/__tests__/ScheduleComponents.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/scheduleLayout.ts src/domain/__tests__/scheduleLayout.test.ts src/components/schedule/
git commit -m "feat: add shared CalendarBoard with horizontal lane packing and TimelineGantt"
```

---

### Task 7: Core Workspace Pages (Dashboard, My Tasks, Projects Overview, Project Workspace + Kanban & List)

**Files:**
- Create: `src/components/workspace/KanbanBoard.tsx`, `src/components/workspace/TaskListTable.tsx`
- Create: `src/pages/DashboardPage.tsx`, `src/pages/MyTasksPage.tsx`, `src/pages/ProjectsOverviewPage.tsx`, `src/pages/ProjectWorkspacePage.tsx`
- Modify: `src/App.tsx` (connect Dashboard, My Tasks, Projects Overview, Project Workspace routes)
- Test: `src/pages/__tests__/CoreWorkspacePages.test.tsx`

**Interfaces:**
- Consumes: `WorkspaceContext`, `AuthContext`, `rbac.ts`, `dates.ts`, `Badges`, `CalendarBoard`, `TimelineGantt`
- Produces:
  - `KanbanBoard({ project, tasks, onTaskClick })`
  - `TaskListTable({ project, tasks, onTaskClick })`
  - `DashboardPage({ onOpenTaskDetail }: { onOpenTaskDetail: (taskId: string) => void })`
  - `MyTasksPage({ onOpenTaskDetail, onOpenCreateTask }: { onOpenTaskDetail: (taskId: string) => void; onOpenCreateTask: (opts?: { projectId?: string; startDate?: string }) => void })`
  - `ProjectsOverviewPage({ onOpenCreateProject, onOpenEditProject }: { onOpenCreateProject: () => void; onOpenEditProject: (project: Project) => void })`
  - `ProjectWorkspacePage({ onOpenCreateTask, onOpenTaskDetail, onOpenEditProject, onOpenMembers }: { onOpenCreateTask: (opts?: { projectId?: string; startDate?: string }) => void; onOpenTaskDetail: (taskId: string) => void; onOpenEditProject: (project: Project) => void; onOpenMembers: (projectId: string) => void })`

- [ ] **Step 1: Write failing integration tests for Core Workspace Pages**

Create `src/pages/__tests__/CoreWorkspacePages.test.tsx`:
- **DashboardPage:** renders 4 scoped KPI cards (โปรเจคของฉัน, งานทั้งหมด, รอตรวจสอบ, งานเลยกำหนด) matching ONLY `visibleProjects` and `visibleTasks`, shows "งานของฉัน" and "งานเร่งรัด & รอการอนุมัติ", and clicking a task calls `onOpenTaskDetail`.
- **MyTasksPage:** lists only tasks where `assigneeId === currentUser.id`; reading `?filter=overdue` from URL pre-selects the `เลยกำหนด` filter tab; switching status/project filters updates visible rows.
- **ProjectsOverviewPage:** shows `+ สร้างโปรเจคใหม่` for Admin/Supervisor and hides it for Staff; shows only visible projects; hides Edit/Delete buttons for Staff and for Supervisors on projects they do not supervise.
- **ProjectWorkspacePage + KanbanBoard + TaskListTable:**
  - Renders 4 tabs (`Kanban Board`, `รายการ`, `ไทม์ไลน์`, `ปฏิทิน`) and `จัดการสมาชิก` button.
  - On Kanban: Staff's `completed` card has `draggable={false}` while own `in_progress` card has `draggable={true}`; dropping Staff's task on `completed` column is blocked with warning toast; Supervisor sees inline `อนุมัติ` and `ส่งแก้ไข` buttons on `review` cards and clicking `อนุมัติ` moves the task to `completed`.
  - **Isolated state fix:** Switching to `ไทม์ไลน์` or `ปฏิทิน` inside Project Workspace and clicking Next Month or Zoom (`กว้าง`) keeps the user on `/projects/:projectId` (never jumps to `/schedule`!).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/__tests__/CoreWorkspacePages.test.tsx`
Expected: FAIL with missing modules.

- [ ] **Step 3: Implement `KanbanBoard`, `TaskListTable`, `DashboardPage`, `MyTasksPage`, `ProjectsOverviewPage`, `ProjectWorkspacePage`, and update `App.tsx`**

- `KanbanBoard`: 4 columns (`todo`, `in_progress`, `review`, `completed`), HTML5 drag-and-drop with `.drag-over` highlight, `draggable={canEditTask(currentUser, task, project)}`, inline `อนุมัติ` / `ส่งแก้ไข` buttons on `review` cards when `canApproveOrRejectTask` is true.
- `TaskListTable`: clean responsive table showing overdue highlighting, assignee avatar/name, Thai date range, `N วัน`, priority/status badges, and RBAC-gated delete button.
- `ProjectWorkspacePage`: holds its own local `activeTab`, `yearMonth`, `zoom`, and `colorMode` state (resetting gracefully on `projectId` change if needed) and reuses `CalendarBoard` and `TimelineGantt`.
- `MyTasksPage`: reads `useSearchParams()` for initial `filter` (`all` | `todo` | `in_progress` | `review` | `completed` | `overdue`), plus project dropdown and due-date/priority sort.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pages/__tests__/CoreWorkspacePages.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/ src/pages/DashboardPage.tsx src/pages/MyTasksPage.tsx src/pages/ProjectsOverviewPage.tsx src/pages/ProjectWorkspacePage.tsx src/pages/__tests__/CoreWorkspacePages.test.tsx src/App.tsx
git commit -m "feat: implement Dashboard, My Tasks, Projects Overview, and Project Workspace (Kanban/List/Timeline/Calendar)"
```

---

### Task 8: Global Schedule, Team Workload, Admin Settings Pages & End-to-End Verification

**Files:**
- Create: `src/pages/GlobalSchedulePage.tsx`, `src/pages/TeamWorkloadPage.tsx`, `src/pages/AdminUsersPage.tsx`, `src/pages/AdminRbacPage.tsx`
- Modify: `src/App.tsx`, `src/main.tsx` (complete route wiring + all Center Modals mounted cleanly + responsive polish)
- Test: `src/pages/__tests__/ScheduleTeamAdmin.test.tsx`

**Interfaces:**
- Consumes: `WorkspaceContext`, `AuthContext`, `CalendarBoard`, `TimelineGantt`, `Badges`, `Modal`, `appConfig.ts`
- Produces:
  - `GlobalSchedulePage({ onOpenCreateTask, onOpenTaskDetail }: { onOpenCreateTask: (opts?: { projectId?: string; startDate?: string }) => void; onOpenTaskDetail: (taskId: string) => void })`
  - `TeamWorkloadPage()`
  - `AdminUsersPage({ onOpenCreateUser }: { onOpenCreateUser: () => void })`
  - `AdminRbacPage()`
  - Complete wired `src/App.tsx` and `src/main.tsx`

- [ ] **Step 1: Write failing integration tests for Global Schedule, Team Workload, and Admin Pages**

Create `src/pages/__tests__/ScheduleTeamAdmin.test.tsx`:
- **GlobalSchedulePage:** toggles between `ปฏิทิน` and `ไทม์ไลน์ (Gantt Chart)`, filters by visible project / status / assignee (hidden projects never appear in dropdown or bars), navigates months and resets to real today cleanly.
- **TeamWorkloadPage:** when logged in as Supervisor (`u2`), displays ONLY teammates from `u2`'s visible projects and counts ONLY tasks from `u2`'s visible projects (zero count leakage from Project 3!).
- **AdminUsersPage & Review Focus #4:**
  - Active Admin's own role `<select>` and delete button are both `disabled`.
  - Demoting Supervisor (`u2`) to `staff` triggers confirmation mentioning the supervised projects being transferred to the acting Admin, and on confirm updates `u2`'s role while reassigning those projects' `supervisorId` to the acting Admin.
  - Deleting a user confirms and cascades project supervision & task assignment cleanly.
  - Shows discreet `รีเซ็ตข้อมูลตัวอย่าง` maintenance button when `ENABLE_DEMO_AUTH` is true.
- **AdminRbacPage:** renders the Member-Scoped RBAC matrix accurately reflecting all 3 roles (including Staff completed-task lock and Member-Scoped visibility).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/__tests__/ScheduleTeamAdmin.test.tsx`
Expected: FAIL with missing modules.

- [ ] **Step 3: Implement `GlobalSchedulePage`, `TeamWorkloadPage`, `AdminUsersPage`, `AdminRbacPage`, and finalize `App.tsx` + `main.tsx`**

- `GlobalSchedulePage`: independent state (`mode`, `yearMonth`, `zoom`, `colorMode`, `projectFilter`, `statusFilter`, `assigneeFilter`), reuses `CalendarBoard` and `TimelineGantt`.
- `TeamWorkloadPage`: maps `visibleTeamUsers`, computes totals/completed/in_progress/review/overdue from `visibleTasks`.
- `AdminUsersPage`: user table/list with inline role select (opens confirmation Center Modal when demoting a user who currently supervises ≥ 1 project), delete confirmation modal showing affected projects/tasks, disabled controls for self, `+ เพิ่มผู้ใช้งานใหม่` button, and discreet Demo Mode reset panel.
- `AdminRbacPage`: clean structured Thai comparison table matching Spec Section 5.4.
- Finalize `src/App.tsx` and `src/main.tsx` mounting `ToastProvider → AuthProvider → WorkspaceProvider → BrowserRouter → AppRoutes` plus the Center Modals (`CreateTaskModal`, `TaskDetailModal`, `ProjectFormModal`, `ProjectMembersModal`, `CreateUserModal`).

- [ ] **Step 4: Run full test suite, typecheck, and production build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: ALL test suites PASS, 0 TypeScript errors, `dist/` builds cleanly with Vite.

- [ ] **Step 5: Verify `promt/design.html` is untouched and commit**

Run: `git status`
Expected: `promt/design.html` unmodified, `.superpowers/` ignored, working tree clean after commit.

```bash
git add src/pages/GlobalSchedulePage.tsx src/pages/TeamWorkloadPage.tsx src/pages/AdminUsersPage.tsx src/pages/AdminRbacPage.tsx src/pages/__tests__/ScheduleTeamAdmin.test.tsx src/App.tsx src/main.tsx
git commit -m "feat: implement Global Schedule, Team Workload, Admin Users/RBAC pages, and full app wiring"
```
