import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseProjectExcel } from '../excelProjectImport';

describe('parseProjectExcel', () => {
  it('assigns a merged Feature to every task it spans without filling unrelated blank cells', async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['ประเภท', 'Module', 'Feature', 'Task'],
      ['Project', 'Module', 'Feature A', 'Task 1'],
      ['', '', '', 'Task 2'],
      ['', '', '', 'Task without feature'],
      ['', '', 'Feature B', 'Task 3'],
    ]);
    sheet['!merges'] = [{ s: { r: 1, c: 2 }, e: { r: 2, c: 2 } }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Tasks');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    const preview = await parseProjectExcel(buffer);
    expect(preview.projects[0].tasks.map(({ feature, title }) => ({ feature, title }))).toEqual([
      { feature: 'Feature A', title: 'Task 1' },
      { feature: 'Feature A', title: 'Task 2' },
      { feature: '', title: 'Task without feature' },
      { feature: 'Feature B', title: 'Task 3' },
    ]);
  });
  it('maps category to project and fills down category/module for following rows', async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['ประเภท', 'Module', 'Feature', 'Task', 'Status', 'Start', 'End'],
      ['โปรเจค A', 'Module A', 'Feature A', 'รายละเอียด 1', 'Done', new Date(2569, 6, 20), new Date(2569, 6, 25)],
      ['', '', 'Feature B', 'รายละเอียด 2', 'Doing', new Date(2026, 6, 21), new Date(2026, 6, 26)],
      ['โปรเจค B', 'Module B', '', 'รายละเอียด 3', 'Todo', '', ''],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Task-Work');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    const preview = await parseProjectExcel(buffer);

    expect(preview.projects).toHaveLength(2);
    expect(preview.projects[0]).toMatchObject({
      name: 'โปรเจค A',
      tasks: [
        { module: 'Module A', feature: 'Feature A', title: 'รายละเอียด 1', status: 'completed', startDate: '2026-07-20' },
        { module: 'Module A', feature: 'Feature B', title: 'รายละเอียด 2', status: 'in_progress' },
      ],
    });
    expect(preview.rowCount).toBe(3);
    expect(preview.projects[1]).toMatchObject({
      name: 'โปรเจค B',
      tasks: [{ module: 'Module B', feature: '', title: 'รายละเอียด 3', status: 'todo' }],
    });
  });

  it('rejects sheets without the required headers', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['ชื่อ', 'งาน']]), 'Sheet1');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    await expect(parseProjectExcel(buffer)).rejects.toThrow('ประเภท, Module และ Task');
  });
});
