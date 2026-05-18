import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getSupabaseClient } from '../../../lib/supabase';
import { buildUsedMinutesMap } from '../../../lib/teacherCapacity';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('teachers')
    .select('*, teacher_availability_ranges(day_of_week, start_time, end_time)')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const usedMap = await buildUsedMinutesMap(supabase);
  const enriched = (data || []).map(t => ({
    ...t,
    used_minutes_per_day: usedMap[t.name] || {},
  }));

  return NextResponse.json({ data: enriched });
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });

  const body = await request.json();
  const { name, instrument_type, available_days, available_hours, max_students, courses, availability_ranges } = body;

  if (!name || !instrument_type) {
    return NextResponse.json({ error: 'שם וסוג כלי הם שדות חובה' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('teachers')
    .insert([{
      name,
      instrument_type,
      available_days: available_days || [],
      available_hours: available_hours || {},
      max_students: max_students ?? null,
      courses: courses || [],
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (Array.isArray(availability_ranges) && availability_ranges.length > 0 && data?.id) {
    await supabase.from('teacher_availability_ranges').insert(
      availability_ranges.map((r) => ({
        teacher_id: data.id,
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
      }))
    );
  }

  return NextResponse.json({ data });
}
