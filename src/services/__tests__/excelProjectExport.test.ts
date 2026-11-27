import { describe, expect, it } from 'vitest';
import type { Project, Task, User } from '../../types/models';
import { buildProjectExportRows } from '../excelProjectExport';

describe('buildProjectExportRows', () => {
  it('maps projects and tasks to the round-trip Excel columns', () => {
    const projects = [{
      id: 'p1', name: 'โปรเจค A', description: '', color: '#000', supervisorId: 'u1', memberIds: ['u1'],
    }] satisfies Project[];
    const tasks = [{
      id: 't1', projectId: 'p1', title: 'รายละเอียดงาน', module: 'Module A', feature: 'Feature A', description: 'หมายเหตุ', assigneeId: 'u1',
      status: 'completed', priority: 'medium', startDate: '2026-11-01', dueDate: '2026-11-10',
      createdAt: '2026-11-01', comments: [],
    }] satisfies Task[];
    const users = [{
      id: 'u1', name: 'ผู้ดูแล', email: 'owner@example.com', role: 'supervisor', avatar: 'ผด', color: 'indigo',
    }] satisfies User[];

    expect(buildProjectExportRows(projects, tasks, users)).toEqual([{
      ประเภท: 'โปรเจค A',
      Module: 'Module A',
      Feature: 'Feature A',
      Task: 'รายละเอียดงาน',
      Owner: 'ผู้ดูแล',
      Status: 'Done',
      Start: '2026-11-01',
      End: '2026-11-10',
      เพิ่มเติม: 'หมายเหตุ',
    }]);
  });
});
