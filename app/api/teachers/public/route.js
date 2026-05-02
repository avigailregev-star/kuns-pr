import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../lib/supabase';
import { buildUsedMinutesMap } from '../../../../lib/teacherCapacity';

export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('teachers')
    .select('id, name, instrument_type, available_days, available_hours, max_students')
    .order('name');

  if (error) return NextResponse.json({ data: [] });

  const usedMap = await buildUsedMinutesMap(supabase);
  const enriched = (data || []).map(t => ({
    ...t,
    used_minutes_per_day: usedMap[t.name] || {},
  }));

  return NextResponse.json({ data: enriched });
}
