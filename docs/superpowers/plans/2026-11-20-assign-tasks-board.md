# Assign Tasks Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manager-facing tab in each project workspace that assigns tasks by dragging cards between project-member columns.

**Architecture:** Add a project-scoped board as a fifth workspace tab. Reuse project members and task-update behavior; only update the task's assignee. Keep the existing status-based Kanban tab unchanged.

**Tech Stack:** React, TypeScript, React Router, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-11-20-assign-tasks-board-design.md`

## Global Constraints

- The page is limited to the project currently open.
- Columns include the project's assignable members and an unassigned column.
- Dragging updates `assigneeId` only; status remains unchanged.
- New tasks created while the Assign tab is open start unassigned.
- Existing status-based project Kanban remains unchanged.
- Only supervisors and admins may use the board.

## Review Focus

- No visible projects: render a clear empty state.
- Selected project removed from visibility: fall back to the first visible project.
- Drop into the current assignee column: no update.
- Completed task: manager assignment remains available without changing status.
- Staff route access: do not render assignment controls.

---

### Task 1: Build the project member assignment board

**Files:**
- Create: `src/components/workspace/AssignTasksBoard.tsx`

- [x] Add per-member task columns within the selected project.
- [x] Add an unassigned column for new and reassigned tasks.
- [x] Add draggable task cards and update only `assigneeId` on drop.
- [x] Preserve task detail opening from card clicks and display task status/date/priority.
- [x] Restrict assignment controls to supervisors and admins.

### Task 2: Register and expose the page

**Files:**
- Modify: `src/pages/ProjectWorkspacePage.tsx`

- [x] Add a “มอบหมายงาน (Assign)” tab for supervisor/admin users.
- [x] Embed the project member board in that tab and remove the standalone page route/navigation.
- [x] Create tasks from the Assign tab without selecting an initial assignee.
