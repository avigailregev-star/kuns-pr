import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getSupabaseClient } from '../../../../lib/supabase';
import { syncRegistrationToAttendance } from '../../../../lib/syncToAttendance';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  }

  try {
    const { studentName, teacher, assignedDay, assignedTime, selectedCourse } = await request.json();
    if (!studentName || !teacher) {
      return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 });
    }
    if (!assignedTime) {
      return NextResponse.json({ error: 'חסרה שעה — לא ניתן לשבץ בלעדיה' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // A student may have private, theory and ensemble registrations. Never
    // choose the newest row by name: that can overwrite a different lesson.
    let query = supabase
      .from('registrations')
      .select('id, selected_course')
      .ilike('student_name', studentName.trim());
    if (selectedCourse?.trim()) query = query.eq('selected_course', selectedCourse.trim());
    const { data: rows, error: findError } = await query.limit(2);

    if (findError) {
      return NextResponse.json({ error: 'שגיאה בחיפוש תלמיד' }, { status: 500 });
    }
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'לא נמצא רישום מתאים לתלמיד ולשיעור' }, { status: 404 });
    }
    if (rows.length > 1) return NextResponse.json({ error: 'לתלמיד יש כמה שיעורים. יש לציין את שם השיעור המדויק בייבוא.' }, { status: 409 });

    const { error: updateError } = await supabase
      .from('registrations')
      .update({
        teacher,
        assigned_day: assignedDay || null,
        assigned_time: assignedTime || null,
        status: 'שובץ',
        updated_at: new Date().toISOString(),
      })
      .eq('id', rows[0].id);

    if (updateError) {
      return NextResponse.json({ error: 'שגיאה בעדכון' }, { status: 500 });
    }

    const { data: updated, error: updatedError } = await supabase
      .from('registrations')
      .select('id, teacher, assigned_day, assigned_time, student_name, instruments, parent_phone, selected_course, status, registration_status, group_id')
      .eq('id', rows[0].id)
      .single();
    if (updatedError || !updated) return NextResponse.json({ error: 'השיבוץ נשמר, אך לא ניתן לאמת את הסנכרון לנוכחות' }, { status: 500 });
    await syncRegistrationToAttendance(supabase, updated);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Import assignment error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
