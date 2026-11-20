# Roadmap View — Design

**Date:** 2026-11-20
**Size:** Small feature inside an existing page (short design)
**Visual reference:** user screenshot "Screenshot 2026-11-12 103855.png" (stat cards, toolbar, weekly Gantt grouped by project)

## 1. Intent

Add a **Roadmap** view to the "ปฏิทิน & ไทม์ไลน์รวม" page (`GlobalSchedulePage`) so everyone can see each project's phases (milestones) on a two-month weekly timeline: who owns each phase, when it runs, how far along it is, and which phases are behind plan. The existing Calendar and Gantt views show individual tasks; the Roadmap shows the level above them.

## 2. Goals / Non-goals / Anti-goals

**Goals**
- A third view mode, "Roadmap", next to Calendar and Gantt on the global schedule page.
- Layout matching the screenshot: four stat cards, a toolbar (project filter, Gantt/list toggle, "เพิ่ม Milestone ใหม่"), and a weekly grid grouped by project with progress bars and a "today" line.
- Milestones are a new, standalone record with a manually entered progress percentage.
- All roles can view. Admins and the project's supervisor can add, edit and delete.

**Non-goals**
- No project codes (`PRJ-01`). Decided by the user. Show the project colour dot and name only.
- No link between milestones and tasks; progress is not calculated from tasks.
- No drag-to-move or drag-to-resize bars, no dependency arrows, no roadmap tab inside the per-project workspace.

**Anti-goals**
- Showing milestones of projects the user cannot see (same visibility rule as tasks).
- Staff being able to create, edit or delete milestones.
- Components reading or writing `localStorage` directly instead of going through `WorkspaceRepository`.
- Changing the behaviour of the existing Calendar and Gantt modes.

## 3. Approaches

| Approach | Summary | Trade-off |
|---|---|---|
| **A. Standalone milestones, manual progress** *(chosen by user)* | New `Milestone` record with title, owner, dates and a hand-set percentage. Status is derived from percentage and dates. | Matches the screenshot and leaves tasks untouched. Numbers go stale if nobody updates them. |
| B. Progress calculated from tasks | Every task is assigned to a phase; percentage = completed tasks ÷ tasks in phase. | Always accurate, but needs changes to task forms, task data and seed data; roughly twice the work; empty phases read 0%. |
| C. Hybrid (calculated with manual override) | Dropped: two sources of truth for one number. | — |

A can grow into B later by adding an optional `milestoneId` to tasks.

## 4. Design

### Data

```ts
interface Milestone {
  id: string;
  projectId: string;
  title: string;
  ownerId: string;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD, >= startDate
  progress: number;    // integer 0–100
  createdAt: string;
}
type MilestoneStatus = 'completed' | 'in_progress' | 'delayed' | 'not_started';
```

Derived, never stored:
- **Status** (first match wins): `progress === 100` → completed; `endDate < today` → delayed; `progress > 0` → in_progress; otherwise not_started.
- **Phase number**: position within the project when sorted by `startDate` (then `createdAt`), shown as "Phase 1", "Phase 2", …
- **Project progress**: rounded average of its milestones' percentages, shown on the project group row.

### Storage and services

