# Roadmap View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "แผนงาน (Roadmap)" mode to the global schedule page showing manually tracked project milestones on a two-month weekly timeline.

**Architecture:** A new `Milestone` record flows through the existing layers: `types/models.ts` → pure rules in `domain/roadmap.ts` and `domain/rbac.ts` → `WorkspaceRepository` (localStorage) → `WorkspaceContext` → presentational components under `components/schedule/` → `GlobalSchedulePage`. Status, phase number and project progress are derived, never stored.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, lucide-react, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-20-roadmap-view-design.md`

## Global Constraints

- Thai UI copy; Buddhist-era dates through the helpers in `src/domain/dates.ts`.
- No project codes. No link between milestones and tasks.
- Components never touch `localStorage`; all persistence goes through `WorkspaceRepository`.
- Calendar and Gantt modes keep their current behaviour; every existing test stays green.
- View follows project visibility; create/edit/delete requires `canManageProject`.
- "Today" always comes from `getTodayStr()` / the repository's injected clock, never a literal.
- No git commits unless the user asks (repo is on `main`).

## Review Focus

1. **Existing browser data without a milestones key** — loading must add seed milestones without resetting users, projects or tasks. (Task 2 test)
2. **Milestone longer than or outside the two-month window** — bar is clipped to the grid; fully outside means a row with no bar, not a negative width. (Task 1 test)
3. **Milestone ending today** — it is not delayed until the day after. (Task 1 test)
4. **Owner removed from the project or deleted** — ownership moves to the project supervisor; no milestone is left pointing at a missing user. (Task 2 test)
5. **Progress typed as 150, -5, 33.6 or empty** — stored as an integer clamped to 0–100. (Task 2 test)

---

### Task 1: Types and pure rules

**Files:**
- Modify: `src/types/models.ts`, `src/domain/rbac.ts`, `src/domain/dates.ts`
- Create: `src/domain/roadmap.ts`
- Test: `src/domain/__tests__/roadmap.test.ts`, `src/domain/__tests__/rbac.test.ts` (append)

**Interfaces — Produces:**

```ts
// models.ts
export type MilestoneStatus = 'completed' | 'in_progress' | 'delayed' | 'not_started';
export interface Milestone { id: string; projectId: string; title: string; ownerId: string;
  startDate: string; endDate: string; progress: number; createdAt: string; }
export interface CreateMilestoneInput { projectId: string; title: string; ownerId: string;
  startDate: string; endDate: string; progress: number; }
export interface UpdateMilestoneInput { title?: string; ownerId?: string; startDate?: string;
  endDate?: string; progress?: number; }

// dates.ts
export function getThaiMonthShort(month1to12: number): string;

// roadmap.ts
export interface RoadmapWeek { key: string; startDate: string; endDate: string;
  label: string;        // 'พ.ย. สัปดาห์ 1'
  rangeLabel: string; } // '1-7 พ.ย.'
export interface MilestoneStats { total: number; completed: number; inProgress: number;
  delayed: number; notStarted: number; }
export function getMilestoneStatus(m: Pick<Milestone,'progress'|'endDate'>, todayStr: string): MilestoneStatus;
export function getPhaseNumbers(milestones: Milestone[]): Map<string, number>;
export function getProjectProgress(milestones: Milestone[]): number;
export function countMilestoneStats(milestones: Milestone[], todayStr: string): MilestoneStats;
export function getRoadmapWeeks(yearMonth: string): RoadmapWeek[];
export function getRoadmapOffset(dateStr: string, weeks: RoadmapWeek[], edge: 'start'|'end'): number;
export function getMilestoneBar(m: Pick<Milestone,'startDate'|'endDate'>, weeks: RoadmapWeek[]): { leftPct: number; widthPct: number } | null;
export function getTodayLinePct(todayStr: string, weeks: RoadmapWeek[]): number | null;
export function getRoadmapRangeLabel(yearMonth: string): string;

