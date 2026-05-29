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
    const [a, b, c, d, e] = await Promise.all([
      q(supabase, 'id, name'),
      q(supabase, 'id, name, instrument_type'),
      q(supabase, 'id, name, available_hours'),
      q(supabase, 'id, name, max_students'),
      q(supabase, 'id, name, teacher_availability_ranges(day_of_week, start_time, end_time)'),
    ]);
    return NextResponse.json({ a_name_only: a, b_instrument_type: b, c_available_hours: c, d_max_students: d, e_ranges: e });
  } catch (ex) {
    return NextResponse.json({ exception: ex instanceof Error ? ex.message : String(ex) });
  }
}
