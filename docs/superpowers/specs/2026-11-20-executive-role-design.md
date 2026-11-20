# Executive role

- **Intent:** Add a global executive role that can manage projects, tasks, milestones, assignments, and user accounts without task approval or permission configuration.
- **Project access:** Executives can see and manage every project and all team workload.
- **Task review:** Executives can edit and assign tasks but cannot approve/reject review tasks or move tasks to completed. Existing Admin and Supervisor review behavior remains.
- **User accounts:** Executives can create Staff accounts and delete other accounts. They cannot assign roles, change roles, reset sample data, or open the RBAC matrix. Admin retains those permissions.
- **Compatibility:** Existing roles and persisted users remain valid. Admin-only routes remain protected; user management has its own Admin/Executive access check.
