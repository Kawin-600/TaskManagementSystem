# TaskFlow Pro — Website & Architecture Design Document

**Date:** 2026-11-20  
**Source Reference:** `promt/design.html` (kept untouched as reference)  
**Project Size:** Full Project (multi-view internal web application with RBAC, modular service layer, and redesigned layout)

---

## 1. Intent & Why

We are building **TaskFlow Pro**, an internal task and project management web application tailored for a **small organization** (`องค์กรขนาดเล็ก`), evolving the single-file prototype in `promt/design.html` into a clean, maintainable, extensible website.

The prototype already proves the core Thai-language workflows (Dashboard, Projects, Kanban with review/approval, List, Gantt Timeline, Multi-day Calendar, Team Workload, User Management), but it has structural limitations for real small-org use:
- Everything lives in one 2,288-line HTML file with inline `innerHTML` string templates.
- There is no Login flow (only a demo Role Switcher occupying the Topbar).
- Project visibility is wide open to everyone even though projects have a `members` list.
- Prototype defects exist: hardcoded today date (`2026-11-20`), shared state leaking between Global Calendar/Timeline and Project Workspace tabs, inefficient vertical stacking of calendar bars, and inconsistent Staff permission checks.

The user plans to **connect real Login/Authentication** and **add more features in the future**. Therefore, v1 must deliver a polished, focused layout and rock-solid core feature set built on a modular architecture whose auth and data layers can be swapped for a real backend without rewriting UI views.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
1. Deliver a clean **internal-only web app** (`Login → Focused Dual-Rail Workspace`) ready for day-to-day small-org use.
2. Implement **Member-Scoped 3-Role RBAC** (`Admin`, `หัวหน้างาน / Supervisor`, `เจ้าหน้าที่ / Staff`) enforced consistently across navigation, data visibility, drag-and-drop, and modals.
3. Preserve and refine all core capabilities from `promt/design.html` — plus a dedicated **งานของฉัน (My Tasks)** view and **Project Member Management** — while fixing all known prototype bugs.
4. Keep UI, domain permission rules, authentication (`AuthService`), and persistence (`WorkspaceRepository`) cleanly decoupled so future backend/auth integration and new features plug in smoothly.

### Non-Goals (Explicitly Deferred by User for Future Versions)
- No public marketing/company landing page.
- No real backend server, database, or production OAuth/JWT server in v1 (v1 ships with a real Login UI + `LocalAuthService` + removable Demo Quick-Login; real auth plugs into the same interface later).
- No subtasks/checklists, binary file upload storage, audit/activity logs, or external email/push notifications in v1.

### Anti-Goals (Failure Conditions)
- **Visibility leaks:** Showing projects, tasks, calendar bars, or workload counts from projects a Supervisor or Staff member does not belong to.
- **Permission bypasses:** Allowing Staff to move tasks directly to `completed`, edit/delete another person's task, or assign tasks to other people.
- **Prototype clutter in production UI:** Putting a permanent Role Switcher in the Topbar, placing "Reset Data" in the primary navigation, or showing the RBAC Matrix in non-Admin main navigation.
- **Cross-view state bugs:** Changing month, zoom, or filters inside a Project's Calendar/Timeline jumping the user to the Global Calendar/Timeline view.
- **Hardcoded dates:** Freezing "today" at `2026-11-20` instead of using the real current date.
- **Direct storage coupling:** Reading/writing `localStorage` directly inside React UI components instead of going through the service layer.

---

## 3. Constraints

- **Language & Localization:** Full Thai UI (`lang="th"`), `Prompt` and `Sarabun` Google Fonts (with system Thai sans fallback), Buddhist Era date formatting (e.g., `20 พ.ย. 69`, `พฤศจิกายน 2569`), Thai weekday headers (`อาทิตย์`–`เสาร์`).
- **Environment:** Runs locally with Node.js v20+ and npm v10+ (Vite dev server and static build).
- **Source Preservation:** Do not modify or delete `promt/design.html`.
- **Responsiveness:** Desktop-first (optimized for Kanban 4-column board and 30-day Gantt chart) with clean responsive drawer behavior on tablet/mobile (`< 768px`).

---

## 4. Approaches Considered