- New storage key `taskflow_v2_milestones`; `WorkspaceSnapshot` gains `milestones`.
- `WorkspaceRepository` gains `createMilestone`, `updateMilestone`, `deleteMilestone`, with the same validation style as tasks (required title, owner must be the project's supervisor or a member, `endDate >= startDate`, progress clamped to 0–100).
- Existing browsers have no milestones key: when it is missing or invalid, load seed milestones for whichever seed projects still exist, without touching users, projects or tasks. "Reset sample data" restores milestones too.
- Cascades: deleting a project deletes its milestones. When an owner is deleted or removed from the project, the milestone's owner becomes the project supervisor (same idea as task reassignment).
- Seed data: 8 milestones across the 3 seed projects, dated relative to today so the stat cards read like the screenshot (2 completed, 2 in progress, 1 delayed, 3 not started).

### Permissions (`domain/rbac.ts`)

- `getVisibleMilestones(user, projects, milestones)` — milestones of projects the user can view.
- `canManageMilestones(user, project)` — reuses `canManageProject` (admin, or the supervisor who owns the project).
- `WorkspaceContext` exposes `visibleMilestones` plus create/update/delete actions that check permission and show toasts like the task actions do.

### Page

`GlobalSchedulePage` gets a third mode button: **แผนงาน (Roadmap)**.

In Roadmap mode:
- The month navigator stays and moves a **two-month window** starting at the selected month. The label reads "กรอบเวลาแผนงาน: พฤศจิกายน – ธันวาคม 2569".
- The shared project filter applies. The status and assignee filters are hidden because they are about tasks.
- **Stat cards**: total, completed, in progress, delayed — counted over milestones after the project filter (not limited to the visible window). The delayed card is tinted rose.
- **Toolbar**: Gantt / list toggle and the "เพิ่ม Milestone ใหม่" button, shown only if the user can manage at least one visible project.
- **Gantt**: left column 320px with project group rows (colour dot, name, average %) and milestone rows (phase chip, title, "ผู้ดูแล: …", date range). Right side has 8 equal week columns, four per month: days 1–7, 8–15, 16–23, 24–end. Each bar spans start to end, clipped to the window, coloured by status (emerald / indigo / rose / slate) with a darker fill for the percentage, the phase label on the left and the percentage on the right. A dashed vertical line marks today when it falls inside the window. Legend at top right. Milestones outside the window still get a row, with no bar.
- **List view**: the same milestones as a table grouped by project — phase, title, owner, dates, status badge, progress bar, and edit/delete buttons for managers.
- **Empty state** when there are no milestones, with the add button for managers.
- Clicking a bar or row opens the edit modal for managers; for everyone else it does nothing.

### Modal

`MilestoneFormModal` (create and edit) on the existing `Modal` component: project (manageable projects only, locked when editing), title, owner (project supervisor and members), start date, end date, progress slider with number 0–100. Edit mode has a delete button with a confirmation.

### Code layout

- `src/types/models.ts` — `Milestone`, input types
- `src/domain/roadmap.ts` — status, phase numbering, week columns, bar position (pure, unit-tested)
- `src/components/schedule/RoadmapBoard.tsx`, `RoadmapList.tsx`, `RoadmapStats.tsx`
- `src/components/modals/MilestoneFormModal.tsx`
- Changes in `workspaceRepository.ts`, `seedData.ts`, `appConfig.ts`, `WorkspaceContext.tsx`, `rbac.ts`, `GlobalSchedulePage.tsx`, `App.tsx`

### Testing

Vitest, following existing test files: domain rules (status boundaries, week columns, clipping), repository CRUD, validation and cascades, RBAC, and component tests for the roadmap mode (stat counts, manager-only buttons, modal create/edit/delete).

## 5. Left to the builder

Exact Tailwind classes, bar label truncation on narrow bars, horizontal scroll behaviour on small screens, and toast wording.

## 6. Amendment (2026-11-20): phase board

Requested after the first version: several milestones must be able to share a phase, without typing phase numbers.

- `Milestone.phase` (integer, 1-based, per project) is now **stored**, replacing the phase number derived from start-date order in section 4. Milestones saved before this change get their phase from that old ordering on first load.
- Phases are always contiguous: after any create, update or delete the repository renumbers a project's phases to 1..n (`compactPhases`).
- Roadmap has a third view, **บอร์ดเฟส**: one section per project, one column per phase, milestone cards inside. Managers drag a card to another column to change its phase, drop it on the dashed column to open a new last phase, or use the "+" on a column to add a milestone directly into it. Cards never move between projects. Staff see the board read-only.
- The add/edit modal has a Phase dropdown (existing phases plus "open new"); a new milestone defaults to a new last phase unless added from a column.
- Timeline and list rows sort by phase first, then start date.
