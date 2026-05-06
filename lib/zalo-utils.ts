import { formatAppointmentDateTime } from './zaloDate';

interface ZNSPayload {
  phone: string;
  eventType: string;
  payloadData: Record<string, string>;
}

function buildZNSPayload(apt: any, eventType: string): ZNSPayload | null {
  if (!apt.customer?.phone) return null;
  return {
    phone: apt.customer.phone,
    eventType,
    payloadData: {
      customerName: apt.customer?.name || 'Quý khách',
      appointmentDate: formatAppointmentDateTime(apt.date, apt.startTime),
      bookingCode: apt.bookingCode || apt._id.substring(0, 8).toUpperCase(),
      serviceName: apt.services?.map((s: any) => s.name).join(', ') || 'Dịch vụ Spa',
      status: eventType === 'appointment_confirmed' ? 'Đã xác nhận' : 'Đã bị hủy',
      invoiceId: apt._id,
    },
  };
}

// Fire-and-forget: gửi ngầm, không block UI
export function triggerZaloZNS(apt: any, newStatus: string): void {
  const eventTypeMap: Record<string, string> = {
    confirmed: 'appointment_confirmed',
    cancelled: 'appointment_cancelled',
  };
  const eventType = eventTypeMap[newStatus];
  if (!eventType) return;

  const payload = buildZNSPayload(apt, eventType);
  if (!payload) return;

  fetch('/api/zalo/zns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then((r) => r.json())
    .then((res) => {
      if (!res.success) console.error('❌ Zalo ZNS error:', res.error);
      else console.log(`✅ Zalo ZNS sent: ${newStatus}`);
    })
    .catch((err) => console.error('❌ Zalo ZNS system error:', err));
}

// Trả về Promise để dùng với toast.promise
export async function sendReminderZNS(apt: any): Promise<{ reminderCount: number }> {
  const res = await fetch('/api/zalo/zns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: apt.customer.phone,
      eventType: 'appointment_reminder',
      payloadData: {
        customerName: apt.customer?.name || 'Quý khách',
        appointmentDate: formatAppointmentDateTime(apt.date, apt.startTime),
        bookingCode: apt.bookingCode || apt._id.substring(0, 8).toUpperCase(),
        serviceName: apt.services?.map((s: any) => s.name).join(', ') || 'Dịch vụ Spa',
        status: apt.status === 'confirmed' ? 'Đã xác nhận' : 'Đang chờ xác nhận',
      },
    }),
  });
  const result = await res.json();
  if (!result.success) throw new Error(result.error || 'Lỗi gửi ZNS');

  const remindRes = await fetch(`/api/appointments/${apt._id}/remind`, { method: 'POST' });
  const remindData = await remindRes.json();
  if (!remindData.success) throw new Error('Lỗi ghi nhận nhắc lịch');
  return { reminderCount: remindData.data.reminderCount };
}
