import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('teachers')
      .select('id, name, available_days, teacher_availability_ranges(day_of_week)')
      .order('name');

    return NextResponse.json({
      teachers: (data ?? []).map(t => ({
        name: t.name,
        old_days: t.available_days ?? [],
        new_ranges: t.teacher_availability_ranges?.length ?? 0,
        has_any: (t.available_days?.length > 0) || (t.teacher_availability_ranges?.length > 0),
      }))
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) });
  }
}
