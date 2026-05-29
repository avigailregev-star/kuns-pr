import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // Exact same query as /api/teachers/public
    const { data, error } = await supabase
      .from('teachers')
      .select('id, name, available_days, courses, teacher_availability_ranges(day_of_week, start_time, end_time)')
      .order('name');

    if (error) return NextResponse.json({ error: error.message });

    return NextResponse.json({
      total: data?.length ?? 0,
      teachers: (data ?? []).map(t => ({
        name: t.name,
        id: t.id.slice(0, 8),
        ranges_from_join: t.teacher_availability_ranges?.length ?? 'null',
        available_days: t.available_days ?? [],
        courses: t.courses ?? [],
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) });
  }
}