// rbac.ts
export function getVisibleMilestones(user: User, projects: Project[], milestones: Milestone[]): Milestone[];
export function canManageMilestones(user: User, project: Project): boolean; // = canManageProject
```

Rules the signatures do not determine:
- Status, first match wins: `progress >= 100` → completed; `endDate < todayStr` → delayed; `progress > 0` → in_progress; else not_started.
- Phase numbers: per project, sort by `startDate`, then `createdAt`, then `id`; number from 1.
- Project progress: `Math.round` of the mean; 0 for an empty list.
- Weeks: 8 columns, four per month for `yearMonth` and the next month: days 1–7, 8–15, 16–23, 24–last day.
- Offset: each week owns 1/8 of the width; inside a week a day is placed linearly. `edge: 'start'` returns the left edge of the day, `'end'` the right edge. Dates before the window clamp to 0, after it to 1.
- Bar: `left = offset(start,'start')`, `right = offset(end,'end')`; return `null` when the milestone ends before the window or starts after it; percentages are 0–100.
- Today line: centre of today's day, `null` outside the window.
- Range label: `'พฤศจิกายน – ธันวาคม 2569'`; when the window crosses a year, `'ธันวาคม 2569 – มกราคม 2570'`.

- [ ] **Step 1: Write failing tests** in `roadmap.test.ts`:
  - status: `{progress:100,endDate:'2026-11-01'}` → completed; `{progress:55,endDate:'2026-11-19'}` → delayed; `{progress:55,endDate:'2026-11-20'}` → in_progress (today `2026-11-20`); `{progress:0,endDate:'2026-11-19'}` → delayed; `{progress:0,endDate:'2026-12-01'}` → not_started.
  - phase numbers: three milestones of `p1` given out of order plus one of `p2` → `p1` ones numbered 1,2,3 by start date, the `p2` one is 1.
  - project progress: `[100,65,10]` → 58; `[]` → 0.
  - weeks for `'2026-11'`: length 8; `weeks[0]` is `2026-11-01`..`2026-11-07`, label `'พ.ย. สัปดาห์ 1'`, rangeLabel `'1-7 พ.ย.'`; `weeks[3]` ends `2026-11-30`; `weeks[7]` is `2026-12-24`..`2026-12-31`. For `'2027-02'`, `weeks[3].endDate` is `2027-02-28`.
  - bar: `2026-11-01`..`2026-11-07` → `{leftPct:0,widthPct:12.5}`; `2026-10-01`..`2027-03-01` → `{leftPct:0,widthPct:100}`; `2026-09-01`..`2026-10-15` → `null`; `2027-01-05`..`2027-01-09` → `null`; a one-day milestone has `widthPct > 0`.
  - today line: `'2026-11-20'` is between 25 and 37.5; `'2026-10-31'` → `null`.
  - range label: `'2026-11'` → `'พฤศจิกายน – ธันวาคม 2569'`; `'2026-12'` → `'ธันวาคม 2569 – มกราคม 2570'`.
  - stats: counts each status once and `total` is the list length.
  Append to `rbac.test.ts`: staff member sees only milestones of their projects; admin sees all; `canManageMilestones` is true for admin and the owning supervisor, false for staff and for a supervisor who is only a member.
- [ ] **Step 2:** `npx vitest run src/domain` → new tests fail (module missing).
- [ ] **Step 3:** Implement the types and functions above.
- [ ] **Step 4:** `npx vitest run src/domain` → all pass.

### Task 2: Storage, seed data, repository

**Files:**
- Modify: `src/config/appConfig.ts` (add `milestones: 'taskflow_v2_milestones'`), `src/services/seedData.ts`, `src/services/workspaceRepository.ts`
- Test: `src/services/__tests__/workspaceRepository.test.ts` (append)

**Interfaces — Produces:**
- `WorkspaceSnapshot.milestones: Milestone[]`; `createSeedData()` returns `milestones` too.
- `WorkspaceRepository.createMilestone(input: CreateMilestoneInput): Promise<Milestone>`, `updateMilestone(id: string, input: UpdateMilestoneInput): Promise<Milestone>`, `deleteMilestone(id: string): Promise<void>`.

Decisions:
- Seed (D = today, via `addDays`):

| id | project | title | owner | start | end | % |
|---|---|---|---|---|---|---|
| m101 | p1 | วิเคราะห์ความต้องการและออกแบบ UX/UI | u2 | D-19 | D-8 | 100 |
| m102 | p1 | พัฒนาระบบชำระเงินและเชื่อมต่อ API | u3 | D-7 | D+7 | 65 |
| m103 | p1 | ทดสอบระบบ UAT และเปิดใช้งานจริง (Go-Live) | u4 | D+8 | D+25 | 0 |
| m201 | p2 | รวบรวมชุดข้อมูลและออกแบบบทสนทนา | u4 | D-17 | D-4 | 100 |
| m202 | p2 | ฝึกโมเดล NLP ภาษาไทย | u2 | D-10 | D-2 | 55 |
| m203 | p2 | ทดสอบกับลูกค้าจริงและปรับปรุงคำตอบ | u4 | D+5 | D+24 | 0 |
| m301 | p3 | ออกแบบแบบสอบถามและเก็บข้อมูลภาคสนาม | u3 | D-10 | D+3 | 70 |
| m302 | p3 | วิเคราะห์ข้อมูลและจัดทำรายงานแนวโน้ม | u1 | D+4 | D+30 | 0 |

- `readSnapshot`: users/projects/tasks logic unchanged. If the milestones key is missing or fails `isValidMilestone`, use seed milestones whose project still exists and whose owner is that project's supervisor or member, and write only the milestones key. A stored `[]` is valid and stays empty.
- Validation errors (thrown `Error` messages): empty title → `กรุณาระบุชื่อ Milestone`; unknown project → `ไม่พบโปรเจค`; owner not supervisor/member → `ผู้ดูแลต้องเป็นสมาชิกของโปรเจค`; `endDate < startDate` → `วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น`; unknown id on update → `ไม่พบ Milestone ที่ต้องการแก้ไข`. Update validates the merged record.
- Progress: non-finite → 0, then `Math.round`, then clamp 0–100.
- Cascades: `deleteProject` drops the project's milestones; `updateProject` and `updateProjectMembers` move `ownerId` to the supervisor when the owner is no longer a member; `deleteUser` moves `ownerId` to the project's (possibly new) supervisor; `resetSampleData` restores seed milestones.

- [ ] **Step 1: Write failing tests** (clock `2026-11-20`):
  - fresh load has 8 milestones; with `countMilestoneStats` → completed 2, inProgress 2, delayed 1, notStarted 3.
  - Review Focus 1: load, create a project, remove the milestones key, load again → the created project is still there and milestones has 8 entries. Then set the key to `'[]'` and load → 0 milestones.
  - create/update/delete round-trip persists across a new repository instance.
  - each validation message above is thrown.
  - Review Focus 5: progress `150` → 100, `-5` → 0, `33.6` → 34, `NaN` → 0.
  - Review Focus 4: `updateProjectMembers('p1', ['u2','u4'])` → `m102.ownerId === 'u2'`; `deleteUser('u4','u1')` → `m103`, `m201`, `m203` owned by `u2`; `deleteUser('u2','u1')` → `m101`, `m202` owned by `u1`.
  - `deleteProject('p1')` leaves 5 milestones.
- [ ] **Step 2:** `npx vitest run src/services` → new tests fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run src/services` → all pass.