| Approach | Summary | Tradeoffs |
|---|---|---|
| **1. React + TypeScript + Vite + Tailwind CSS (SPA with Service Layer)** *(Chosen)* | Modular component app (Dual-Rail Shell, views, Center Modals) with isolated `AuthService` and `WorkspaceRepository` interfaces backed by `localStorage` in v1. | Data stays browser-local until connected to a backend; requires Node/Vite toolchain. |
| **2. Next.js Full-Stack (TypeScript + Tailwind + SQLite/Prisma + Real Auth)** | Full web app + API routes + SQLite database + real email/password session auth from day one. | Much larger v1 surface (schema, migrations, auth cookies, server deployment) before core UX/layout stabilizes. |
| **3. Multi-file Vanilla HTML/CSS/JS (ES Modules + Tailwind)** | Split `promt/design.html` into ES module files with zero build tooling. | Manual DOM/state synchronization gets fragile quickly across Dual-Rail + Kanban/Gantt/Calendar + future login/features. |

**Picked by User:** **Approach 1 (React + TypeScript + Vite + Tailwind CSS)**.  
**Why:** Best balance for a small organization starting with layout & core workflows while explicitly planning real login and additional features next — TypeScript enforces RBAC/data contracts, components stay cleanly separated, and swapping `LocalAuthService`/`LocalStorageRepository` for any future backend (Supabase, Firebase, Express/PostgreSQL, etc.) requires zero UI rewrites.

---

## 5. Decided Architecture & Website Layout

*(Items marked **[User Decision]** were explicitly chosen by the user. Items marked **[Design Call]** are proposed defaults aligned with their goals for confirmation during review.)*

### 5.1 Entry Flow & Authentication UX
- **Website Boundary [User Decision]:** Internal web app only — unauthenticated users land on `/login`; authenticated users enter the workspace.
- **Login Page (`/login`) [Design Call]:**
  - Clean centered card on soft neutral/indigo-tinted background with TaskFlow Pro logo.
  - Standard email + password form backed by `AuthService.login(email, password)` (in v1, matches seeded/admin-created users with demo password or email-only fallback when using quick login).
  - Clearly separated **"ทดลองเข้าใช้งานด่วน (Demo Mode)"** panel underneath with one-click sign-in buttons for sample accounts (`Admin`, `หัวหน้างาน`, `เจ้าหน้าที่`). Isolated in a single component (`DemoQuickLogin`) controlled by a config flag (`ENABLE_DEMO_AUTH`) so it is removed in one line when real auth connects.
  - Logging out clears the active session via `AuthService.logout()` and navigates to `/login`.

### 5.2 App Shell & Navigation — Focused Dual-Rail **[User Decision: Option B]**
- **1. Primary Icon Rail (Leftmost, 64px wide on desktop, dark `#0f172a`):**
  - Top: TaskFlow Pro brand emblem.
  - Core navigation icon buttons (with Thai hover tooltips + active Indigo `#4f46e5` pill indicator):
    1. **แดชบอร์ด** (`/`) — Dashboard Overview
    2. **งานของฉัน** (`/my-tasks`) — Dedicated My Tasks view (badge showing count of active/overdue tasks assigned to me)
    3. **โปรเจค** (`/projects` and `/projects/:projectId`) — Projects Overview & Workspace (activates Contextual Sub-Panel)
    4. **ปฏิทิน & ไทม์ไลน์รวม** (`/schedule`) — Global Calendar & Gantt Timeline
    5. **ทีมงาน & ภาระงาน** (`/team`) — Team Workload
    6. **จัดการระบบ** (`/admin/users`, `/admin/rbac`) — Admin Settings *(rendered ONLY when `user.role === 'admin'`)*
  - Bottom: User Avatar button → opens compact Account Popover showing full name, role badge, email, and **ออกจากระบบ (Logout)**.
- **2. Contextual Sub-Panel (224px wide, light `#f8fafc` with subtle right border, collapsible):**
  - **When in Projects / Project Workspace:** Shows header "โปรเจคของฉัน" (+ `+` create button for Admin/Supervisor), clickable link to "โปรเจคทั้งหมด", and list of visible projects (color dot + truncated name + pending-review badge if any). Includes a prominent collapse button (`ซ่อนแผง`) so Kanban 4-column board and 30-day Gantt chart expand to ~95% viewport width. Collapse state is remembered during the session.
  - **When in Admin Settings:** Shows sub-navigation switching between `จัดการผู้ใช้งาน` and `ตารางสิทธิ์ (RBAC Matrix)`.
  - **On Dashboard, My Tasks, Global Schedule, Team Workload:** Hidden by default to maximize workspace canvas.
