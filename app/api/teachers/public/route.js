import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../lib/supabase';
import { buildUsedMinutesMap } from '../../../../lib/teacherCapacity';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseClient();

  // Three separate queries — no nested joins at all.
  // PostgREST silently drops teachers when any nullable column is combined with a
  // to-many join (teacher_availability_ranges). Fetching ranges from their own table
  // directly avoids this entirely.
  const [
    { data: teachers, error },
    { data: extraData },
    { data: ranges },
  ] = await Promise.all([
    supabase.from('teachers').select('id, name').order('name'),
    supabase.from('teachers').select('id, instrument_type, available_days, max_students, available_hours, courses'),
    supabase.from('teacher_availability_ranges').select('teacher_id, day_of_week, start_time, end_time'),
  ]);

  if (error) return NextResponse.json({ data: [] });

  const extraMap = Object.fromEntries((extraData ?? []).map(t => [t.id, t]));

  const rangesMap = {};
  for (const r of (ranges ?? [])) {
    if (!rangesMap[r.teacher_id]) rangesMap[r.teacher_id] = [];
    rangesMap[r.teacher_id].push({ day_of_week: r.day_of_week, start_time: r.start_time, end_time: r.end_time });
  }

  const usedMap = await buildUsedMinutesMap(supabase);
  const enriched = (teachers || []).map(t => ({
    ...t,
    instrument_type: extraMap[t.id]?.instrument_type ?? null,
    available_days: extraMap[t.id]?.available_days ?? [],
    max_students: extraMap[t.id]?.max_students ?? null,
    available_hours: extraMap[t.id]?.available_hours ?? {},
    courses: extraMap[t.id]?.courses ?? [],
    teacher_availability_ranges: rangesMap[t.id] ?? [],
    used_minutes_per_day: usedMap[t.name] || {},
  }));

  return NextResponse.json({ data: enriched }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