### Task 3: Workspace context

**Files:**
- Modify: `src/state/WorkspaceContext.tsx`
- Test: `src/state/__tests__/WorkspaceContext.test.tsx` (append)

**Interfaces — Produces** on `useWorkspace()`:
- `milestones: Milestone[]`, `visibleMilestones: Milestone[]`
- `createMilestone(input: CreateMilestoneInput): Promise<Milestone | null>`
- `updateMilestone(id: string, input: UpdateMilestoneInput): Promise<Milestone | null>`
- `deleteMilestone(id: string): Promise<boolean>`

Follow the existing action pattern (permission check → repository → `reload()` → toast). Toasts: denied `คุณไม่มีสิทธิ์จัดการ Milestone ของโปรเจคนี้` (error); success `เพิ่ม Milestone ใหม่เรียบร้อยแล้ว`, `อัปเดต Milestone เรียบร้อยแล้ว`, `ลบ Milestone เรียบร้อยแล้ว` (info). Load, reload and reset also set milestones.

- [ ] **Step 1: Write failing tests** following the file's existing harness: supervisor `u2` sees 6 visible milestones, staff `u3` sees 5; `u2` can create in `p1`; `u3` create returns `null` and nothing is stored; `u2` (not a member of `p3`) cannot update `m301`.
- [ ] **Step 2:** `npx vitest run src/state` → fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run src/state` → pass.

### Task 4: Roadmap components and modal

**Files:**
- Create: `src/components/schedule/RoadmapStats.tsx`, `RoadmapBoard.tsx`, `RoadmapList.tsx`, `src/components/modals/MilestoneFormModal.tsx`
- Test: `src/components/schedule/__tests__/RoadmapComponents.test.tsx`

**Interfaces — Produces:**

```ts
RoadmapStats({ stats }: { stats: MilestoneStats })
// data-testid: roadmap-stat-total | -completed | -in-progress | -delayed

