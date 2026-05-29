import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'NOT SET';
  const keySet = !!process.env.SUPABASE_SERVICE_KEY;
  const keyPrefix = process.env.SUPABASE_SERVICE_KEY?.slice(0, 40) ?? 'NOT SET';

  let dbResult;
  let teachersWithAvailability = [];
  let publicApiResult;
  try {
    const supabase = getSupabaseClient();

    // Same query as /api/teachers/public
    const { data, error } = await supabase
      .from('teachers')
      .select('id, name, teacher_availability_ranges(day_of_week, start_time, end_time)')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) {
      dbResult = `DB ERROR: ${error.message}`;
    } else {
      dbResult = 'OK';
      teachersWithAvailability = (data ?? []).map(t => ({
        name: t.name,
        id: t.id.slice(0, 8),
        availability_ranges: t.teacher_availability_ranges?.length ?? 0,
        ranges: (t.teacher_availability_ranges ?? []).map(r =>
          `יום ${r.day_of_week} ${r.start_time}-${r.end_time}`
        ),
      }));
    }

    // Test the full public API query
    const { data: publicData, error: publicError } = await supabase
      .from('teachers')
      .select('id, name, instrument_type, available_days, available_hours, max_students, courses, teacher_availability_ranges(day_of_week, start_time, end_time)')
      .order('name');
    publicApiResult = publicError
      ? `ERROR: ${publicError.message}`
      : `OK - ${publicData?.length ?? 0} teachers`;
  } catch (e) {
    dbResult = `EXCEPTION: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({
    supabase_url: url,
    service_key_set: keySet,
    service_key_prefix: keyPrefix,
    db_connection: dbResult,
    public_api_query: publicApiResult,
    last_10_teachers: teachersWithAvailability,
  });
}
