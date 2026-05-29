import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('teachers')
      .select('id, name, available_days, teacher_availability_ranges(day_of_week, start_time, end_time)')
      .ilike('name', '%נועם%');

    return NextResponse.json({ noam_records: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) });
  }
}
