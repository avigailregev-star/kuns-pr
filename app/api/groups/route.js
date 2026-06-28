import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getSupabaseClient } from '../../../lib/supabase';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, lesson_type, is_mangan_school, school_name, teacher_id, assigned_day, assigned_time } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'שם קבוצה הוא שדה חובה' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Block overlapping group schedules for the same teacher on the same day
    if (teacher_id != null && assigned_day != null && assigned_time != null && assigned_time !== '') {
      const { data: existing } = await supabase
        .from('groups')
        .select('lesson_type, group_schedules(day_of_week, start_time, end_time)')
        .eq('teacher_id', teacher_id);

      const toM = t => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
      const ltDur = lt => (lt === 'individual_45' || lt === 'melodies_individual') ? 45 : 60;
      const newStart = toM(assigned_time);
      const newEnd = newStart + ltDur(lesson_type);
      const dayNum = Number(assigned_day);

      for (const g of (existing || [])) {
        for (const sched of (g.group_schedules || [])) {
          if (Number(sched.day_of_week) !== dayNum || !sched.start_time) continue;
          const eStart = toM(sched.start_time);
          const eEnd = sched.end_time ? toM(sched.end_time) : eStart + ltDur(g.lesson_type);
          if (newStart < eEnd && eStart < newEnd) {
            return NextResponse.json(
              { error: `חיפוף בזמנים עם קבוצה קיימת באותו יום (${sched.start_time})` },
              { status: 409 }
            );
          }
        }
      }
    }

    const insertData = { name: name.trim() };
    if (lesson_type != null) insertData.lesson_type = lesson_type;
    if (school_name != null) insertData.school_name = school_name;
    if (teacher_id != null) insertData.teacher_id = teacher_id;
    insertData.is_mangan_school = !!is_mangan_school;

    const { data, error } = await supabase
      .from('groups')
      .insert(insertData)
      .select('id, name, lesson_type, is_mangan_school, school_name')
      .single();

    if (error) {
      console.error('Group create error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create group_schedules entry if day was provided
    if (assigned_day != null && assigned_time) {
      const { error: schedErr } = await supabase.from('group_schedules').insert({
        group_id: data.id,
        day_of_week: assigned_day,
        start_time: assigned_time,
      });
      if (schedErr) console.error('group_schedules insert error:', schedErr.message);
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('Groups POST error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'חסר מזהה קבוצה' }, { status: 400 });

    const supabase = getSupabaseClient();

    // Clear group_id from registrations (FK constraint)
    await supabase.from('registrations').update({ group_id: null }).eq('group_id', id);

    // Delete students in this group (if table exists)
    await supabase.from('students').delete().eq('group_id', id);

    // Delete group schedules
    await supabase.from('group_schedules').delete().eq('group_id', id);

    // Delete the group
    const { error } = await supabase.from('groups').delete().eq('id', id);
    if (error) {
      console.error('Group delete error:', error.message);
      return NextResponse.json({ error: `שגיאה במחיקת קבוצה: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Groups DELETE error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('groups')
      .select('id, name, lesson_type, is_mangan_school, school_name, teacher_id, group_schedules(day_of_week, start_time, end_time)')
      .order('name', { ascending: true });

    if (error) {
      console.error('Groups fetch error:', error.message);
      return NextResponse.json({ error: 'שגיאה בשליפת קבוצות' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error('Groups API error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