interface RoadmapViewProps { yearMonth: string; todayStr: string; projects: Project[];
  milestones: Milestone[]; users: User[];
  canManageProject: (projectId: string) => boolean;
  onMilestoneClick: (milestone: Milestone) => void; }
RoadmapBoard(props: RoadmapViewProps)
// data-testid: roadmap-row-{id}, roadmap-bar-{id} (data-status attr), roadmap-today-line
RoadmapList(props: RoadmapViewProps & { onDelete: (milestone: Milestone) => void })

MilestoneFormModal({ isOpen, onClose, milestone, defaultProjectId }:
  { isOpen: boolean; onClose: () => void; milestone?: Milestone | null; defaultProjectId?: string })
```

Decisions:
- Status colours: completed emerald, in_progress indigo, delayed rose, not_started slate. Thai labels: `เสร็จสิ้น`, `กำลังทำ`, `ล่าช้า`, `รอเริ่ม`.
- Board: left column 320px, 8 equal week columns, min grid width so it scrolls horizontally on small screens. Project group row shows colour dot, name and `getProjectProgress`%. Projects without milestones are not listed. A row's bar is absent when `getMilestoneBar` is `null`. Bars and rows are buttons only when `canManageProject(projectId)`.
- Modal: titles `เพิ่ม Milestone ใหม่` / `แก้ไข Milestone`. Fields with labels `โปรเจค` (manageable projects only, disabled when editing), `ชื่อ Milestone`, `ผู้ดูแล` (supervisor + members of the chosen project; reset when the project changes), `วันเริ่มต้น`, `วันสิ้นสุด`, `ความคืบหน้า (%)` (range slider plus number input). Client-side errors use the repository's messages. Edit mode has `ลบ Milestone`, which asks `window.confirm('ยืนยันการลบ Milestone นี้?')`.

- [ ] **Step 1: Write failing tests**: stats render the four numbers; board renders a bar with `data-status="delayed"` for an overdue milestone, no bar for a milestone outside the window, the today line when today is in the window, and group progress `58%` for 100/65/10; clicking a bar calls `onMilestoneClick` only when `canManageProject` returns true; list shows status label and calls `onDelete`.
- [ ] **Step 2:** `npx vitest run src/components/schedule` → fail.
- [ ] **Step 3:** Implement the four files.
- [ ] **Step 4:** `npx vitest run src/components` → pass.

### Task 5: Page integration

**Files:**
- Modify: `src/pages/GlobalSchedulePage.tsx`
- Test: `src/pages/__tests__/ScheduleTeamAdmin.test.tsx` (append)

Decisions:
- `mode` becomes `'calendar' | 'timeline' | 'roadmap'`; third button `แผนงาน (Roadmap)`.
- In roadmap mode: the month label shows `getRoadmapRangeLabel(yearMonth)`; status and assignee selects are not rendered; the project select stays. Below the controls: `RoadmapStats`, then a card with the `ไทม์ไลน์ (Gantt)` / `รายการเฟสงาน` toggle, the `เพิ่ม Milestone ใหม่` button (only when the user can manage at least one visible project), the header `กรอบเวลาแผนงาน: …`, the legend, and the board or list. Empty state text: `ยังไม่มี Milestone ในโปรเจคที่เลือก`.
- The page owns the modal state and renders `MilestoneFormModal` itself (no `App.tsx` change needed).

- [ ] **Step 1: Write failing tests**:
  - as `u2`: click `แผนงาน (Roadmap)` → `roadmap-stat-total` shows 6, delayed shows 1; `roadmap-bar-m102` exists; `roadmap-row-m301` does not; status select is gone; selecting project `p2` drops the total to 3.
  - as `u2`: click `เพิ่ม Milestone ใหม่`, fill the form, save → a new row appears and total becomes 7. Click `roadmap-bar-m102`, set progress to 100, save → its `data-status` is `completed`.
  - as `u3` (staff): the add button is absent and clicking `roadmap-bar-m102` opens no dialog.
- [ ] **Step 2:** `npx vitest run src/pages` → fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run src/pages` → pass.

### Task 6: Whole-app verification

- [ ] **Step 1:** `npm test` → every test passes.
- [ ] **Step 2:** `npm run build` → type-check and build succeed.
- [ ] **Step 3:** With the dev server on `http://localhost:5173/`, open `/schedule`, switch to Roadmap as supervisor and as staff, and compare against the reference screenshot (stat cards, grouped rows, bar colours, today line, add/edit/delete).
