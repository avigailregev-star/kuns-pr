import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getSupabaseClient } from '../../../lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('registrations')
      .select('*, message_log(action, sent_at, status)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch registrations error:', error.message);
      return NextResponse.json({ error: 'שגיאה בשליפת נתונים' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('Registrations API error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  // Suspend irreversible deletion until registrations can be archived and audited.
  // This protects even older open browser tabs that still send DELETE requests.
  return NextResponse.json({ error: 'מחיקת רישומים הושבתה כדי להגן על נתוני התלמידים. ניתן לבטל שיבוץ בלי למחוק רישום.' }, { status: 409 });
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  }

  const PAYMENT_STATUS_MAP = { Pending: 'ממתין לתשלום', Confirmed: 'שולם', Cancelled: 'בוטל' };

  try {
    const { id, admin_notes, registration_status, student_name, parent_name, parent_phone, parent_email, attended_open_day, ensemble_not_required, theory_not_required } = await request.json();
    if (!id) return NextResponse.json({ error: 'מזהה חסר' }, { status: 400 });
    for (const value of [ensemble_not_required, theory_not_required]) {
      if (value !== undefined && typeof value !== 'boolean') {
        return NextResponse.json({ error: 'סימון לא נדרש חייב להיות כן או לא' }, { status: 400 });
      }
    }
    const updateData = { updated_at: new Date().toISOString() };
    if (ensemble_not_required !== undefined) updateData.ensemble_not_required = ensemble_not_required;
    if (theory_not_required !== undefined) updateData.theory_not_required = theory_not_required;
    if (admin_notes !== undefined) updateData.admin_notes = admin_notes;
    if (registration_status !== undefined) updateData.registration_status = registration_status;
    if (student_name !== undefined) updateData.student_name = student_name;
    if (parent_name !== undefined) updateData.parent_name = parent_name;
    if (parent_phone !== undefined) updateData.parent_phone = parent_phone;
    if (parent_email !== undefined) updateData.parent_email = parent_email;
    if (attended_open_day !== undefined) updateData.attended_open_day = attended_open_day;
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('registrations')
      .update(updateData)
      .eq('id', id);

    if (error) return NextResponse.json({ error: 'שגיאה' }, { status: 500 });

    // Sync payment status to students table in the attendance app
    if (registration_status !== undefined) {
      const hebrewStatus = PAYMENT_STATUS_MAP[registration_status];
      if (hebrewStatus) {
        const { data: reg } = await supabase
          .from('registrations').select('student_name, group_id').eq('id', id).single();
        if (reg?.student_name && reg.group_id) {
          const studentUpdate = { registration_status: hebrewStatus };
          if (registration_status === 'Cancelled') studentUpdate.is_active = false;
          await supabase.from('students').update(studentUpdate)
            .eq('name', reg.student_name).eq('group_id', reg.group_id);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