- **3. Topbar Header (56px height, crisp white `#ffffff` with bottom border):**
  - Left: Mobile menu button (`< 768px`) / Sub-panel expand button (when collapsed on a sub-panel route) + Page title & concise subtitle/breadcrumb.
  - Right:
    - **Quick Search** input (instant dropdown/filter matching visible projects and tasks by title).
    - **Attention Indicator Pill [Design Call]:**
      - For Admin/Supervisor: clickable `รอตรวจ N` pill that opens a compact Topbar dropdown popover listing all `review` tasks across all visible projects (regardless of month); clicking an item opens its Task Detail Center Modal with Approve/Reject actions.
      - For Staff: clickable `เลยกำหนด N` pill (shown when > 0) that navigates directly to `/my-tasks?filter=overdue`.
    - **Dynamic Thai Today Badge:** Real current date formatted in Thai Buddhist Era (e.g., `วันนี้: 20 พ.ย. 2569`).
    - **Primary `+ สร้างงาน` button:** Opens Create Task Center Modal (enabled when the user has at least 1 visible project).
- **4. Responsive Drawer (`< 768px`) [Design Call]:**
  - Icon Rail and Sub-Panel combine into a slide-over drawer with backdrop opened via Topbar hamburger button.

### 5.3 Visual Tone & Color System **[Design Call, previewed & accepted]**
- Evolved from `promt/design.html`:
  - **Icon Rail:** Slate 900 (`#0f172a`) with Slate 400 icons and Indigo 600 (`#4f46e5`) active state.
  - **Canvas & Surfaces:** Slate 50 (`#f8fafc`) page background, crisp White (`#ffffff`) cards with Slate 200 borders.
  - **Semantic Status Colors:** `todo` = Slate, `in_progress` = Indigo, `review` = Amber (`#f59e0b`), `completed` = Emerald (`#10b981`), `overdue` = Rose (`#f43f5e`).
  - **Project Accent Colors:** User-selectable color palette (`#4f46e5`, `#10b981`, `#f43f5e`, `#8b5cf6`, `#06b6d4`, `#f59e0b`).
  - **Typography:** `Prompt` (headings/UI) and `Sarabun` (body/tables).

### 5.4 RBAC & Member-Scoped Visibility **[User Decision: Option 2]**

All permission rules live centrally in a pure domain module (`src/domain/rbac.ts`) used by both UI controls and repository mutations:

| Capability | Admin (`admin`) | หัวหน้างาน (`supervisor`) | เจ้าหน้าที่ (`staff`) |
|---|---|---|---|
| **Visible Projects** | All projects | Projects where `supervisorId === me` or `me ∈ memberIds` | Projects where `me ∈ memberIds` |
| **Create Project** | Yes | Yes (auto-assigned as supervisor & member) | No |
| **Edit Project / Manage Members / Delete Project** | Any project | Projects where `supervisorId === me` **[Design Call]** | No (can view member list read-only) |
| **View Tasks (Kanban/List/Timeline/Calendar/Search)** | All tasks | Tasks in visible projects only | Tasks in visible projects only |
| **Create Task** | Any project, assign to any member of that project | Visible projects, assign to any member of that project | Member projects only, assigned to **self only** **[Design Call]** |
| **Edit Task Details & Dates** | Any task | Any task in visible projects | Own non-completed tasks only (`assigneeId === me && status !== 'completed'`); cannot reassign **[User Decision]** |
| **Change Task Status** | Any status | Any status (in visible projects) | Own non-completed tasks only: `todo` ↔ `in_progress` ↔ `review` (blocked from moving to `completed`, and `completed` tasks are locked from reopening/dragging for Staff) **[User Decision]** |
| **Approve / Reject / Reopen Tasks** | Yes | Yes (in visible projects) | No |
| **Delete Task** | Yes | Yes (in visible projects) | No |
| **Post Comments** | Any task | Any task in visible projects | Any task in visible projects (including `completed` tasks) **[Design Call]** |
| **Team Workload View** | All users, all tasks | Members of visible projects, tasks in visible projects only | Members of visible projects, tasks in visible projects only |
| **User Management & RBAC Matrix** | Full CRUD (cannot delete or demote self) | No access (hidden from Rail + route guard) | No access (hidden from Rail + route guard) |

> **Data Integrity Rules [Design Call]:**
> - A project's `supervisorId` is always kept inside `memberIds` so a supervisor never locks themselves out.
> - When removing a member from a project who still has tasks assigned in that project, show a confirmation warning and automatically reassign those tasks to the project's `supervisorId` so no orphaned assignee exists.
> - On `/admin/users`, both the **role dropdown** and **delete button** are disabled for the currently logged-in Admin to prevent self-lockout.
> - When an Admin demotes a user (`admin`/`supervisor` → `staff`) who currently supervises one or more projects, show a confirmation warning and atomically transfer `supervisorId` on those projects to the acting Admin (keeping the demoted user in `memberIds` and ensuring the acting Admin is also in `memberIds`).
> - When an Admin deletes a user, show a confirmation warning, remove them from all project `memberIds`, transfer any projects they supervised to the acting Admin, and reassign their assigned tasks to each project's supervisor.

