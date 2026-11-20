import { Check, Minus, X, ShieldCheck } from 'lucide-react';

interface MatrixRow {
  capability: string;
  admin: { type: 'allow' | 'partial' | 'deny'; text: string };
  supervisor: { type: 'allow' | 'partial' | 'deny'; text: string };
  staff: { type: 'allow' | 'partial' | 'deny'; text: string };
}

const ROWS: MatrixRow[] = [
  {
    capability: 'การมองเห็นโปรเจค, ปฏิทินรวม และภาระงานทีม (Member-Scoped)',
    admin: { type: 'allow', text: 'เห็นทุกโปรเจคและสมาชิกทั้งหมด' },
    supervisor: { type: 'partial', text: 'เฉพาะโปรเจคที่ตนดูแลหรือเป็นสมาชิก' },
    staff: { type: 'partial', text: 'เฉพาะโปรเจคที่ตนเป็นสมาชิก' },
  },
  {
    capability: 'สร้างโปรเจคใหม่',
    admin: { type: 'allow', text: 'ทำได้ทั้งหมด' },
    supervisor: { type: 'allow', text: 'สร้างได้ (เป็นหัวหน้าโปรเจคอัตโนมัติ)' },
    staff: { type: 'deny', text: 'ทำไม่ได้' },
  },
  {
    capability: 'แก้ไขโปรเจค / จัดการสมาชิกเข้า-ออก / ลบโปรเจค',
    admin: { type: 'allow', text: 'ทุกโปรเจค' },
    supervisor: { type: 'partial', text: 'เฉพาะโปรเจคที่ตนเป็นหัวหน้า' },
    staff: { type: 'deny', text: 'ดูรายชื่อสมาชิกได้อย่างเดียว' },
  },
  {
    capability: 'สร้างและมอบหมายงาน',
    admin: { type: 'allow', text: 'ทุกโปรเจค, มอบหมายสมาชิกในโปรเจคได้ทุกคน' },
    supervisor: { type: 'partial', text: 'โปรเจคที่เห็นได้, มอบหมายสมาชิกในโปรเจคได้' },
    staff: { type: 'partial', text: 'เฉพาะโปรเจคที่เป็นสมาชิก และผูกให้ตัวเองเท่านั้น' },
  },
  {
    capability: 'แก้ไขรายละเอียด / เปลี่ยนสถานะงาน (ล็อกงานที่เสร็จสิ้นสำหรับเจ้าหน้าที่)',
    admin: { type: 'allow', text: 'ทุกงานและทุกสถานะ' },
    supervisor: { type: 'partial', text: 'ทุกงานในโปรเจคที่เห็นได้' },
    staff: {
      type: 'partial',
      text: 'เฉพาะงานของตนที่ยังไม่เสร็จสิ้น (ส่งได้ถึง "รอตรวจสอบ", ล็อกงานที่เสร็จสิ้นแล้ว)',
    },
  },
  {
    capability: 'อนุมัติ / ส่งกลับแก้ไข / เปิดงานที่เสร็จสิ้นใหม่',
    admin: { type: 'allow', text: 'ทำได้ทั้งหมด' },
    supervisor: { type: 'partial', text: 'ในโปรเจคที่เห็นได้' },
    staff: { type: 'deny', text: 'ทำไม่ได้ (ส่งตรวจสอบได้เท่านั้น)' },
  },
  {
    capability: 'แสดงความคิดเห็น & แนบลิงก์ส่งงาน',
    admin: { type: 'allow', text: 'ทุกงาน' },
    supervisor: { type: 'allow', text: 'ทุกงานในโปรเจคที่เห็นได้' },
    staff: { type: 'allow', text: 'ทุกงานในโปรเจคที่เป็นสมาชิก (รวมถึงงานที่เสร็จสิ้นแล้ว)' },
  },
  {
    capability: 'ลบงาน',
    admin: { type: 'allow', text: 'ทำได้ทั้งหมด' },
    supervisor: { type: 'partial', text: 'ในโปรเจคที่เห็นได้' },
    staff: { type: 'deny', text: 'ทำไม่ได้' },
  },
  {
    capability: 'จัดการผู้ใช้งานและตารางสิทธิ์ (Admin Settings)',
    admin: { type: 'allow', text: 'ทำได้ทั้งหมด (ห้ามลดสิทธิ์หรือลบตัวเอง)' },
    supervisor: { type: 'deny', text: 'ไม่มีสิทธิ์เข้าถึง' },
    staff: { type: 'deny', text: 'ไม่มีสิทธิ์เข้าถึง' },
  },
];

function Cell({ item }: { item: { type: 'allow' | 'partial' | 'deny'; text: string } }) {
  if (item.type === 'allow') {
    return (
      <span className="inline-flex items-start gap-1.5 font-semibold text-emerald-700">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{item.text}</span>
      </span>
    );
  }
  if (item.type === 'partial') {
    return (
      <span className="inline-flex items-start gap-1.5 font-semibold text-amber-700">
        <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{item.text}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-start gap-1.5 font-semibold text-rose-600">
      <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{item.text}</span>
    </span>
  );
}

export function AdminRbacPage() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <ShieldCheck className="h-5 w-5 text-indigo-600" />
        <div>
          <h3 className="text-base font-bold text-slate-800">
            ตารางเปรียบเทียบสิทธิ์การใช้งาน (Member-Scoped RBAC Matrix)
          </h3>
          <p className="text-xs text-slate-500">
            สิทธิ์ทั้งหมดถูกควบคุมแบบศูนย์กลางทั้งในระดับหน้าจอ, เส้นทาง URL และชั้นจัดเก็บข้อมูล
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 font-bold text-slate-700">
              <th className="p-3.5">ฟังก์ชันการใช้งาน</th>
              <th className="p-3.5 text-purple-700">Admin (ผู้ดูแลระบบ)</th>
              <th className="p-3.5 text-indigo-700">หัวหน้างาน (Supervisor)</th>
              <th className="p-3.5 text-emerald-700">เจ้าหน้าที่ (Staff)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ROWS.map((row) => (
              <tr key={row.capability} className="hover:bg-slate-50/70">
                <td className="p-3.5 font-semibold text-slate-800">{row.capability}</td>
                <td className="p-3.5">
                  <Cell item={row.admin} />
                </td>
                <td className="p-3.5">
                  <Cell item={row.supervisor} />
                </td>
                <td className="p-3.5">
                  <Cell item={row.staff} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
