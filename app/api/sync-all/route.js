import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getSupabaseClient } from '../../../lib/supabase';
import { syncRegistrationToAttendance } from '../../../lib/syncToAttendance';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'אין הרשאה' }, { status: 401 });

  const supabase = getSupabaseClient();
  const excluded = ['בוטל', 'נדחה', 'רשימת המתנה', 'ממתין לשיחת היכרות'];

  const { data: regs, error } = await supabase
    .from('registrations')
    .select('id, teacher, assigned_day, assigned_time, student_name, instruments, parent_phone, selected_course, status, registration_status, group_id')
    .not('teacher', 'is', null)
    .not('assigned_day', 'is', null)
    .not('assigned_time', 'is', null)
    .is('group_id', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const toSync = (regs || []).filter(r => !excluded.includes(r.status) && r.registration_status !== 'Cancelled');

  let synced = 0;
  let failed = 0;
  for (const reg of toSync) {
    try {
      await syncRegistrationToAttendance(supabase, reg);
      synced++;
    } catch (e) {
      console.error('sync-all error for reg', reg.id, e.message);
      failed++;
    }
  }

  return NextResponse.json({ success: true, synced, failed });
}
