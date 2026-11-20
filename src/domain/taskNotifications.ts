export const taskNotificationMessages = {
  created: 'มีงานใหม่',
  assigned: 'มีการเปลี่ยนผู้รับผิดชอบงาน',
  dueDateChanged: 'มีการเปลี่ยนกำหนดส่งงาน',
  priorityChanged: 'มีการเปลี่ยนความสำคัญของงาน',
  todo: 'มีงานย้ายไปสถานะรอเริ่ม',
  in_progress: 'มีงานย้ายไปสถานะกำลังดำเนินการ',
  review: 'มีงานส่งเข้าตรวจ',
  completed: 'มีงานเสร็จสิ้น',
} as const;

export type TaskNotificationEvent = keyof typeof taskNotificationMessages;
