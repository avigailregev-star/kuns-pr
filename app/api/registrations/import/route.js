import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getSupabaseClient } from '../../../../lib/supabase';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  }

  try {
    const { studentName, teacher, assignedDay, assignedTime } = await request.json();
    if (!studentName || !teacher) {
      return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Find registration by student name (case-insensitive, most recent)
    const { data: rows, error: findError } = await supabase
      .from('registrations')
      .select('id')
      .ilike('student_name', studentName.trim())
      .order('created_at', { ascending: false })
      .limit(1);

    if (findError) {
      return NextResponse.json({ error: 'שגיאה בחיפוש תלמיד' }, { status: 500 });
    }
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'תלמיד לא נמצא' }, { status: 404 });
    }

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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Import assignment error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
