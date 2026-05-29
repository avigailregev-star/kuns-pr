import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('teachers')
      .select('id, name, teacher_availability_ranges(day_of_week, start_time, end_time)')
      .order('name');

    if (error) return NextResponse.json({ error: error.message });

    return NextResponse.json({
      teachers: (data ?? []).map(t => ({
        name: t.name,
        id: t.id.slice(0, 8),
        ranges: t.teacher_availability_ranges?.length ?? 0,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) });
  }
}
