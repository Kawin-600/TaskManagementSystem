# Task and Milestone Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a linked, unphased milestone whenever a task is created, then let users place it into a roadmap phase.

**Architecture:** `LocalStorageRepository.createTask` creates both records and writes one snapshot, with the milestone ID on the task. Milestone `phase` becomes nullable while retaining numeric values for existing data. The phase board displays a draggable unassigned lane.

**Tech Stack:** React, TypeScript, Vite, LocalStorageRepository.

**Spec:** `docs/superpowers/specs/2026-11-20-task-milestone-link-design.md`

## Global Constraints

- Each newly created task gets one milestone in the same project.
- Generated milestone fields: task title, assignee owner, task dates, progress 0, phase `null`.
- Numeric milestone phases and legacy LocalStorage records remain compatible.
- Milestone progress remains manually editable.

## Review Focus

- Legacy milestone records without `phase` continue receiving migrated numeric phases.
- Explicit `phase: null` remains unassigned through storage and phase compaction.
- Dropping a card in the unassigned lane clears its phase; dropping into a phase sets it.
- Generated milestone creation validates owner/project before the single snapshot write.

---

### Task 1: Create linked milestone with each task

**Files:**
- Modify: `src/types/models.ts`
- Modify: `src/services/workspaceRepository.ts`
- Modify: `src/components/modals/CreateTaskModal.tsx`

- [ ] Generate a linked milestone from task title, assignee, dates, 0% progress and `phase: null` inside `createTask`.
- [ ] Persist task and milestone together and keep task edit links compatible.
- [ ] Remove the existing-milestone selector from task creation because a milestone is now generated automatically.

### Task 2: Support unassigned milestones

**Files:**
- Modify: `src/domain/roadmap.ts`
- Modify: `src/components/modals/MilestoneFormModal.tsx`
- Modify: `src/components/schedule/RoadmapBoard.tsx`
- Modify: `src/components/schedule/RoadmapList.tsx`

- [ ] Make milestone phase nullable and preserve explicit `null` in storage migration and phase compaction.
- [ ] Allow manually created or edited milestones to have no phase.
- [ ] Display unassigned status in timeline and list views.

### Task 3: Drag unassigned milestone into a phase

**Files:**
- Modify: `src/components/schedule/RoadmapPhaseBoard.tsx`
- Modify: `src/pages/GlobalSchedulePage.tsx`

- [ ] Show an “ยังไม่จัด Phase” lane with milestone cards.
- [ ] Allow dragging cards from that lane into existing/new phases and back into the unassigned lane.
