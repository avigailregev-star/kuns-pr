import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // Query 1: no join — should return ALL teachers
    const { data: noJoin } = await supabase
      .from('teachers')
      .select('id, name')
      .order('name');

    // Query 2: with join — this is what public API uses
    const { data: withJoin, error: joinError } = await supabase
      .from('teachers')
      .select('id, name, instrument_type, max_students, teacher_availability_ranges(day_of_week, start_time, end_time)')
      .order('name');

    const noJoinNames = (noJoin ?? []).map(t => t.name);
    const withJoinNames = (withJoin ?? []).map(t => t.name);
    const missing = noJoinNames.filter(n => !withJoinNames.includes(n));

    return NextResponse.json({
      total_no_join: noJoinNames.length,
      total_with_join: withJoinNames.length,
      missing_from_join: missing,
      join_error: joinError?.message ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) });
  }
}
