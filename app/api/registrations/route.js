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

  // Freeze permanent deletion until the database history trigger is installed
  // and explicitly enabled. Clearing an assignment still preserves its row.
  if (process.env.REGISTRATION_DELETE_AUDIT_READY !== 'true') {
    return NextResponse.json({ error: 'מחיקת שיעורים מושהית זמנית עד הפעלת יומן שינויים. ניתן לבטל שיבוץ בלי למחוק את הרישום.' }, { status: 503 });
  }

  try {
    const { id, ids } = await request.json();
    if (ids !== undefined || typeof id !== 'string' || !id) {
      return NextResponse.json({ error: 'יש לבחור שיעור אחד למחיקה' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data: reg, error: lookupError } = await supabase
      .from('registrations')
      .select('id, student_name, group_id')
      .eq('id', id)
      .maybeSingle();
    if (lookupError) return NextResponse.json({ error: 'שגיאה באיתור השיעור' }, { status: 500 });
    if (!reg) return NextResponse.json({ error: 'השיעור לא נמצא' }, { status: 404 });

    const { error: deleteError } = await supabase.from('registrations').delete().eq('id', reg.id);
    if (deleteError) return NextResponse.json({ error: 'מחיקת השיעור לא הושלמה' }, { status: 500 });

    // Attendance is shared by group. Keep it active when another registration
    // for this student still uses the same group. Never update by name alone.
    if (reg.group_id && reg.student_name) {
      const { data: remaining, error: remainingError } = await supabase
        .from('registrations')
        .select('id, status, registration_status')
        .eq('student_name', reg.student_name)
        .eq('group_id', reg.group_id);
      if (remainingError) console.error('Delete lesson attendance check:', remainingError.message);
      else if (!remaining?.some(row => row.status === 'שובץ' && row.registration_status !== 'Cancelled')) {
        const { error: attendanceError } = await supabase.from('students')
          .update({ is_active: false })
          .eq('name', reg.student_name.trim())
          .eq('group_id', reg.group_id);
        if (attendanceError) console.error('Delete lesson attendance update:', attendanceError.message);
      }
    }

    return NextResponse.json({ success: true, deletedId: reg.id });
  } catch (err) {
    console.error('Delete lesson error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
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
          if (registration_status === 'Cancelled') {
            const { data: others, error: othersError } = await supabase.from('registrations')
              .select('id, status, registration_status')
              .eq('student_name', reg.student_name).eq('group_id', reg.group_id);
            if (othersError) console.error('Payment cancellation attendance check:', othersError.message);
            else if (!(others || []).some(other => other.id !== id && other.status === 'שובץ' && other.registration_status !== 'Cancelled')) {
              studentUpdate.is_active = false;
            } else {
              return NextResponse.json({ success: true });
            }
            if (othersError) return NextResponse.json({ success: true });
          }
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
