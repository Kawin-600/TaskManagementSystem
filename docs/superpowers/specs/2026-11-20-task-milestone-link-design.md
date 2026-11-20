# Task and Milestone creation

- **Intent:** Keep a new task represented on the project roadmap by creating its linked milestone at the same time.
- **Behavior:** Every newly created task creates one milestone in the same repository write. The milestone uses the task title, assignee as owner, task start/due dates, and 0% progress. The task stores the new milestone ID.
- **Phase placement:** The new milestone starts with no phase. Show it in an explicit “ยังไม่จัด Phase” lane on the phase board, where it can be dragged into an existing phase or a new phase. Existing milestones can also be returned to this lane.
- **Compatibility:** Existing tasks without milestone links remain unchanged. Existing milestones with numeric phases keep their phases; old records without a phase are assigned phases using the existing migration behavior.
- **Editing:** Milestone progress remains manually editable. Existing task edit flow may change or clear its milestone link.
- **Deletion:** Deleting a task deletes its linked milestone. Deleting a milestone deletes every task linked to it.
- **Constraints:** Preserve current project permissions, validation, and LocalStorage storage format compatibility.
- **Not included:** Automatic progress calculation from task status, nor automatic renaming/rescheduling of a milestone when its task later changes.
