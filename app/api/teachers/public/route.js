import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../lib/supabase';
import { buildUsedMinutesMap } from '../../../../lib/teacherCapacity';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseClient();

  // Split into two queries: nullable JSON/JSONB columns (available_hours, courses)
  // conflict with the teacher_availability_ranges join in Supabase when NULL,
  // causing those teachers to be silently dropped from results.
  const [{ data, error }, { data: extraData }] = await Promise.all([
    supabase
      .from('teachers')
      .select('id, name, instrument_type, max_students, teacher_availability_ranges(day_of_week, start_time, end_time)')
      .order('name'),
    supabase
      .from('teachers')
      .select('id, available_days, available_hours, courses'),
  ]);

  if (error) return NextResponse.json({ data: [] });

  const extraMap = Object.fromEntries((extraData ?? []).map(t => [t.id, t]));

  const usedMap = await buildUsedMinutesMap(supabase);
  const enriched = (data || []).map(t => ({
    ...t,
    available_days: extraMap[t.id]?.available_days ?? [],
    available_hours: extraMap[t.id]?.available_hours ?? {},
    courses: extraMap[t.id]?.courses ?? [],
    used_minutes_per_day: usedMap[t.name] || {},
  }));

  return NextResponse.json({ data: enriched }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
