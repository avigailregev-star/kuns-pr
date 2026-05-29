import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../lib/supabase';
import { buildUsedMinutesMap } from '../../../lib/teacherCapacity';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // Exact same query as /api/teachers/public
    const { data, error } = await supabase
      .from('teachers')
      .select('id, name, instrument_type, available_days, available_hours, max_students, courses, teacher_availability_ranges(day_of_week, start_time, end_time)')
      .order('name');

    if (error) return NextResponse.json({ public_query_error: error.message });

    let usedMapError = null;
    let usedMap = {};
    try {
      usedMap = await buildUsedMinutesMap(supabase);
    } catch (e) {
      usedMapError = e instanceof Error ? e.message : String(e);
    }

    const enriched = (data || []).map(t => ({
      ...t,
      used_minutes_per_day: usedMap[t.name] || {},
    }));

    return NextResponse.json({
      total_from_query: data?.length ?? 0,
      usedMap_error: usedMapError,
      teacher_names: (data ?? []).map(t => t.name),
      enriched_count: enriched.length,
    });
  } catch (e) {
    return NextResponse.json({ exception: e instanceof Error ? e.message : String(e) });
  }
}
