import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../lib/supabase';
import { buildUsedMinutesMap } from '../../../../lib/teacherCapacity';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseClient();

  // Split into two queries: available_hours (nullable JSON) conflicts with
  // the teacher_availability_ranges join in Supabase when the value is NULL,
  // causing those teachers to be dropped from results.
  const [{ data, error }, { data: hoursData }] = await Promise.all([
    supabase
      .from('teachers')
      .select('id, name, instrument_type, available_days, max_students, courses, teacher_availability_ranges(day_of_week, start_time, end_time)')
      .order('name'),
    supabase
      .from('teachers')
      .select('id, available_hours'),
  ]);

  if (error) return NextResponse.json({ data: [] });

  const hoursMap = Object.fromEntries((hoursData ?? []).map(t => [t.id, t.available_hours ?? {}]));

  const usedMap = await buildUsedMinutesMap(supabase);
  const enriched = (data || []).map(t => ({
    ...t,
    available_hours: hoursMap[t.id] ?? {},
    used_minutes_per_day: usedMap[t.name] || {},
  }));

  return NextResponse.json({ data: enriched }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
