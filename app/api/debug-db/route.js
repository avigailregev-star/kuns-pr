import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data: rangesData } = await supabase
      .from('teachers')
      .select('id, name, teacher_availability_ranges(day_of_week)')
      .order('name');
    const { data: daysData } = await supabase
      .from('teachers')
      .select('id, available_days');
    const daysMap = Object.fromEntries((daysData ?? []).map(t => [t.id, t.available_days ?? []]));

    return NextResponse.json({
      teachers: (rangesData ?? []).map(t => ({
        name: t.name,
        old_days: daysMap[t.id] ?? [],
        new_ranges: t.teacher_availability_ranges?.length ?? 0,
        has_any: (daysMap[t.id]?.length > 0) || (t.teacher_availability_ranges?.length > 0),
      }))
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) });
  }
}
