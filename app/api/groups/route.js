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
    const { name, lesson_type, is_mangan_school, school_name } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'שם קבוצה הוא שדה חובה' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const insertData = { name: name.trim() };
    if (lesson_type != null) insertData.lesson_type = lesson_type;
    if (school_name != null) insertData.school_name = school_name;
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

    return NextResponse.json({ data });
  } catch (err) {
    console.error('Groups POST error:', err);
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
