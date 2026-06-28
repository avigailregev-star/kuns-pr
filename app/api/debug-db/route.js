import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const { data: teachers, error } = await supabase
      .from('teachers')
      .select('id, name, instrument_type')
      .order('name');

    const { data: ranges } = await supabase
      .from('teacher_availability_ranges')
      .select('teacher_id, day_of_week, start_time, end_time');

    return NextResponse.json({
      total: (teachers ?? []).length,
      names: (teachers ?? []).map(t => t.name),
      ranges_count: (ranges ?? []).length,
      error: error?.message ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) });
  }
}
