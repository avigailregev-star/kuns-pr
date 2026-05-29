import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

async function q(supabase, select) {
  const { data, error } = await supabase.from('teachers').select(select).order('name');
  return { count: data?.length ?? 0, error: error?.message ?? null, hasKeli: (data ?? []).some(t => t.name?.includes('כלי')) };
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // Full combined query - identical to public API
    const full = await q(supabase, 'id, name, instrument_type, available_days, available_hours, max_students, courses, teacher_availability_ranges(day_of_week, start_time, end_time)');

    // Without ranges join
    const noRanges = await q(supabase, 'id, name, instrument_type, available_days, available_hours, max_students, courses');

    // Without available_hours + ranges
    const noHours = await q(supabase, 'id, name, instrument_type, available_days, max_students, courses, teacher_availability_ranges(day_of_week, start_time, end_time)');

    return NextResponse.json({ full, noRanges, noHours });
  } catch (ex) {
    return NextResponse.json({ exception: ex instanceof Error ? ex.message : String(ex) });
  }
}
