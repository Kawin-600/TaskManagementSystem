import { formatDateObj, getTodayStr } from '../domain/dates';
import type { ImportProjectInput, TaskStatus } from '../types/models';

type ExcelRow = Record<string, unknown>;

export function splitOwnerNames(value?: string): string[] {
  return (value ?? '').split(/[,;\/\n\r]+/).map((name) => name.trim()).filter(Boolean);
}

export interface ExcelProjectPreview {
  sheetName: string;
  projects: ImportProjectInput[];
  rowCount: number;
}

function text(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function normalizeStatus(value: unknown): TaskStatus {
  const status = text(value).toLowerCase();
  if (['done', 'completed', 'complete', 'เสร็จ', 'เสร็จแล้ว'].includes(status)) return 'completed';
  if (['doing', 'in progress', 'in_progress', 'กำลังทำ'].includes(status)) return 'in_progress';
  if (['review', 'รอตรวจ'].includes(status)) return 'review';
  return 'todo';
}

function normalizeDate(
  value: unknown,
  fallback: string,
  parseDateCode: (value: number) => { y: number; m: number; d: number } | null,
): string {
  let date: Date | null = null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) date = value;
  else if (typeof value === 'number') {
    const parsed = parseDateCode(value);
    if (parsed) date = new Date(parsed.y, parsed.m - 1, parsed.d);
  } else if (text(value)) {
    const parsed = new Date(text(value));
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  if (!date) return fallback;
  const year = date.getFullYear() > 2400 ? date.getFullYear() - 543 : date.getFullYear();
  return formatDateObj(new Date(year, date.getMonth(), date.getDate()));
}

export async function parseProjectExcel(buffer: ArrayBuffer): Promise<ExcelProjectPreview> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames.find((name) => {
    const header = XLSX.utils.sheet_to_json<ExcelRow>(workbook.Sheets[name], {
      header: 1,
      range: 0,
      blankrows: false,
    })[0] as unknown;
    return Array.isArray(header) && header.includes('ประเภท') && header.includes('Module') && header.includes('Task');
  });
  if (!sheetName) throw new Error('ไม่พบชีตที่มีคอลัมน์ ประเภท, Module และ Task');

  const sheet = workbook.Sheets[sheetName];
  const header = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, range: 0, blankrows: false })[0];
  const featureColumn = header?.indexOf('Feature') ?? -1;
  const inheritedFeatureRows = new Set<number>();
  // Only fill cells covered by an actual Excel merge. A genuinely blank Feature
  // must stay blank rather than inheriting an unrelated preceding value.
  for (const merge of sheet['!merges'] ?? []) {
    if (featureColumn < merge.s.c || featureColumn > merge.e.c || merge.s.r === 0) continue;
    const source = sheet[XLSX.utils.encode_cell(merge.s)];
    if (!source) continue;
    for (let row = merge.s.r; row <= merge.e.r; row += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: featureColumn });
      if (!text(sheet[address]?.v)) {
        sheet[address] = { ...source };
        inheritedFeatureRows.add(row);
      }
    }
  }
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' });
  const today = getTodayStr();
  const grouped = new Map<string, ImportProjectInput>();
  let currentProject = '';
  let currentModule = '';
  let rowCount = 0;

  for (const row of rows) {
    const nextProject = text(row['ประเภท']);
    const nextModule = text(row['Module']);
    if (nextProject) {
      currentProject = nextProject;
      currentModule = '';
    }
    if (nextModule) currentModule = nextModule;
    const feature = text(row['Feature']);
    const title = text(row['Task']) || (inheritedFeatureRows.has((row as ExcelRow & { __rowNum__: number }).__rowNum__) ? '' : feature);
    if (!currentProject || !currentModule || !title) continue;

    const startDate = normalizeDate(row['Start'], today, XLSX.SSF.parse_date_code);
    const dueDateCandidate = normalizeDate(row['End'], startDate, XLSX.SSF.parse_date_code);
    const dueDate = dueDateCandidate < startDate ? startDate : dueDateCandidate;
    const project = grouped.get(currentProject) ?? { name: currentProject, tasks: [] };
    project.tasks.push({
      title,
      module: currentModule,
      ownerName: text(row['Owner']),
      feature,
      description: text(row['เพิ่มเติม']),
      status: normalizeStatus(row['Status']),
      startDate,
      dueDate,
    });
    grouped.set(currentProject, project);
    rowCount += 1;
  }

  const projects = [...grouped.values()];
  if (projects.length === 0) throw new Error('ไม่พบข้อมูลโปรเจคและงานที่นำเข้าได้');
  return { sheetName, projects, rowCount };
}