### 5.5 Core Views & Center Modal Interactions

**Task Detail & Form Presentation [User Decision: Option 2 — Center Modal]:**  
All creation, editing, task detail/comments/approval, and project member management flows open in a **Center Modal** with dimmed backdrop (`Esc` key and backdrop click close cleanly).

1. **แดชบอร์ดภาพรวม (`/`):**
   - 4 KPI stat cards scoped to visible projects/tasks: โปรเจคของฉัน, งานทั้งหมด (+ เสร็จแล้ว N งาน), รอตรวจสอบ, งานเลยกำหนด (calculated against real today).
   - 2-column grid:
     - Left: **"งานของฉัน"** card (top actionable own tasks, link to `/my-tasks`) + **"งานเร่งรัด & รอการอนุมัติ"** card (review + overdue tasks in visible projects).
     - Right: **"ความคืบหน้าโปรเจคของฉัน"** list with color dots, completion %, progress bar, supervisor name, and click-through to `/projects/:id`.
2. **งานของฉัน (`/my-tasks`) [Design Call]:**
   - Dedicated view of all tasks where `assigneeId === currentUser.id` (within visible projects).
   - Filter bar: status tabs (`ทั้งหมด`, `รอดำเนินการ`, `กำลังทำ`, `รอตรวจสอบ`, `เสร็จสิ้น`, `เลยกำหนด`), project filter dropdown, priority sort.
   - Clean list/card rows showing project dot, title, date range, priority badge, status badge, overdue tag; clicking opens Task Edit Center Modal.
3. **โปรเจคทั้งหมด (`/projects`):**
   - Header bar with count and `+ สร้างโปรเจคใหม่` button (Admin/Supervisor).
   - Responsive card grid of visible projects: top color strip, name, pending-review pill, description, progress bar (`%`), supervisor & member avatar stack, task count, "เข้าสู่ Workspace →" button, and edit/delete actions (if permitted).
