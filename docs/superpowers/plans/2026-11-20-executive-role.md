# Executive Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global Executive role with full project/task management but no task approval or permission configuration.

**Architecture:** Add the role to the model, persistence validation, badges, and account forms. Centralize executive project permissions in RBAC helpers, explicitly block task approval/completion, and separate user-management access from Admin-only RBAC access.

**Tech Stack:** React, TypeScript, React Router, LocalStorageRepository.

**Spec:** `docs/superpowers/specs/2026-11-20-executive-role-design.md`

## Global Constraints

- Executives can see and manage all projects.
- Executives cannot approve/reject tasks or transition tasks to completed.
- Executives can create Staff accounts and delete other accounts, but cannot change roles or reset sample data.
- Only Admin can access or modify the RBAC matrix and assign roles.

## Review Focus

- Stored Executive users remain valid after reload.
- Executive task status updates to completed are rejected through workspace actions.
- Executive has no approve/reject controls on review tasks.
- Executive can manage users but cannot assign roles or access `/admin/rbac`.
- Admin and Supervisor permissions preserve their current behavior.

---

### Task 1: Add role and project capabilities

**Files:**
- Modify: `src/types/models.ts`
- Modify: `src/domain/rbac.ts`
- Modify: `src/services/workspaceRepository.ts`
- Modify: `src/components/ui/Badges.tsx`
- Modify: `src/components/modals/CreateUserModal.tsx`
- Modify: `src/pages/AdminUsersPage.tsx`

- [ ] Add `executive` role and persistence validation/color.
- [ ] Give executives global project, team, task, milestone, and assignment access.
- [ ] Keep task approval denied and reject transitions to `completed`.
- [ ] Allow user creation/deletion while forcing new accounts to Staff and keeping role changes Admin-only.

### Task 2: Separate user administration from permission configuration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/IconRail.tsx`
- Modify: `src/components/layout/ContextualSubPanel.tsx`
- Modify: `src/components/layout/Topbar.tsx`
- Modify: `src/components/workspace/AssignTasksBoard.tsx`
- Modify: `src/pages/ProjectWorkspacePage.tsx`
- Modify: `src/pages/AdminRbacPage.tsx`

- [ ] Let executives reach user management but keep RBAC routes Admin-only.
- [ ] Include Executive in project assignment UI and the RBAC comparison matrix.