4. **พื้นที่ทำงานโปรเจค (`/projects/:projectId`):**
   - Compact project banner: color accent bar, name, completion % pill, description, member avatar stack + `จัดการสมาชิก` button (opens Member Management Center Modal), and `+ เพิ่มงาน` button.
   - Tab switcher (local state per workspace, completely independent from Global Schedule!):
     - **Kanban Board:** 4 columns (`รอดำเนินการ`, `กำลังทำ`, `รอตรวจสอบ`, `เสร็จสิ้น`), drag-and-drop with dropzone highlight and RBAC validation + toast feedback (cards in `เสร็จสิ้น` are non-draggable for Staff), inline `อนุมัติ` / `ส่งแก้ไข` buttons on Review cards for Admin/Supervisor.
     - **List View:** Table with task title (overdue highlighted), assignee avatar/name, Thai start–due range, duration (`N วัน`), priority badge, status badge, delete button (if permitted).
     - **Timeline (Gantt Chart):** Month prev/next + Today button, zoom (`กะทัดรัด` 36px / `ปกติ` 46px / `กว้าง` 60px), color mode (`ตามโปรเจค` / `ตามสถานะ`), sticky left task column, vertical red Today indicator line, weekend shading, multi-day clickable bars with duration label and overdue ring.
     - **Calendar:** Month prev/next + Today button, 7-column Thai week grid, **proper multi-day horizontal lane packing** (tasks that don't overlap share the same lane row horizontally instead of stacking vertically one per div!), hover `+` quick-add date button (if user can create task in this project), and `+ อีก N งาน` clickable overflow popover/modal when a week exceeds 3 visible lanes.
5. **ปฏิทิน & ไทม์ไลน์รวม (`/schedule`):**
   - Switches between `Calendar` and `Timeline (Gantt)` using the **same shared `CalendarBoard` and `TimelineGantt` components** as Project Workspace, with its own isolated state (`month`, `zoom`, `colorMode`, filters: project / status / assignee limited to visible scope).
6. **ทีมงาน & ภาระงาน (`/team`):**
   - Cards for visible team members showing avatar, name, role badge, and scoped task counts (ทั้งหมด / เสร็จสิ้น / กำลังทำ / รอตรวจสอบ / เลยกำหนด).
7. **จัดการระบบ — Admin Only (`/admin/users`, `/admin/rbac`):**
   - **จัดการผู้ใช้งาน:** List all users with email, avatar, inline role dropdown & delete user button (both disabled for self; demoting a supervisor with active projects confirms and transfers supervision to the acting Admin), `+ เพิ่มผู้ใช้งานใหม่` Center Modal, and (only when `ENABLE_DEMO_AUTH` / mock repository is active) a discreet "รีเซ็ตข้อมูลตัวอย่าง" button in an admin maintenance box.
   - **ตารางสิทธิ์ (RBAC Matrix):** Accurate comparison table reflecting the Member-Scoped rules in Section 5.4.
8. **Center Modals:**
   - **Create Task Modal:** Project dropdown (visible projects), Title, Description, Assignee dropdown (filtered to selected project's members; locked to self for Staff), Priority, Start Date & Due Date with live automatic duration badge (`N วัน`) and validation (`dueDate >= startDate`).
   - **Task Detail / Edit Modal:** Editable fields and Status dropdown disabled when read-only (including for Staff on `completed` tasks, with a subtle notice that completed tasks can only be reopened by a Supervisor/Admin); Status dropdown validated against RBAC; Review Approval panel (`อนุมัติงาน` / `ส่งกลับแก้ไข`) shown for Admin/Supervisor when status is `review`; Comments list with clickable URL linkification (for pasting work links) + comment composer (always enabled for project members); Delete button (if permitted).
   - **Create / Edit Project Modal & Manage Members Modal:** Name, Description, Supervisor selector (`admin` or `supervisor` users), Color swatch selector, Member checkboxes (supervisor always checked & locked).
   - **Create User Modal (Admin):** Full name, Email, Role, initial password (for local login).

---

## 6. Core Data Model & Service Layer Boundary

```ts
export type UserRole = 'admin' | 'supervisor' | 'staff';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Local mock auth only; omitted by real API responses
  role: UserRole;
  avatar: string;    // 2-char Thai initials
  color: string;     // Semantic color key
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;       // Hex accent
  supervisorId: string;
  memberIds: string[]; // Always includes supervisorId
}

export interface TaskComment {
  id: string;
  userId: string;
  text: string;
  createdAt: string; // ISO timestamp
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  assigneeId: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD
  createdAt: string; // YYYY-MM-DD
  comments: TaskComment[];
}
```

### Extensible Service Interfaces (for Future Real Auth & Backend)
- **`AuthService` (`src/services/authService.ts`):**
  - `getSession(): Promise<User | null>`
  - `login(email: string, password: string): Promise<User>`
  - `loginAsDemoUser?(userId: string): Promise<User>` *(optional, only implemented in local demo mode)*
  - `logout(): Promise<void>`
- **`WorkspaceRepository` (`src/services/workspaceRepository.ts`):**
  - Async CRUD methods for `users`, `projects` (including member updates), `tasks` (including status changes & comments), and `resetSampleData?()` (mock mode only).
  - Returning Promises from day one ensures React state hooks handle async flows identically when `LocalStorageRepository` is swapped for an HTTP/Supabase/Firebase implementation.
- **Dynamic Seed Data [Design Call]:**
  - Seed sample users (4 Thai users mirroring `promt/design.html`), 3 projects (with distinct `memberIds` so Member-Scoped visibility is immediately demonstrable — e.g., Supervisor #2 is in Projects 1 & 2, excluded from Project 3; Staff #3 & #4 have partially overlapping project memberships), and 12 realistic tasks whose `startDate` and `dueDate` are computed **relative to real today** (e.g., `today - 10d` to `today + 10d`) so Overdue, Review, In-Progress, and Upcoming bars are always visible on the current month's Calendar and Gantt Timeline.

---

## 7. What Is Left to the Builder

The builder has freedom to settle these implementation details without returning to the user:
- Exact package selections within the React + TypeScript + Vite + Tailwind CSS ecosystem (e.g., `react-router-dom` for routing, `lucide-react` for clean crisp icons replacing CDN FontAwesome, `vitest` + `@testing-library/react` for automated tests).
- Exact Tailwind styling polish, spacing scale, subtle hover/modal transitions, empty-state illustrations/messages, and keyboard shortcuts (`Esc` to close modal).
- Internal state management wiring (React Context + hooks or lightweight store) as long as UI components only talk to `AuthService`, `WorkspaceRepository`, and `src/domain/rbac.ts`.
- Project directory layout under `src/` and Vite build/test configuration.

